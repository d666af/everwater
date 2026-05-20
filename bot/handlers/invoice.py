"""
Invoice (накладная) reader.

Reads invoices posted as photos in INVOICE_GROUP_ID, OCRs them,
and issues warehouse batches automatically.

Format read from the photo:
  HH:MM:SS         DD.MM.YYYY
  Наименование | Кол-во | Бонус | Цена | Сумма
              EVER
  возврат      Шт   <ret_qty>   0
  EVER 20л     Шт   <qty>       0     <price>   <sum>
  Итого:                              <sum>
  получатель   <NAME>       998XXXXXXXXX
  тип машины   <TYPE>       <PLATE>
"""

import io
import re
import logging
from datetime import datetime, timezone, timedelta

from aiogram import Router, F, Bot
from aiogram.filters import Command
from aiogram.types import Message, PhotoSize

from config import settings
from services.api_client import (
    get_courier_by_phone, create_courier_from_invoice,
    update_courier_vehicle, issue_batch, get_products,
)

log = logging.getLogger(__name__)
router = Router()

TZ_UZB = timezone(timedelta(hours=5))

# Product name patterns found in invoices → mapped to keywords for DB lookup
PRODUCT_PATTERNS = [
    (re.compile(r'ever\s*20', re.IGNORECASE), 'EVER'),   # EVER 20л → 19L product
    (re.compile(r'ever\s*19', re.IGNORECASE), 'EVER'),
    (re.compile(r'ever\s*5',  re.IGNORECASE), 'EVER 5'),
]


# ─── OCR ──────────────────────────────────────────────────────────────────────

async def _ocr_photo(bot: Bot, photo: PhotoSize) -> str:
    try:
        import pytesseract
        from PIL import Image, ImageFilter, ImageEnhance
    except ImportError:
        log.error("pytesseract/Pillow not installed")
        return ""
    try:
        file = await bot.get_file(photo.file_id)
        bio = io.BytesIO()
        await bot.download(file, destination=bio)
        bio.seek(0)

        img = Image.open(bio).convert('L')
        # Sharpen + increase contrast for better table OCR
        img = img.filter(ImageFilter.SHARPEN)
        img = ImageEnhance.Contrast(img).enhance(2.0)

        text = pytesseract.image_to_string(
            img,
            lang='rus+eng',
            config='--psm 6 --oem 3',
        )
        log.info("OCR result:\n%s", text)
        return text
    except Exception as e:
        log.error("OCR error: %s", e)
        return ""


# ─── Parser ───────────────────────────────────────────────────────────────────

def _normalize_phone(raw: str) -> str | None:
    digits = re.sub(r'[^\d]', '', raw)
    m = re.search(r'998\d{9}', digits)
    if m:
        return '+' + m.group()
    # Sometimes OCR drops leading digit
    m9 = re.search(r'9[5-9]\d{7}', digits)
    if m9:
        return '+998' + m9.group()
    return None


def _parse_invoice(text: str) -> dict | None:
    if not text or len(text) < 20:
        return None

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]

    result = {
        'dt': None,
        'return_qty': 0,
        'items': [],          # list of {raw_name, qty}
        'courier_phone': None,
        'courier_name': None,
        'vehicle_type': None,
        'vehicle_plate': None,
    }

    header = ' '.join(lines[:4])
    # Date: DD.MM.YYYY
    date_m = re.search(r'(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})', header)
    # Time: HH:MM:SS or HH:MM
    time_m = re.search(r'(\d{1,2}):(\d{2})(?::(\d{2}))?', header)
    if date_m and time_m:
        try:
            d, mo, y = int(date_m.group(1)), int(date_m.group(2)), int(date_m.group(3))
            h, mi = int(time_m.group(1)), int(time_m.group(2))
            sec = int(time_m.group(3) or 0)
            result['dt'] = datetime(y, mo, d, h, mi, sec, tzinfo=TZ_UZB)
        except Exception:
            pass

    for line in lines:
        low = line.lower()

        # Return row
        if 'возврат' in low or 'vozvrat' in low:
            nums = re.findall(r'\b(\d+)\b', line)
            for n in nums:
                if 0 < int(n) < 1000:
                    result['return_qty'] = int(n)
                    break

        # Product rows with "ever" brand
        elif re.search(r'\bever\b', low) and 'наименование' not in low:
            # OCR may give: "EVER 20л  Шт  32  0  18 000  576 000"
            # Extract numbers; qty is the first one < 10000 (to avoid reading price)
            nums = re.findall(r'\b(\d+)\b', line)
            for n in nums:
                v = int(n)
                if 1 <= v <= 5000:
                    result['items'].append({'raw_name': 'EVER 20л', 'qty': v})
                    break

        # Courier row
        elif 'получатель' in low or re.search(r'po\w*atel', low):
            phone = _normalize_phone(line)
            if phone:
                result['courier_phone'] = phone
            # Name: first ALL-CAPS word after keyword
            name_m = re.search(
                r'(?:получатель|poluchatel)\s+([А-ЯA-Z][А-ЯA-Za-z]{1,20})',
                line, re.IGNORECASE,
            )
            if name_m:
                result['courier_name'] = name_m.group(1).strip()

        # Vehicle row
        elif 'тип' in low and ('маш' in low or 'авто' in low) or re.search(r'\b[A-Z]{2,5}\b.*\b\d+[A-Z]+\d+[A-Z]*\b', line):
            # "тип машины  LABO  30L700QA"
            parts = re.split(r'\s{2,}|\t', line)
            parts = [p.strip() for p in parts if p.strip() and 'тип' not in p.lower() and 'маш' not in p.lower()]
            if len(parts) >= 2:
                result['vehicle_type'] = parts[0].upper()
                result['vehicle_plate'] = parts[1].upper()
            elif len(parts) == 1:
                p = parts[0].upper()
                if re.search(r'\d', p):
                    result['vehicle_plate'] = p
                else:
                    result['vehicle_type'] = p

    if not result['courier_phone'] and not result['courier_name']:
        log.warning("Invoice parse: no courier info found")
        return None
    if not result['items'] and result['return_qty'] == 0:
        log.warning("Invoice parse: no items and no return")
        return None

    return result


# ─── Product resolver ─────────────────────────────────────────────────────────

async def _resolve_product_id(raw_name: str) -> int | None:
    """Match a raw product name from invoice to a DB product ID."""
    try:
        products = await get_products()
    except Exception:
        return None
    raw_low = raw_name.lower().replace(' ', '')
    for pat, keyword in PRODUCT_PATTERNS:
        if pat.search(raw_name):
            kw_low = keyword.lower().replace(' ', '')
            # Find product whose name contains the keyword and volume ~19L
            for p in products:
                name_low = p.get('name', '').lower().replace(' ', '')
                vol = float(p.get('volume', 0) or 0)
                if kw_low in name_low and vol >= 18:
                    return p['id']
            # Fallback: any 19L product
            for p in products:
                vol = float(p.get('volume', 0) or 0)
                if vol >= 18:
                    return p['id']
    # Generic: fuzzy name match
    for p in products:
        if p.get('name', '').lower().replace(' ', '') == raw_low:
            return p['id']
    return None


# ─── Core processor ───────────────────────────────────────────────────────────

async def process_invoice(bot: Bot, photo: PhotoSize, reply_to: Message) -> str:
    """OCR + parse + issue. Returns a human-readable result message."""

    text = await _ocr_photo(bot, photo)
    if not text:
        return "❌ Не удалось распознать текст накладной."

    parsed = _parse_invoice(text)
    if not parsed:
        return "❌ Не удалось распознать данные накладной.\n\nРаспознанный текст:\n" + text[:300]

    phone = parsed['courier_phone']
    name = parsed['courier_name'] or 'Неизвестный'
    v_type = parsed['vehicle_type']
    v_plate = parsed['vehicle_plate']

    # Find or create courier
    courier = None
    if phone:
        courier = await get_courier_by_phone(phone)

    created_new = False
    if not courier:
        try:
            courier = await create_courier_from_invoice(
                name=name, phone=phone or '',
                vehicle_type=v_type, vehicle_plate=v_plate,
            )
            created_new = True
            log.info("Created courier from invoice: %s %s", name, phone)
        except Exception as e:
            return f"❌ Ошибка создания курьера: {e}"
    else:
        # Update vehicle info if changed
        needs_update = (
            (v_type and courier.get('vehicle_type') != v_type) or
            (v_plate and courier.get('vehicle_plate') != v_plate)
        )
        if needs_update:
            try:
                await update_courier_vehicle(courier['id'], v_type, v_plate)
                log.info("Updated vehicle for courier %s: %s %s", courier['id'], v_type, v_plate)
            except Exception as e:
                log.warning("Could not update vehicle: %s", e)

    courier_id = courier['id']

    # Resolve product IDs
    issue_items = []
    for it in parsed['items']:
        pid = await _resolve_product_id(it['raw_name'])
        if pid:
            issue_items.append({"product_id": pid, "quantity": it['qty']})
        else:
            return f"❌ Товар не найден: {it['raw_name']}"

    # Backdating
    created_at_iso = None
    if parsed['dt']:
        created_at_iso = parsed['dt'].astimezone(timezone.utc).isoformat()

    # Issue
    try:
        result = await issue_batch(
            courier_id=courier_id,
            items=issue_items,
            bottle_return=parsed['return_qty'],
            performed_by='nakl_bot',
            vehicle_type=v_type,
            vehicle_plate=v_plate,
            created_at=created_at_iso,
        )
    except Exception as e:
        return f"❌ Ошибка выдачи: {e}"

    # Build result text
    dt_str = parsed['dt'].strftime('%d.%m.%Y %H:%M') if parsed['dt'] else '—'
    lines = [f"✅ Выдача выполнена (накладная {dt_str})"]
    lines.append(f"👤 Курьер: {courier.get('name', name)}" + (" (новый)" if created_new else ""))
    if phone:
        lines.append(f"📞 {phone}")
    if v_type or v_plate:
        lines.append(f"🚗 {v_type or ''} {v_plate or ''}".strip())
    if parsed['return_qty'] > 0:
        lines.append(f"♻️ Возврат: {parsed['return_qty']} шт.")
    for it in issue_items:
        lines.append(f"📦 Выдано: {it['quantity']} шт. (товар #{it['product_id']})")

    return '\n'.join(lines)


# ─── Handlers ─────────────────────────────────────────────────────────────────

def _group_id_filter(message: Message) -> bool:
    return bool(settings.INVOICE_GROUP_ID and message.chat.id == settings.INVOICE_GROUP_ID)


@router.message(_group_id_filter, F.photo)
async def handle_group_invoice(message: Message):
    """Auto-process invoice photos posted in the configured group (not by bot itself)."""
    # Skip photos sent by the bot itself to avoid loops
    if message.from_user and message.from_user.is_bot:
        return

    photo = message.photo[-1]  # highest resolution
    result_text = await process_invoice(message.bot, photo, message)
    try:
        await message.reply(result_text)
    except Exception as e:
        log.error("Failed to reply with invoice result: %s", e)


@router.message(Command("testnakl"))
async def cmd_testnakl(message: Message):
    """Admin command: test invoice reading with the last photo in the group."""
    if message.from_user.id not in settings.ADMIN_IDS:
        return

    group_id = settings.INVOICE_GROUP_ID
    if not group_id:
        await message.answer("❌ INVOICE_GROUP_ID не настроен в .env")
        return

    await message.answer("🔍 Читаю последнюю накладную из группы...")

    try:
        # Fetch last messages from group to find a photo
        updates = await message.bot.get_updates(limit=100, timeout=0)
        photo = None
        for upd in reversed(updates):
            m = upd.message
            if m and m.chat.id == group_id and m.photo and not m.from_user.is_bot:
                photo = m.photo[-1]
                break

        if not photo:
            # Try forwarding from group chat history via getChatHistory
            await message.answer("❌ Не найдено фото накладной в последних сообщениях группы.\n\nПроверьте что бот состоит в группе и что INVOICE_GROUP_ID верный.")
            return

        result_text = await process_invoice(message.bot, photo, message)
        await message.answer(result_text)
    except Exception as e:
        log.exception("testnakl error")
        await message.answer(f"❌ Ошибка: {e}")
