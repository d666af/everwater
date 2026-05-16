"""Warehouse invoice (накладная) PNG generator — matches reference layout."""
from __future__ import annotations
from datetime import datetime
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


# Reference design colours
WHITE       = (255, 255, 255)
GREEN       = (147, 196, 90)     # brand header band
BORDER      = (200, 200, 200)
TEXT        = (40, 40, 40)
TEXT_MUTED  = (110, 110, 110)
TOTAL_BG    = (245, 248, 240)


def _find_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Return a Cyrillic-capable PIL font."""
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if bold else
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"
            if bold else
        "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _measure(draw: ImageDraw.ImageDraw, text: str, font) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def _fmt_money(n) -> str:
    try:
        v = int(round(float(n)))
    except Exception:
        return str(n)
    s = f"{v:,}".replace(",", " ")
    return s


def generate_invoice_png(
    items: list[dict],          # [{name, unit, qty, bonus, price, sum}]
    courier_name: str,
    courier_phone: str | None,
    vehicle_type: str | None,
    vehicle_plate: str | None,
    when: datetime | None = None,
    brand: str = "EVER",
) -> bytes:
    """Render the warehouse invoice as PNG bytes.

    Layout (top → bottom):
        [time]                  [date]
        Наименование |  | Кол-во | Бонус | Цена | Сумма          ← header row
        ──────────  green  brand  band  ──────────
        item1 row …
        item2 row …
        Итого:                                          [grand_total]
        получатель  | name           | phone
        тип машины  | vehicle_type   | vehicle_plate
    """
    when = when or datetime.now()

    # ── Layout constants ──────────────────────────────────────────────
    W = 1100                     # canvas width (px)
    PAD_X = 30                   # horizontal padding inside the card
    ROW_H = 56
    HDR_H = 50
    BRAND_H = 56
    TOP_INFO_H = 70
    FOOT_ROW_H = 56

    # Column widths (must sum to W - 2*PAD_X)
    INNER_W = W - 2 * PAD_X
    # Наименование | unit | Кол-во | Бонус | Цена | Сумма
    COL_W = [int(INNER_W * f) for f in (0.30, 0.10, 0.13, 0.13, 0.16, 0.18)]
    # Round-correction for the last column
    COL_W[-1] = INNER_W - sum(COL_W[:-1])

    # Fonts
    f_time     = _find_font(24, bold=False)
    f_time_it  = _find_font(24, bold=False)
    f_date     = _find_font(28, bold=True)
    f_hdr      = _find_font(22, bold=False)
    f_brand    = _find_font(28, bold=True)
    f_cell     = _find_font(24, bold=False)
    f_cell_b   = _find_font(24, bold=True)
    f_total_l  = _find_font(24, bold=False)
    f_total_v  = _find_font(28, bold=True)
    f_foot_l   = _find_font(20, bold=False)
    f_foot_v   = _find_font(22, bold=True)

    # ── Compute total height first ────────────────────────────────────
    total_h = (
        TOP_INFO_H
        + HDR_H
        + BRAND_H
        + ROW_H * len(items)
        + ROW_H            # Итого row
        + FOOT_ROW_H * 2   # получатель + тип машины
    )
    H = total_h + 30  # bottom padding

    img = Image.new("RGB", (W, H), WHITE)
    draw = ImageDraw.Draw(img)

    y = 15  # current Y position

    # ── Top info: time on left, date on right ─────────────────────────
    time_str = when.strftime("%H:%M:%S")
    date_str = when.strftime("%d.%m.%Y")
    draw.text((PAD_X, y + 18), time_str, font=f_time_it, fill=TEXT)
    dw, _ = _measure(draw, date_str, f_date)
    draw.text(((W - dw) // 2, y + 16), date_str, font=f_date, fill=TEXT)
    # Draw bottom border under top info
    y += TOP_INFO_H
    draw.line([(PAD_X, y), (W - PAD_X, y)], fill=BORDER, width=2)

    # ── Column headers (no left col label "Наименование" appears with empty 2nd col) ──
    headers = ["Наименование", "", "Кол-во", "Бонус", "Цена", "Сумма"]
    y_top = y
    x = PAD_X
    for i, (h, w) in enumerate(zip(headers, COL_W)):
        # Vertical separators
        if i > 0:
            draw.line([(x, y_top), (x, y_top + HDR_H)], fill=BORDER, width=1)
        # Centered label
        if h:
            lw, lh = _measure(draw, h, f_hdr)
            draw.text((x + (w - lw) // 2, y_top + (HDR_H - lh) // 2), h, font=f_hdr, fill=TEXT)
        x += w
    y += HDR_H
    draw.line([(PAD_X, y), (W - PAD_X, y)], fill=BORDER, width=2)

    # ── Brand band (green) ────────────────────────────────────────────
    draw.rectangle([(PAD_X, y), (W - PAD_X, y + BRAND_H)], fill=GREEN)
    bw, bh = _measure(draw, brand, f_brand)
    draw.text((PAD_X + (INNER_W - bw) // 2, y + (BRAND_H - bh) // 2),
              brand, font=f_brand, fill=WHITE)
    y += BRAND_H

    # ── Item rows ─────────────────────────────────────────────────────
    for it in items:
        x = PAD_X
        is_return = bool(it.get("is_return"))
        if is_return:
            cells = [
                str(it.get("name") or "—"),
                str(it.get("unit") or "Шт"),
                str(int(it.get("qty") or 0)),
                "—", "—", "—",
            ]
        else:
            cells = [
                str(it.get("name") or "—"),
                str(it.get("unit") or "Шт"),
                str(int(it.get("qty") or 0)),
                str(int(it.get("bonus") or 0)),
                _fmt_money(it.get("price") or 0),
                _fmt_money(it.get("sum") or 0),
            ]
        aligns = ["L", "C", "C", "C", "C", "C"]
        row_bg = (230, 245, 255) if is_return else None
        if row_bg:
            draw.rectangle([(PAD_X, y), (W - PAD_X, y + ROW_H)], fill=row_bg)
        for i, (txt_, w, al) in enumerate(zip(cells, COL_W, aligns)):
            if i > 0:
                draw.line([(x, y), (x, y + ROW_H)], fill=BORDER, width=1)
            font = f_cell_b if is_return else f_cell
            tw, th = _measure(draw, txt_, font)
            if al == "L":
                tx = x + 14
            else:
                tx = x + (w - tw) // 2
            draw.text((tx, y + (ROW_H - th) // 2), txt_, font=font, fill=TEXT)
            x += w
        y += ROW_H
        draw.line([(PAD_X, y), (W - PAD_X, y)], fill=BORDER, width=1)

    # ── Итого row ────────────────────────────────────────────────────
    grand_total = sum(int(round(float(i.get("sum") or 0))) for i in items)
    draw.rectangle([(PAD_X, y), (W - PAD_X, y + ROW_H)], fill=TOTAL_BG)
    # "Итого:" left-aligned in first cell
    draw.text((PAD_X + 14, y + (ROW_H - 28) // 2), "Итого:", font=f_total_l, fill=TEXT)
    # Grand total in last column (sum cell), right-aligned
    last_x_start = PAD_X + sum(COL_W[:-1])
    last_w = COL_W[-1]
    total_str = _fmt_money(grand_total)
    tw, th = _measure(draw, total_str, f_total_v)
    draw.text((last_x_start + (last_w - tw) // 2, y + (ROW_H - th) // 2),
              total_str, font=f_total_v, fill=TEXT)
    # Vertical separators on this row too
    x = PAD_X
    for i, w in enumerate(COL_W):
        if i > 0:
            draw.line([(x, y), (x, y + ROW_H)], fill=BORDER, width=1)
        x += w
    y += ROW_H
    draw.line([(PAD_X, y), (W - PAD_X, y)], fill=BORDER, width=2)

    # ── Footer rows: получатель, тип машины ──────────────────────────
    # Layout: label_col (≈30%) | value_a (≈30%) | value_b (≈40%)
    LBL_W = COL_W[0]
    A_W = COL_W[1] + COL_W[2] + COL_W[3]
    B_W = COL_W[4] + COL_W[5]

    def foot_row(label: str, val_a: str, val_b: str):
        nonlocal y
        # background like the rest of the table
        draw.rectangle([(PAD_X, y), (W - PAD_X, y + FOOT_ROW_H)], fill=WHITE)
        # vertical separators between the three sections
        draw.line([(PAD_X + LBL_W, y), (PAD_X + LBL_W, y + FOOT_ROW_H)], fill=BORDER, width=1)
        draw.line([(PAD_X + LBL_W + A_W, y), (PAD_X + LBL_W + A_W, y + FOOT_ROW_H)], fill=BORDER, width=1)
        # label (left-align, slightly smaller, lowercase per reference)
        lw, lh = _measure(draw, label, f_foot_l)
        draw.text((PAD_X + 14, y + (FOOT_ROW_H - lh) // 2), label, font=f_foot_l, fill=TEXT)
        # value A (centered in section)
        if val_a:
            vw, vh = _measure(draw, val_a, f_foot_v)
            draw.text((PAD_X + LBL_W + (A_W - vw) // 2, y + (FOOT_ROW_H - vh) // 2),
                      val_a, font=f_foot_v, fill=TEXT)
        # value B (centered in section)
        if val_b:
            vw, vh = _measure(draw, val_b, f_foot_v)
            draw.text((PAD_X + LBL_W + A_W + (B_W - vw) // 2, y + (FOOT_ROW_H - vh) // 2),
                      val_b, font=f_foot_v, fill=TEXT)
        y += FOOT_ROW_H
        draw.line([(PAD_X, y), (W - PAD_X, y)], fill=BORDER, width=1)

    foot_row("получатель", (courier_name or "—").upper(),
             courier_phone or "—")
    foot_row("тип машины", (vehicle_type or "—").upper(),
             (vehicle_plate or "—").upper())

    # ── Outer card border ────────────────────────────────────────────
    draw.rectangle(
        [(PAD_X, 15 + TOP_INFO_H), (W - PAD_X, y)],
        outline=BORDER, width=2,
    )

    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
