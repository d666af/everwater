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
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message, PhotoSize

from config import settings
from services.api_client import (
    get_courier_by_phone, create_courier_from_invoice,
    update_courier_vehicle, issue_batch, get_products,
)

log = logging.getLogger(__name__)
router = Router()

# Stores the last invoice photo file_id received from the group (for /testnakl)
_last_photo_file_id: str | None = None
_last_photo_file_unique_id: str | None = None


class TestNaklState(StatesGroup):
    waiting_for_photo = State()

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

        img = Image.open(bio)

        # Upscale to ~3000px on the longest side
        w, h = img.size
        target = 3000
        if max(w, h) < target:
            scale = target / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        img = img.convert('L')
        img = img.filter(ImageFilter.SHARPEN)
        img = ImageEnhance.Contrast(img).enhance(2.0)

        # Run two PSM modes and merge unique lines.
        # PSM 6 (uniform block) and PSM 11 (sparse) catch different rows in tables —
        # each misses what the other finds, so combining gives full coverage.
        seen: set[str] = set()
        combined: list[str] = []
        for psm in (6, 11):
            t = pytesseract.image_to_string(img, lang='rus+eng', config=f'--psm {psm} --oem 3')
            for line in t.splitlines():
                line = line.strip()
                if line and line not in seen:
                    seen.add(line)
                    combined.append(line)

        text = '\n'.join(combined)
        log.info("OCR result (PSM6+PSM11):\n%s", text)
        return text
    except Exception as e:
        log.error("OCR error: %s", e)
        return ""


# ─── Parser ───────────────────────────────────────────────────────────────────

def _normalize_phone(raw: str) -> str | None:
    digits = re.sub(r'[^\d]', '', raw)
    # 1. Exact match: 998 + 9 digits
    m = re.search(r'998(\d{9})', digits)
    if m:
        return '+998' + m.group(1)
    # 2. OCR sometimes garbles the first digit(s) of "998", producing e.g. "98990541330"
    #    (11 digits instead of 12). Take last 9 digits of any ≥11-digit block as
    #    the subscriber number — Uzbek numbers always end in 9 digits after 998.
    for block in re.findall(r'\d{11,}', digits):
        sub = block[-9:]
        if sub[0] == '9':   # Uzbek mobile subscriber part starts with 9
            return '+998' + sub
    return None


def _parse_invoice(text: str) -> dict | None:
    if not text or len(text) < 10:
        return None

    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    full = ' '.join(lines)  # also search the whole text for scattered tokens

    result = {
        'dt': None,
        'return_qty': 0,
        'items': [],
        'courier_phone': None,
        'courier_name': None,
        'vehicle_type': None,
        'vehicle_plate': None,
    }

    # Date DD.MM.YYYY and time HH:MM:SS anywhere in the text
    date_m = re.search(r'(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})', full)
    time_m = re.search(r'(\d{1,2}):(\d{2})(?::(\d{2}))?', full)
    if date_m and time_m:
        try:
            d, mo, y = int(date_m.group(1)), int(date_m.group(2)), int(date_m.group(3))
            h, mi = int(time_m.group(1)), int(time_m.group(2))
            sec = int(time_m.group(3) or 0)
            result['dt'] = datetime(y, mo, d, h, mi, sec, tzinfo=TZ_UZB)
        except Exception:
            pass

    # Phone: try exact 998-format anywhere in full text first
    phone_m = re.search(r'998[\s\-]?\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}', full)
    if phone_m:
        result['courier_phone'] = _normalize_phone(phone_m.group())

    for line in lines:
        low = line.lower()

        # Return row: "возврат  Шт  <qty>  0"
        if 'возврат' in low or 'vozvrat' in low:
            nums = re.findall(r'\b(\d+)\b', line)
            for n in nums:
                v = int(n)
                if 0 < v < 500:
                    result['return_qty'] = v
                    break

        # Product row: "EVER 20л  Шт  <qty>  0  18 000  576 000"
        # qty = first number 1..500 (excludes prices like 18000, 576000)
        elif re.search(r'\bever\b', low) and not re.search(r'наименование|header', low):
            nums = re.findall(r'\b(\d+)\b', line)
            for n in nums:
                v = int(n)
                if 1 <= v <= 500:
                    result['items'].append({'raw_name': 'EVER 20л', 'qty': v})
                    break

        # Courier row: "получатель  AKMAL  998 99 054 13 30"
        if 'получатель' in low or re.search(r'poluch', low):
            # Name: first sequence of ≥2 uppercase letters after the keyword
            # (tolerates OCR noise like leading "|" or "—")
            after = re.split(r'получатель|poluchatel?', line, flags=re.IGNORECASE)[-1]
            name_m = re.search(r'[А-ЯЁA-Z]{2,}', after)
            if name_m:
                result['courier_name'] = name_m.group(0)
            if not result['courier_phone']:
                ph = _normalize_phone(line)
                if ph:
                    result['courier_phone'] = ph

        # Vehicle row: "тип машины  LABO  30L700QA"
        if ('тип' in low and 'маш' in low) or re.search(r'tip\s+ma', low):
            tokens = re.sub(r'тип\s*машины?|тип|маш\w*|tip\s*ma\w*', '', line, flags=re.IGNORECASE)
            parts = [p.strip() for p in re.split(r'\s{2,}|\s*\|\s*|\t', tokens) if p.strip()]
            if len(parts) >= 2:
                result['vehicle_type'] = parts[0].upper()
                result['vehicle_plate'] = parts[1].upper()
            elif len(parts) == 1:
                p = parts[0].upper()
                if re.search(r'\d', p):
                    result['vehicle_plate'] = p
                else:
                    result['vehicle_type'] = p

    # Last-resort phone: scan every line individually
    if not result['courier_phone']:
        for line in lines:
            ph = _normalize_phone(line)
            if ph:
                result['courier_phone'] = ph
                break

    # Last-resort vehicle plate: look for pattern like "30L700QA" anywhere
    if not result['vehicle_plate']:
        plate_m = re.search(r'\b(\d{2,3}[A-Z]{1,3}\d{2,4}[A-Z]{1,3})\b', full)
        if plate_m:
            result['vehicle_plate'] = plate_m.group(1)

    # Last-resort vehicle type: look for LABO / NEXIA / COBALT etc.
    # Only if we already found a plate (to avoid false positives)
    if result['vehicle_plate'] and not result['vehicle_type']:
        type_m = re.search(r'\b([A-Z]{3,8})\b', full)
        if type_m and type_m.group(1) not in ('EVER', 'ШТ', 'EVER20'):
            result['vehicle_type'] = type_m.group(1)

    if not result['courier_phone'] and not result['courier_name']:
        log.warning("Invoice parse: no courier info found in:\n%s", text[:400])
        return None
    if not result['items'] and result['return_qty'] == 0:
        log.warning("Invoice parse: no items and no return in:\n%s", text[:400])
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
    global _last_photo_file_id, _last_photo_file_unique_id
    if message.from_user and message.from_user.is_bot:
        return

    photo = message.photo[-1]
    # Remember this photo for /testnakl
    _last_photo_file_id = photo.file_id
    _last_photo_file_unique_id = photo.file_unique_id

    result_text = await process_invoice(message.bot, photo, message)
    try:
        await message.reply(result_text)
    except Exception as e:
        log.error("Failed to reply with invoice result: %s", e)


@router.message(_group_id_filter)
async def handle_group_silence(message: Message):
    """Silently drop ALL non-photo messages from the invoice group."""
    pass  # prevents start/client/etc. routers from ever seeing group messages


@router.message(Command("testnakl"))
async def cmd_testnakl(message: Message, state: FSMContext):
    """Admin command: test invoice OCR. Uses last stored group photo or asks to send one."""
    if message.from_user.id not in settings.ADMIN_IDS:
        return

    if not settings.INVOICE_GROUP_ID:
        await message.answer("❌ INVOICE_GROUP_ID не настроен в .env")
        return

    if _last_photo_file_id:
        await message.answer("🔍 Тестирую последнюю накладную из группы...")
        photo = PhotoSize(
            file_id=_last_photo_file_id,
            file_unique_id=_last_photo_file_unique_id or '',
            width=0, height=0,
        )
        try:
            result_text = await process_invoice(message.bot, photo, message)
            await message.answer(result_text)
        except Exception as e:
            log.exception("testnakl error")
            await message.answer(f"❌ Ошибка: {e}")
    else:
        await message.answer(
            "📸 Нет сохранённых фото из группы.\n\n"
            "Отправьте фото накладной сюда — распознаю его:"
        )
        await state.set_state(TestNaklState.waiting_for_photo)


@router.message(TestNaklState.waiting_for_photo, F.photo)
async def cmd_testnakl_photo(message: Message, state: FSMContext):
    """Process photo sent by admin for manual /testnakl test."""
    await state.clear()
    photo = message.photo[-1]
    await message.answer("🔍 Распознаю накладную...")
    try:
        result_text = await process_invoice(message.bot, photo, message)
        await message.answer(result_text)
    except Exception as e:
        log.exception("testnakl photo error")
        await message.answer(f"❌ Ошибка: {e}")
