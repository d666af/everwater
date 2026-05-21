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
    create_courier_from_invoice, issue_batch, get_products,
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

def _remove_grid_lines(img):
    """Clear table grid lines so cell contents become isolated text.
    Thin black borders span the full width/height (≈100% dark along the line),
    while text rows are <30% dark — so rows/cols that are mostly dark are lines."""
    try:
        import numpy as np
        from PIL import Image
    except ImportError:
        return img
    arr = np.array(img).astype(np.uint8)
    if arr.ndim != 2:
        return img
    dark = arr < 100
    h_frac = dark.mean(axis=1)   # dark fraction per row
    v_frac = dark.mean(axis=0)   # dark fraction per column
    arr[h_frac > 0.5, :] = 255   # erase horizontal lines
    arr[:, v_frac > 0.5] = 255   # erase vertical lines
    return Image.fromarray(arr)


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
        img = ImageEnhance.Contrast(img).enhance(1.5)
        # Strip grid lines so numbers in narrow cells become readable
        img = _remove_grid_lines(img)
        img = img.filter(ImageFilter.SHARPEN)

        seen: set[str] = set()
        combined: list[str] = []

        # Pass 1+2: image_to_string with PSM 6 and PSM 11
        for psm in (6, 11):
            t = pytesseract.image_to_string(img, lang='rus+eng', config=f'--psm {psm} --oem 3')
            for line in t.splitlines():
                line = line.strip()
                if line and line not in seen:
                    seen.add(line)
                    combined.append(line)

        # Pass 3: image_to_data (word-level bounding boxes) — catches words that
        # image_to_string drops due to multi-column table layout confusion.
        # Also reconstructs table rows by y-position (40px buckets) to fix
        # column-scan output where qty column appears separately from name column.
        try:
            data = pytesseract.image_to_data(
                img, lang='rus+eng', config='--psm 11 --oem 3',
                output_type=pytesseract.Output.DICT,
            )
            word_lines: dict[tuple, list] = {}
            y_groups: dict[int, list] = {}
            for idx, word in enumerate(data['text']):
                word = word.strip()
                if not word or int(data['conf'][idx]) < 0:
                    continue
                key = (data['block_num'][idx], data['par_num'][idx], data['line_num'][idx])
                word_lines.setdefault(key, []).append((data['left'][idx], word))
                # Group by y-position with 60px tolerance so each table row
                # becomes one reconstructed line regardless of column layout
                bucket = (data['top'][idx] // 60) * 60
                y_groups.setdefault(bucket, []).append((data['left'][idx], word))
            for key in sorted(word_lines):
                line = ' '.join(w for _, w in sorted(word_lines[key]))
                if line not in seen:
                    seen.add(line)
                    combined.append(line)
            # Y-based row grouping: each entry is a full table row (all columns)
            for bucket in sorted(y_groups):
                line = ' '.join(w for _, w in sorted(y_groups[bucket]))
                if line not in seen:
                    seen.add(line)
                    combined.append(line)
        except Exception as e:
            log.warning("image_to_data pass failed: %s", e)

        text = '\n'.join(combined)
        log.info("OCR result:\n%s", text)
        return text
    except Exception as e:
        log.error("OCR error: %s", e)
        return ""


# ─── Parser ───────────────────────────────────────────────────────────────────

def _normalize_phone(raw: str) -> str | None:
    # 1a. Spaced with country code: "998 99 054 13 30" or "998 88 533 11 66"
    m = re.search(r'\b998\s+([89]\d)\s+(\d{3})\s+(\d{2})\s+(\d{2})\b', raw)
    if m:
        return '+998' + ''.join(m.groups())
    # 1b. Spaced without country code: "99 054 13 30" or "88 533 11 66"
    m = re.search(r'\b([89]\d)\s+(\d{3})\s+(\d{2})\s+(\d{2})\b', raw)
    if m:
        return '+998' + ''.join(m.groups())
    # 1c. 2+3+4 format: "99 054 1330" or "88 533 1166"
    m = re.search(r'\b([89]\d)\s+(\d{3})\s+(\d{4})\b', raw)
    if m:
        return '+998' + ''.join(m.groups())
    # 2. Compact with country code: 998 + 9 consecutive digits
    digits = re.sub(r'[^\d]', '', raw)
    m = re.search(r'998(\d{9})', digits)
    if m:
        return '+998' + m.group(1)
    # 3. OCR drops a leading digit from "998" → 11-digit garbled block
    for block in re.findall(r'\d{11,}', digits):
        sub = block[-9:]
        if sub[0] in ('8', '9'):
            return '+998' + sub
    # 4. Bare 9-digit Uzbek subscriber number (valid operator prefixes incl. UzMobile 88)
    m = re.search(r'\b(9[01345789]\d{7}|88\d{7})\b', raw)
    if m:
        return '+998' + m.group(1)
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

    # Phone anywhere in the full text (spaced Uzbek format first)
    ph = _normalize_phone(full)
    if ph:
        result['courier_phone'] = ph

    # Matches "Aziz" (Capitalized) and "AKMAL" (ALL-CAPS), not "шт" (lowercase)
    _NAME_RE = re.compile(r'\b([A-ZА-ЯЁ][a-zа-яё]{1,}|[A-ZА-ЯЁ]{2,})\b')
    _SECTION_STOP = re.compile(r'тип\s*маш|итого|возврат|\d{5,}', re.IGNORECASE)

    for i, line in enumerate(lines):
        low = line.lower()

        # ── Return row: "возврат  Шт  <qty>  0" ─────────────────────────────
        if 'возврат' in low or 'vozvrat' in low:
            # If the row has ANY numbers, use them (0 on the row means qty=0)
            row_has_numbers = bool(re.search(r'\b\d+\b', line))
            for n in re.findall(r'\b(\d+)\b', line):
                v = int(n)
                if 0 <= v < 500:  # include 0 — explicit "0" on row is the answer
                    result['return_qty'] = v
                    break
            # Only do backward/forward search when the row has NO numbers at all
            # (column-scan split the qty to a separate line)
            if not row_has_numbers:
                for prev in reversed(lines[max(0, i - 3):i]):
                    if re.search(r'ever|наимен|итого|получатель|тип\s*маш', prev, re.IGNORECASE):
                        break
                    if re.search(r'\d{1,2}[.:]\d{2}', prev):
                        continue
                    cleaned_prev = re.sub(r'\d+\s*л', '', prev, flags=re.IGNORECASE).strip()
                    if not cleaned_prev:
                        continue
                    for n in re.findall(r'\b(\d+)\b', cleaned_prev):
                        v = int(n)
                        if 0 < v < 500:
                            result['return_qty'] = v
                            break
                    if result['return_qty']:
                        break
                if result['return_qty'] == 0:
                    for nxt in lines[i + 1:i + 5]:
                        if re.search(r'ever|наимен|итого|получатель|тип\s*маш', nxt, re.IGNORECASE):
                            break
                        if re.search(r'\d{1,2}[.:]\d{2}', nxt):
                            continue
                        cleaned_nxt = re.sub(r'\d+\s*л', '', nxt, flags=re.IGNORECASE).strip()
                        if not cleaned_nxt or re.fullmatch(r'[а-яёa-zA-ZА-ЯЁ\s]+', cleaned_nxt):
                            continue
                        for n in re.findall(r'\b(\d+)\b', cleaned_nxt):
                            v = int(n)
                            if 0 < v < 500:
                                result['return_qty'] = v
                                break
                        if result['return_qty']:
                            break

        # ── Product row: "EVER 20л  Шт  <qty>  0  18 000  576 000" ──────────
        # Require a digit or "шт" on the line — bare "EVER" section headers have
        # neither and would otherwise duplicate the item from the real product row.
        elif (re.search(r'\bever\b', low)
              and re.search(r'\d|шт\b', low)
              and not re.search(r'наименование|header', low)):
            # Strip volume annotations ("20л") so they don't look like quantities
            cleaned = re.sub(r'\d+\s*л', '', line, flags=re.IGNORECASE)
            found_qty = None
            for n in re.findall(r'\b(\d+)\b', cleaned):
                v = int(n)
                if 1 <= v <= 500:
                    found_qty = v
                    break
            # OCR column-scan puts the qty BEFORE the product-name line.
            # "возврат" label line is skipped (continue) rather than stopped
            # so we can look past it to the qty that lies further back.
            if not found_qty:
                for prev in reversed(lines[max(0, i - 3):i]):
                    if re.search(r'наимен|итого|получатель|тип\s*маш', prev, re.IGNORECASE):
                        break
                    if re.search(r'возврат', prev, re.IGNORECASE):
                        continue  # skip the label, keep looking for the number
                    # Skip date/time lines
                    if re.search(r'\d{1,2}[.:]\d{2}', prev):
                        continue
                    # Strip volume annotations before extracting qty
                    cleaned_prev = re.sub(r'\d+\s*л', '', prev, flags=re.IGNORECASE).strip()
                    if not cleaned_prev:
                        continue
                    for n in re.findall(r'\b(\d+)\b', cleaned_prev):
                        v = int(n)
                        if 1 <= v <= 500:
                            found_qty = v
                            break
                    if found_qty:
                        break
            # Forward search: qty may appear after the name row in column-scan
            # Use a wide window (15 lines) because the qty column may be far after
            # the name column in column-scan output
            if not found_qty:
                for nxt in lines[i + 1:i + 15]:
                    if re.search(r'наимен|получатель|тип\s*маш', nxt, re.IGNORECASE):
                        break
                    if re.search(r'ever', nxt, re.IGNORECASE):
                        break  # next product row
                    if re.search(r'\d{1,2}[.:]\d{2}', nxt):
                        continue
                    # Skip "Итого:" lines but don't stop — qty col may follow
                    if re.search(r'итого', nxt, re.IGNORECASE) and not re.search(r'\d', nxt):
                        continue
                    cleaned_nxt = re.sub(r'\d+\s*л', '', nxt, flags=re.IGNORECASE).strip()
                    if not cleaned_nxt or re.fullmatch(r'[а-яёa-zA-ZА-ЯЁ\s]+', cleaned_nxt):
                        continue
                    for n in re.findall(r'\b(\d+)\b', cleaned_nxt):
                        v = int(n)
                        if 1 <= v <= 500:
                            found_qty = v
                            break
                    if found_qty:
                        break
            if found_qty:
                # Deduplicate: only add if no EVER item with same qty already recorded
                already = any(it['raw_name'] == 'EVER 20л' for it in result['items'])
                if not already:
                    result['items'].append({'raw_name': 'EVER 20л', 'qty': found_qty})

        # ── Courier row: "получатель  AKMAL  998 99 054 13 30" ──────────────
        if 'получатель' in low or re.search(r'poluch', low):
            after = re.split(r'получатель|poluchatel?', line, flags=re.IGNORECASE)[-1]
            name_m = _NAME_RE.search(after)
            if name_m:
                result['courier_name'] = name_m.group(0)
            else:
                # Name may be on the next line(s) when OCR splits label and value
                for nxt in lines[i + 1:i + 4]:
                    if _SECTION_STOP.search(nxt):
                        break
                    nm = _NAME_RE.search(nxt)
                    if nm:
                        result['courier_name'] = nm.group(0)
                        break
            if not result['courier_phone']:
                ph2 = _normalize_phone(line)
                if ph2:
                    result['courier_phone'] = ph2
                else:
                    for nxt in lines[i + 1:i + 5]:
                        ph2 = _normalize_phone(nxt)
                        if ph2:
                            result['courier_phone'] = ph2
                            break

        # ── Vehicle row: "тип машины  LABO  30L700QA" ───────────────────────
        if ('тип' in low and 'маш' in low) or re.search(r'tip\s+ma', low):
            tokens = re.sub(r'тип\s*машины?|тип|маш\w*|tip\s*ma\w*', '', line, flags=re.IGNORECASE)
            parts = [p.strip() for p in re.split(r'\s{2,}|\s*\|\s*|\t', tokens) if p.strip()]
            if len(parts) >= 2:
                result['vehicle_type'] = parts[0].upper()
                result['vehicle_plate'] = parts[1].upper()
            elif len(parts) == 1:
                p = parts[0].upper()
                if re.search(r'\d', p):
                    # "BONGO 30 138 BCA" → split at first digit: type + plate
                    tp_m = re.match(r'^([A-ZА-ЯЁ][A-ZА-ЯЁ\-]*)\s+(\S.*)$', p)
                    if tp_m and re.search(r'\d', tp_m.group(2)):
                        result['vehicle_type'] = tp_m.group(1)
                        result['vehicle_plate'] = tp_m.group(2)
                    else:
                        result['vehicle_plate'] = p
                else:
                    result['vehicle_type'] = p
            else:
                # "тип машины" on its own line — grab the next 1-2 non-empty lines
                next_parts = [l.strip() for l in lines[i + 1:i + 3] if l.strip()]
                if len(next_parts) >= 2:
                    result['vehicle_type'] = next_parts[0].upper()
                    result['vehicle_plate'] = next_parts[1].upper()
                elif len(next_parts) == 1:
                    p = next_parts[0].upper()
                    if re.search(r'\d', p):
                        tp_m = re.match(r'^([A-ZА-ЯЁ][A-ZА-ЯЁ\-]*)\s+(\S.*)$', p)
                        if tp_m and re.search(r'\d', tp_m.group(2)):
                            result['vehicle_type'] = tp_m.group(1)
                            result['vehicle_plate'] = tp_m.group(2)
                        else:
                            result['vehicle_plate'] = p
                    else:
                        result['vehicle_type'] = p

    # Last-resort EVER: "ever" mentioned but no items parsed
    # (column-scan may have put the qty too far from the label for forward search)
    if not result['items'] and re.search(r'\bever\b', full, re.IGNORECASE):
        # Strip prices (4+ digit numbers), dates, times, volume annotations
        scan_text = re.sub(r'\d{4,}', '', full)
        scan_text = re.sub(r'\d{1,2}[.:]\d{2}(:\d{2})?', '', scan_text)
        scan_text = re.sub(r'\d{1,2}[./]\d{2}[./]\d{4}', '', scan_text)
        scan_text = re.sub(r'\d+\s*л', '', scan_text, flags=re.IGNORECASE)
        candidates = [int(n) for n in re.findall(r'\b(\d{1,3})\b', scan_text)
                      if 1 <= int(n) <= 500]
        if candidates:
            # Prefer a value different from return_qty; fallback to any
            qty = next((n for n in candidates if n != result['return_qty']), candidates[0])
            result['items'].append({'raw_name': 'EVER 20л', 'qty': qty})
            log.info("Last-resort EVER qty=%d from text scan", qty)

    # Last-resort phone: scan every line individually
    if not result['courier_phone']:
        for line in lines:
            ph = _normalize_phone(line)
            if ph:
                result['courier_phone'] = ph
                break

    # Last-resort vehicle plate: compact "30L700QA" then spaced "30 138 BCA"
    if not result['vehicle_plate']:
        plate_m = re.search(r'\b(\d{2,3}[A-Z]{1,3}\d{2,4}[A-Z]{1,3})\b', full)
        if plate_m:
            result['vehicle_plate'] = plate_m.group(1)
        else:
            sp_m = re.search(r'\b(\d{2,3})\s+(\d{2,4})\s+([A-Z]{2,3})\b', full)
            if sp_m:
                result['vehicle_plate'] = sp_m.group(1) + sp_m.group(2) + sp_m.group(3)

    # Last-resort vehicle type
    if result['vehicle_plate'] and not result['vehicle_type']:
        type_m = re.search(r'\b([A-Z]{3,8})\b', full)
        if type_m and type_m.group(1) not in {'EVER', 'BCA'}:
            result['vehicle_type'] = type_m.group(1)

    if not result['courier_phone'] and not result['courier_name']:
        log.warning("Invoice parse: no courier info found in:\n%s", text[:400])
        return None
    if not result['items'] and result['return_qty'] == 0:
        log.warning("Invoice parse: no items and no return in:\n%s", text[:400])
        return None

    return result


# ─── Product resolver ─────────────────────────────────────────────────────────

def _resolve_product_id_from_list(raw_name: str, products: list) -> int | None:
    """Match a raw product name from invoice to a DB product ID using pre-fetched list."""
    raw_low = raw_name.lower().replace(' ', '')
    for pat, keyword in PRODUCT_PATTERNS:
        if pat.search(raw_name):
            kw_low = keyword.lower().replace(' ', '')
            for p in products:
                name_low = p.get('name', '').lower().replace(' ', '')
                vol = float(p.get('volume', 0) or 0)
                if kw_low in name_low and vol >= 18:
                    return p['id']
            for p in products:
                vol = float(p.get('volume', 0) or 0)
                if vol >= 18:
                    return p['id']
    for p in products:
        if p.get('name', '').lower().replace(' ', '') == raw_low:
            return p['id']
    return None


async def _resolve_product_id(raw_name: str) -> int | None:
    """Match a raw product name from invoice to a DB product ID."""
    try:
        products = await get_products()
    except Exception:
        return None
    return _resolve_product_id_from_list(raw_name, products)


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

    # Find or create courier (backend deduplicates by phone then by name)
    try:
        courier = await create_courier_from_invoice(
            name=name, phone=phone or '',
            vehicle_type=v_type, vehicle_plate=v_plate,
        )
    except Exception as e:
        return f"❌ Ошибка создания/поиска курьера: {e}"

    # Created new if the courier has no telegram_id (was created from invoice, not registered)
    created_new = not courier.get('telegram_id')

    courier_id = courier['id']

    # Resolve product IDs (one products fetch for all items)
    try:
        products = await get_products() or []
    except Exception:
        products = []
    pid_to_name = {p['id']: p['name'] for p in products}
    issue_items = []
    for it in parsed['items']:
        pid = _resolve_product_id_from_list(it['raw_name'], products)
        if pid:
            issue_items.append({
                "product_id": pid,
                "quantity": it['qty'],
                "_name": pid_to_name.get(pid, it['raw_name']),
            })
        else:
            return f"❌ Товар не найден: {it['raw_name']}"

    # Backdating
    created_at_iso = None
    if parsed['dt']:
        created_at_iso = parsed['dt'].astimezone(timezone.utc).isoformat()

    # Issue (strip internal _name field before sending to API)
    api_items = [{"product_id": it["product_id"], "quantity": it["quantity"]} for it in issue_items]
    try:
        result = await issue_batch(
            courier_id=courier_id,
            items=api_items,
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
        prod_label = it.get('_name') or f"товар #{it['product_id']}"
        lines.append(f"📦 Выдано: {it['quantity']} шт. ({prod_label})")
    if not issue_items and re.search(r'\bever\b', text, re.IGNORECASE):
        lines.append("⚠️ EVER не распознан — проверьте и добавьте вручную")

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
