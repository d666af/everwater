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
from services.roles import get_all_admin_ids
from services.api_client import (
    create_courier_from_invoice, issue_batch, get_products, factory_issue_batch,
)

log = logging.getLogger(__name__)
router = Router()


class TestNaklState(StatesGroup):
    waiting_for_photo = State()

TZ_UZB = timezone(timedelta(hours=5))

# Product name patterns found in invoices → mapped to keywords for DB lookup
PRODUCT_PATTERNS = [
    (re.compile(r'ever\s*20', re.IGNORECASE), 'EVER'),   # EVER 20л → 19L product
    (re.compile(r'ever\s*19', re.IGNORECASE), 'EVER'),
    (re.compile(r'ever\s*5',  re.IGNORECASE), 'EVER 5'),
]


def _qty_from_price_sum(line_text: str) -> int | None:
    """Derive quantity from price × qty = sum on an invoice row.

    Handles space-grouped numbers like '18 000' (price) and '1 008 000' (sum).
    Returns qty if a valid pair is found and sum / price is an integer in 1-500.
    """
    big = sorted([
        int(m.group().replace(' ', ''))
        for m in re.finditer(r'\b\d{1,4}(?:\s\d{3})+\b|\b\d{5,}\b', line_text)
    ])
    prices = [v for v in big if 1_000 <= v <= 99_999]
    sums   = [v for v in big if v >= 100_000]
    for price in prices:
        for total in sums:
            if total % price == 0:
                qty = total // price
                if 1 <= qty <= 500:
                    return qty
    return None


_VALID_PLATE_RE = re.compile(
    r'\d{2}[A-Z]\d{3}[A-Z]{2}'   # format 1: DD L DDD LL  e.g. 30L700QA
    r'|\d{5}[A-Z]{3}'             # format 2: DD DDD LLL   e.g. 30700QAB
)


def _canonical_plate(raw: str) -> str:
    """Fix common OCR errors in Uzbek plates.

    Supported formats:
      Format 1: DD L DDD LL  (e.g. 30L700QA)
      Format 2: DD DDD LLL   (e.g. 30700QAB)

    OCR reads 'Q' as '0', causing:
      - Format 1: 4-digit middle + 1 trailing letter → restore Q before letter
                  4-digit middle + 2 trailing letters → strip extra 0
      - Format 2: 6 digits + 2 trailing letters → first extra digit was Q
                  6 digits + 3 trailing letters → strip extra 0
    """
    p = raw.upper().strip()
    if _VALID_PLATE_RE.fullmatch(p):
        return p

    # ── Format 1 corrections (DD L DDD LL) ──────────────────────────────────
    # "30L7000A" → last digit of 4-digit group was Q → "30L700QA"
    m = re.fullmatch(r'(\d{2}[A-Z])(\d{4})([A-Z])', p)
    if m:
        candidate = m.group(1) + m.group(2)[:-1] + 'Q' + m.group(3)
        if re.fullmatch(r'\d{2}[A-Z]\d{3}[A-Z]{2}', candidate):
            return candidate
    # "30A1700QB" → extra 0 before letters → strip last digit → "30A170QB"
    m = re.fullmatch(r'(\d{2}[A-Z])(\d{4})([A-Z]{2})', p)
    if m:
        candidate = m.group(1) + m.group(2)[:-1] + m.group(3)
        if re.fullmatch(r'\d{2}[A-Z]\d{3}[A-Z]{2}', candidate):
            return candidate

    # ── Format 2 corrections (DD DDD LLL) ────────────────────────────────────
    # "307000AB" → 6th digit was Q → "30700QAB"
    m = re.fullmatch(r'(\d{5})(\d)([A-Z]{2})', p)
    if m and m.group(2) == '0':
        candidate = m.group(1) + 'Q' + m.group(3)
        if re.fullmatch(r'\d{5}[A-Z]{3}', candidate):
            return candidate
    # "307000QAB" → extra 0 before letters → strip last digit → "30700QAB"
    m = re.fullmatch(r'(\d{6})([A-Z]{3})', p)
    if m:
        candidate = m.group(1)[:-1] + m.group(2)
        if re.fullmatch(r'\d{5}[A-Z]{3}', candidate):
            return candidate

    return p


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
    arr[h_frac > 0.7, :] = 255   # erase horizontal lines
    arr[:, v_frac > 0.7] = 255   # erase vertical lines
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
                # Group by y-position with 30px tolerance so each table row
                # becomes one reconstructed line regardless of column layout
                bucket = (data['top'][idx] // 30) * 30
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
    # 1a. Spaced with country code: "998 99 054 13 30", "998 88 533 11 66", "998 55 ..."
    m = re.search(r'\b998\s+([2-9]\d)\s+(\d{3})\s+(\d{2})\s+(\d{2})\b', raw)
    if m:
        return '+998' + ''.join(m.groups())
    # 1b. Spaced without country code: "99 054 13 30", "88 533 11 66", "55 500 12 34"
    m = re.search(r'\b([2-9]\d)\s+(\d{3})\s+(\d{2})\s+(\d{2})\b', raw)
    if m:
        return '+998' + ''.join(m.groups())
    # 1c. 2+3+4 format: "99 054 1330", "88 533 1166"
    m = re.search(r'\b([2-9]\d)\s+(\d{3})\s+(\d{4})\b', raw)
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
        if sub[0] not in ('0', '1'):
            return '+998' + sub
    # 4. Bare 9-digit Uzbek subscriber number — all operator prefixes
    m = re.search(r'\b((20|50|55|7[0-9]|88|9[0-9])\d{7})\b', raw)
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
        'factory_name': None,
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
            row_has_numbers = bool(re.search(r'\b\d+\b', line))
            if row_has_numbers:
                # Collect all integers ≤500 on the line (strips years/prices/etc.)
                all_nums = [int(n) for n in re.findall(r'\b(\d+)\b', line) if int(n) <= 500]
                # Remove trailing zeros: the Бонус column is always 0 at the right end
                while all_nums and all_nums[-1] == 0:
                    all_nums.pop()
                pos_nums = [n for n in all_nums if n > 0]
                if not pos_nums:
                    result['return_qty'] = 0  # all zeros → no return
                elif len(pos_nums) == 1:
                    result['return_qty'] = pos_nums[0]
                else:
                    # OCR often splits "85" → "8 5" or "46" → "4 6"; concatenate digits
                    combined = int(''.join(str(n) for n in pos_nums))
                    result['return_qty'] = combined if 1 <= combined <= 999 else pos_nums[0]
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
            inline_found = False
            # Prefer price/sum cross-check on current line AND a wider window —
            # price/sum columns may land in adjacent y-buckets (different OCR lines)
            _nearby = ' '.join(lines[max(0, i - 1):i + 4])
            computed_qty = (_qty_from_price_sum(line)
                            or _qty_from_price_sum(_nearby)
                            or _qty_from_price_sum(full))
            if computed_qty:
                found_qty = computed_qty
                inline_found = True
            else:
                for n in re.findall(r'\b(\d+)\b', cleaned):
                    v = int(n)
                    # Skip return_qty — column-scan OCR can interleave rows
                    if 1 <= v <= 500 and v != result['return_qty']:
                        found_qty = v
                        inline_found = True
                        break
            # Cross-validate digit-scanned qty against price/sum (catches OCR digit drops)
            if found_qty and not inline_found:
                val = _qty_from_price_sum(' '.join(lines[max(0, i - 2):i + 6]))
                if val and val != found_qty:
                    found_qty = val
                    inline_found = True
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
                        if 1 <= v <= 500 and v != result['return_qty']:
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
                        if 1 <= v <= 500 and v != result['return_qty']:
                            found_qty = v
                            break
                    if found_qty:
                        break
            if found_qty:
                existing = next((it for it in result['items'] if it['raw_name'] == 'EVER 20л'), None)
                if existing is None:
                    result['items'].append({'raw_name': 'EVER 20л', 'qty': found_qty})
                elif inline_found and found_qty != existing['qty']:
                    existing['qty'] = found_qty

        # ── Courier/Factory row: "получатель  AKMAL  998 99 054 13 30"
        #                   or: "получатель  ZAVOD  MILK VILL" ──────────────
        if 'получатель' in low or re.search(r'poluch', low):
            after = re.split(r'получатель|poluchatel?', line, flags=re.IGNORECASE)[-1].strip()
            # ZAVOD / ЗАВОД as first token → factory delivery, no courier.
            # Allow ZAVOD alone (factory name may be on the next line).
            zavod_m = re.match(r'(?:ZAVOD|ЗАВОД)\s*(.*)', after, re.IGNORECASE)
            if zavod_m:
                factory_part = zavod_m.group(1).strip()
                if factory_part:
                    result['factory_name'] = factory_part
                else:
                    # Factory name is on the next line(s) — column-scan split
                    for nxt in lines[i + 1:i + 4]:
                        if _SECTION_STOP.search(nxt):
                            break
                        nxt_clean = nxt.strip()
                        if nxt_clean:
                            result['factory_name'] = nxt_clean
                            break
            else:
                # Also check if next lines open with ZAVOD (label on its own line)
                is_factory = False
                for j, nxt in enumerate(lines[i + 1:i + 4]):
                    zm = re.match(r'(?:ZAVOD|ЗАВОД)\s*(.*)', nxt.strip(), re.IGNORECASE)
                    if zm:
                        factory_part = zm.group(1).strip()
                        if factory_part:
                            result['factory_name'] = factory_part
                        else:
                            # Factory name one more line down
                            deeper = lines[i + 1 + j + 1:i + 1 + j + 3]
                            for dl in deeper:
                                if dl.strip():
                                    result['factory_name'] = dl.strip()
                                    break
                        is_factory = True
                        break
                    if _SECTION_STOP.search(nxt):
                        break
                if not is_factory:
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

            def _set_plate(raw: str) -> None:
                new = _canonical_plate(raw.upper())
                # Prefer canonical format over what's already stored
                if not result['vehicle_plate'] or _VALID_PLATE_RE.fullmatch(new):
                    result['vehicle_plate'] = new

            if len(parts) >= 2:
                result['vehicle_type'] = parts[0].upper()
                _set_plate(parts[1])
            elif len(parts) == 1:
                p = parts[0].upper()
                if re.search(r'\d', p):
                    # "BONGO 30 138 BCA" → split at first digit: type + plate
                    tp_m = re.match(r'^([A-ZА-ЯЁ][A-ZА-ЯЁ\-]*)\s+(\S.*)$', p)
                    if tp_m and re.search(r'\d', tp_m.group(2)):
                        result['vehicle_type'] = tp_m.group(1)
                        _set_plate(tp_m.group(2))
                    else:
                        _set_plate(p)
                else:
                    result['vehicle_type'] = p
            else:
                # "тип машины" on its own line — grab the next 1-2 non-empty lines
                next_parts = [l.strip() for l in lines[i + 1:i + 3] if l.strip()]
                if len(next_parts) >= 2:
                    result['vehicle_type'] = next_parts[0].upper()
                    _set_plate(next_parts[1])
                elif len(next_parts) == 1:
                    p = next_parts[0].upper()
                    if re.search(r'\d', p):
                        tp_m = re.match(r'^([A-ZА-ЯЁ][A-ZА-ЯЁ\-]*)\s+(\S.*)$', p)
                        if tp_m and re.search(r'\d', tp_m.group(2)):
                            result['vehicle_type'] = tp_m.group(1)
                            _set_plate(tp_m.group(2))
                        else:
                            _set_plate(p)
                    else:
                        result['vehicle_type'] = p

    # Last-resort EVER: "ever" mentioned but no items parsed
    # (column-scan may have put the qty too far from the label for forward search)
    if not result['items'] and re.search(r'\bever\b', full, re.IGNORECASE):
        # First try price/sum cross-check on the full text
        computed_qty = _qty_from_price_sum(full)
        if computed_qty:
            result['items'].append({'raw_name': 'EVER 20л', 'qty': computed_qty})
            log.info("Last-resort EVER qty=%d from price/sum", computed_qty)
        else:
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
            result['vehicle_plate'] = _canonical_plate(plate_m.group(1))
        else:
            sp_m = re.search(r'\b(\d{2,3})\s+(\d{2,4})\s+([A-Z]{2,3})\b', full)
            if sp_m:
                result['vehicle_plate'] = sp_m.group(1) + sp_m.group(2) + sp_m.group(3)

    # Last-resort vehicle type
    if result['vehicle_plate'] and not result['vehicle_type']:
        type_m = re.search(r'\b([A-Z]{3,8})\b', full)
        if type_m and type_m.group(1) not in {'EVER', 'BCA'}:
            result['vehicle_type'] = type_m.group(1)

    # Last-resort factory: ZAVOD anywhere in full text (handles OCR column order issues)
    if not result['factory_name'] and not result['courier_name'] and not result['courier_phone']:
        zm_full = re.search(r'\b(?:ZAVOD|ЗАВОД)\s+([A-ZА-ЯЁa-zа-яё][^\n\d]{1,30})', full, re.IGNORECASE)
        if zm_full:
            result['factory_name'] = zm_full.group(1).strip()

    if not result['factory_name'] and not result['courier_phone'] and not result['courier_name']:
        log.warning("Invoice parse: no courier or factory info found in:\n%s", text[:400])
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

async def process_invoice(bot: Bot, photo: PhotoSize, reply_to: Message, performed_by: str = 'nakl_bot') -> str:
    """OCR + parse + issue. Returns a human-readable result message."""

    text = await _ocr_photo(bot, photo)
    if not text:
        return "❌ Не удалось распознать текст накладной."

    parsed = _parse_invoice(text)
    if not parsed:
        return "❌ Не удалось распознать данные накладной.\n\nРаспознанный текст:\n" + text[:300]

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

    api_items = [{"product_id": it["product_id"], "quantity": it["quantity"]} for it in issue_items]
    dt_str = parsed['dt'].strftime('%d.%m.%Y %H:%M') if parsed['dt'] else '—'

    # ── Factory delivery ──────────────────────────────────────────────────────
    if parsed['factory_name']:
        factory_name = parsed['factory_name']
        try:
            await factory_issue_batch(
                factory_name=factory_name,
                items=api_items,
                performed_by=performed_by,
                created_at=created_at_iso,
            )
        except Exception as e:
            return f"❌ Ошибка выдачи заводу: {e}"

        lines = [f"✅ Выдача заводу выполнена (накладная {dt_str})"]
        lines.append(f"🏭 Завод: {factory_name}")
        for it in issue_items:
            prod_label = it.get('_name') or f"товар #{it['product_id']}"
            lines.append(f"📦 Выдано: {it['quantity']} шт. ({prod_label})")
        if not issue_items and re.search(r'\bever\b', text, re.IGNORECASE):
            lines.append("⚠️ EVER не распознан — проверьте и добавьте вручную")
        return '\n'.join(lines)

    # ── Courier delivery ──────────────────────────────────────────────────────
    phone = parsed['courier_phone']
    name = parsed['courier_name'] or 'Неизвестный'
    v_type = parsed['vehicle_type']
    v_plate = parsed['vehicle_plate']

    try:
        courier = await create_courier_from_invoice(
            name=name, phone=phone or '',
            vehicle_type=v_type, vehicle_plate=v_plate,
        )
    except Exception as e:
        return f"❌ Ошибка создания/поиска курьера: {e}"

    created_new = not courier.get('telegram_id')
    courier_id = courier['id']

    try:
        await issue_batch(
            courier_id=courier_id,
            items=api_items,
            bottle_return=parsed['return_qty'],
            performed_by=performed_by,
            vehicle_type=v_type,
            vehicle_plate=v_plate,
            created_at=created_at_iso,
        )
    except Exception as e:
        return f"❌ Ошибка выдачи: {e}"

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
    """Auto-process invoice photos posted in the configured group.

    Does NOT reply in the group. Sends the result privately to all ADMIN_IDS.
    The warehouse transaction is recorded with performed_by='Группа накладных'.
    """
    if message.from_user and message.from_user.is_bot:
        return

    photo = message.photo[-1]
    result_text = await process_invoice(
        message.bot, photo, message, performed_by='Группа накладных'
    )
    for admin_id in get_all_admin_ids():
        try:
            await message.bot.send_message(admin_id, result_text)
        except Exception as e:
            log.error("Failed to notify admin %s about group invoice: %s", admin_id, e)


@router.message(_group_id_filter)
async def handle_group_silence(message: Message):
    """Silently drop ALL non-photo messages from the invoice group."""
    pass  # prevents start/client/etc. routers from ever seeing group messages


@router.message(Command("testnakl"))
async def cmd_testnakl(message: Message, state: FSMContext):
    """Admin command: send a photo of an invoice to OCR and issue it manually."""
    if message.from_user.id not in get_all_admin_ids():
        return
    await message.answer("📸 Отправьте фото накладной:")
    await state.set_state(TestNaklState.waiting_for_photo)


@router.message(TestNaklState.waiting_for_photo, F.photo)
async def cmd_testnakl_photo(message: Message, state: FSMContext):
    """Process photo sent by admin via /testnakl."""
    await state.clear()
    photo = message.photo[-1]
    try:
        result_text = await process_invoice(message.bot, photo, message)
        await message.answer(result_text)
    except Exception as e:
        log.exception("testnakl photo error")
        await message.answer(f"❌ Ошибка: {e}")
