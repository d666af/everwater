"""Courier-specific endpoints: stats, reviews, water inventory, reports."""
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import io, csv
from io import BytesIO
from pathlib import Path
from fpdf import FPDF
import fpdf as _fpdf_module

from app.database import get_db
from app.models.courier import Courier
from app.models.order import Order, OrderItem, OrderStatus, Review

from app.models.warehouse import CourierWater, WaterTransaction
from app.models.product import Product
from app.models.user import User
from app.routers.orders import _order_opts, _order_to_out

router = APIRouter(prefix="/couriers", tags=["couriers"])


async def _get_courier_by_telegram(telegram_id: int, db: AsyncSession) -> Courier:
    result = await db.execute(select(Courier).where(Courier.telegram_id == telegram_id))
    courier = result.scalar_one_or_none()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")
    return courier


# ─── Orders ──────────────────────────────────────────────────────────────────

@router.get("/{telegram_id}/orders")
async def get_courier_orders_by_tg(telegram_id: int, status: str | None = None,
                                   db: AsyncSession = Depends(get_db)):
    courier = await _get_courier_by_telegram(telegram_id, db)
    q = (select(Order).where(Order.courier_id == courier.id)
         .options(*_order_opts()).order_by(Order.created_at.desc()))
    if status:
        q = q.where(Order.status == status)
    result = await db.execute(q)
    return [_order_to_out(o) for o in result.scalars().all()]


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/{telegram_id}/stats")
async def get_courier_stats(telegram_id: int, db: AsyncSession = Depends(get_db)):
    courier = await _get_courier_by_telegram(telegram_id, db)

    delivered_q = await db.execute(
        select(func.count(Order.id)).where(
            and_(Order.courier_id == courier.id, Order.status == OrderStatus.DELIVERED)
        )
    )
    total_delivered = delivered_q.scalar() or 0

    revenue_q = await db.execute(
        select(func.sum(Order.total)).where(
            and_(Order.courier_id == courier.id, Order.status == OrderStatus.DELIVERED)
        )
    )
    total_revenue = float(revenue_q.scalar() or 0)

    reviews_q = await db.execute(
        select(func.avg(Review.rating), func.count(Review.id))
        .where(Review.courier_id == courier.id)
    )
    avg_rating, review_count = reviews_q.one()

    active_q = await db.execute(
        select(func.count(Order.id)).where(
            and_(Order.courier_id == courier.id,
                 Order.status.in_([OrderStatus.ASSIGNED_TO_COURIER, OrderStatus.IN_DELIVERY]))
        )
    )
    active_orders = active_q.scalar() or 0

    today_q = await db.execute(
        select(func.count(Order.id)).where(
            and_(Order.courier_id == courier.id,
                 Order.status == OrderStatus.DELIVERED,
                 func.date(Order.delivered_at) == func.current_date())
        )
    )
    today_count = today_q.scalar() or 0

    delivery_rev_q = await db.execute(
        select(func.sum(Order.delivery_fee)).where(
            and_(Order.courier_id == courier.id, Order.status == OrderStatus.DELIVERED)
        )
    )
    total_delivery_revenue = float(delivery_rev_q.scalar() or 0)

    # Bottle debt: only count 19L products (match warehouse logic)
    prod_19l_q = await db.execute(
        select(Product.id).where(Product.volume >= 18.9)
    )
    prod_19l_ids = [r[0] for r in prod_19l_q.all()]

    if prod_19l_ids:
        issued_q = await db.execute(
            select(func.sum(WaterTransaction.quantity)).where(
                and_(
                    WaterTransaction.courier_id == courier.id,
                    WaterTransaction.transaction_type == "issue",
                    WaterTransaction.product_id.in_(prod_19l_ids),
                )
            )
        )
    else:
        issued_q = None

    returned_q = await db.execute(
        select(func.sum(WaterTransaction.quantity)).where(
            and_(
                WaterTransaction.courier_id == courier.id,
                WaterTransaction.transaction_type == "bottle_return",
            )
        )
    )
    total_issued = (issued_q.scalar() if issued_q else None) or 0
    total_returned = returned_q.scalar() or 0
    bottles_must_return = max(0, total_issued - total_returned)

    # Bottle debt value: bottles_must_return × bottle_surcharge of the 19L product
    surcharge_q = await db.execute(
        select(Product.bottle_surcharge).where(
            and_(Product.volume >= 18.9, Product.bottle_surcharge.isnot(None))
        ).order_by(Product.bottle_surcharge.desc()).limit(1)
    )
    bottle_surcharge_val = surcharge_q.scalar() or 0
    bottle_debt_value = bottles_must_return * float(bottle_surcharge_val)

    # Inventory: available + reserved per product
    water_q = await db.execute(
        select(CourierWater, Product.name)
        .join(Product, Product.id == CourierWater.product_id)
        .where(CourierWater.courier_id == courier.id)
    )
    reserved_items = []
    for w, pname in water_q.all():
        res = int(w.reserved or 0)
        avail = int(w.quantity or 0)
        if res > 0 or avail > 0:
            reserved_items.append({"name": pname, "reserved": res, "available": avail})

    return {
        "courier_id": courier.id,
        "name": courier.name,
        "vehicle_type": courier.vehicle_type,
        "vehicle_plate": courier.vehicle_plate,
        "delivery_count": total_delivered,
        "total_deliveries": total_delivered,
        "today_count": today_count,
        "earnings": round(total_revenue, 2),
        "total_revenue": round(total_revenue, 2),
        "total_delivery_revenue": round(total_delivery_revenue, 2),
        "rating": round(float(avg_rating or 0), 2),
        "avg_rating": round(float(avg_rating or 0), 2),
        "review_count": review_count or 0,
        "active_orders": active_orders,
        "bottles_must_return": bottles_must_return,
        "bottle_debt_value": round(bottle_debt_value, 2),
        "reserved_items": reserved_items,
    }


# ─── Reviews ──────────────────────────────────────────────────────────────────

@router.get("/{telegram_id}/reviews")
async def get_courier_reviews(telegram_id: int, db: AsyncSession = Depends(get_db)):
    courier = await _get_courier_by_telegram(telegram_id, db)
    result = await db.execute(
        select(Review)
        .where(Review.courier_id == courier.id)
        .order_by(Review.created_at.desc())
        .limit(50)
    )
    reviews = result.scalars().all()
    return [
        {
            "id": r.id,
            "rating": r.rating,
            "comment": r.comment,
            "order_id": r.order_id,
            "created_at": r.created_at.isoformat(),
        }
        for r in reviews
    ]


# ─── Water inventory ──────────────────────────────────────────────────────────

@router.get("/{telegram_id}/water")
async def get_courier_water(telegram_id: int, db: AsyncSession = Depends(get_db)):
    courier = await _get_courier_by_telegram(telegram_id, db)
    result = await db.execute(
        select(CourierWater, Product.name)
        .join(Product, Product.id == CourierWater.product_id)
        .where(CourierWater.courier_id == courier.id)
    )
    rows = result.all()
    return {
        name: w.quantity
        for w, name in rows
        if w.quantity > 0
    }


# ─── Report ───────────────────────────────────────────────────────────────────

async def _courier_report_data(courier_id: int, date_from: date, date_to: date, db: AsyncSession) -> dict:
    dt_from = datetime(date_from.year, date_from.month, date_from.day, 0, 0, 0)
    dt_to   = datetime(date_to.year,   date_to.month,   date_to.day,   23, 59, 59)

    orders_q = await db.execute(
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.product),
            selectinload(Order.user),
            selectinload(Order.review),
        )
        .where(
            Order.courier_id == courier_id,
            Order.status == OrderStatus.DELIVERED,
            Order.delivered_at >= dt_from,
            Order.delivered_at <= dt_to,
        )
        .order_by(Order.delivered_at)
    )
    orders = orders_q.scalars().all()

    rows = []
    total_revenue = 0.0
    total_cash = 0.0
    total_card = 0.0
    total_online = 0.0
    total_delivery_revenue = 0.0
    total_bottles_19l_delivered = 0
    total_bottles_returned = 0
    total_earned = 0.0
    rating_vals = []

    for o in orders:
        total_revenue += float(o.total or 0)
        total_delivery_revenue += float(o.delivery_fee or 0)
        pm = o.payment_method or "cash"
        if pm == "cash":
            total_cash += float(o.total or 0)
        elif pm == "card":
            total_card += float(o.total or 0)
        else:
            total_online += float(o.total or 0)

        bottles_returned = o.return_bottles_count or 0
        total_bottles_returned += bottles_returned

        items_list = []
        for item in (o.items or []):
            prod = item.product
            vol = float(getattr(prod, 'volume', 0) or 0)
            qty = item.quantity or 0
            if vol >= 19.0:
                total_bottles_19l_delivered += qty
            earning = float(getattr(prod, 'courier_earning', None) or 0)
            total_earned += earning * qty
            items_list.append({
                "name": prod.name if prod else "—",
                "quantity": qty,
                "price": float(item.price or 0),
                "volume": vol,
                "courier_earning": earning,
            })

        rating = None
        if o.review:
            rating = o.review.rating
            rating_vals.append(rating)

        user_name = None
        if o.user:
            user_name = o.user.name

        rows.append({
            "order_id": o.id,
            "client_phone": o.recipient_phone or "—",
            "client_name": user_name or "—",
            "address": o.address or "—",
            "items": items_list,
            "return_bottles": bottles_returned,
            "bonus_used": float(o.bonus_used or 0),
            "total": float(o.total or 0),
            "delivery_fee": float(o.delivery_fee or 0),
            "payment_method": pm,
            "created_at": o.created_at.strftime("%d.%m.%Y %H:%M") if o.created_at else "—",
            "confirmed_at": o.confirmed_at.strftime("%d.%m.%Y %H:%M") if o.confirmed_at else "—",
            "delivered_at": o.delivered_at.strftime("%d.%m.%Y %H:%M") if o.delivered_at else "—",
            "delivered_at_iso": o.delivered_at.isoformat() if o.delivered_at else None,
            "rating": rating,
        })

    avg_rating = round(sum(rating_vals) / len(rating_vals), 2) if rating_vals else None
    paid_delivery_orders = sum(1 for r in rows if r["delivery_fee"] > 0)

    # Warehouse issues in the period (product_id is NOT NULL for issues)
    issue_q = await db.execute(
        select(WaterTransaction, Product.name, Product.price)
        .join(Product, Product.id == WaterTransaction.product_id)
        .where(
            and_(
                WaterTransaction.courier_id == courier_id,
                WaterTransaction.transaction_type == "issue",
                WaterTransaction.created_at >= dt_from,
                WaterTransaction.created_at <= dt_to,
            )
        )
    )
    issued_agg: dict = {}
    for txn, pname, pprice in issue_q.all():
        key = pname or "—"
        qty = txn.quantity or 0
        if key not in issued_agg:
            issued_agg[key] = {"quantity": 0, "price": float(pprice or 0)}
        issued_agg[key]["quantity"] += qty

    # Bottle returns in the period (product_id is NULL — warehouse records with no product)
    ret_q = await db.execute(
        select(WaterTransaction)
        .where(
            and_(
                WaterTransaction.courier_id == courier_id,
                WaterTransaction.transaction_type == "bottle_return",
                WaterTransaction.created_at >= dt_from,
                WaterTransaction.created_at <= dt_to,
            )
        )
    )
    total_bottle_returns_in_period = sum(r.quantity or 0 for r in ret_q.scalars().all())

    warehouse_received = [
        {"name": k, "quantity": v["quantity"], "price": v["price"], "total": round(v["quantity"] * v["price"], 2)}
        for k, v in issued_agg.items()
    ]
    bottle_returns_in_period = (
        [{"name": "Бутылки 19л", "quantity": total_bottle_returns_in_period}]
        if total_bottle_returns_in_period > 0 else []
    )

    surcharge_q = await db.execute(
        select(Product.bottle_surcharge).where(
            and_(Product.volume >= 18.9, Product.bottle_surcharge.isnot(None))
        ).order_by(Product.bottle_surcharge.desc()).limit(1)
    )
    bottle_surcharge = float(surcharge_q.scalar() or 0)

    return {
        "deliveries": len(orders),
        "total_revenue": round(total_revenue, 2),
        "total_delivery_revenue": round(total_delivery_revenue, 2),
        "total_earned": round(total_earned, 2),
        "paid_delivery_orders": paid_delivery_orders,
        "total_cash": round(total_cash, 2),
        "total_card": round(total_card, 2),
        "total_online": round(total_online, 2),
        "total_bottles_19l_delivered": total_bottles_19l_delivered,
        "total_bottles_returned": total_bottles_returned,
        "avg_rating": avg_rating,
        "warehouse_received": warehouse_received,
        "bottle_returns_in_period": bottle_returns_in_period,
        "total_bottle_returns_in_period": total_bottle_returns_in_period,
        "bottle_surcharge": bottle_surcharge,
        "orders": rows,
    }


@router.get("/{courier_id}/report")
async def get_courier_report(
    courier_id: int,
    date_from: date,
    date_to: date,
    db: AsyncSession = Depends(get_db),
):
    """Courier stats report by DB id for a date range."""
    result = await db.execute(select(Courier).where(Courier.id == courier_id))
    courier = result.scalar_one_or_none()
    if not courier:
        raise HTTPException(404, "Courier not found")
    data = await _courier_report_data(courier.id, date_from, date_to, db)
    return {"courier_id": courier_id, "courier_name": courier.name, **data}


@router.get("/{courier_id}/report/csv")
async def download_courier_report_csv(
    courier_id: int,
    date_from: date,
    date_to: date,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Courier).where(Courier.id == courier_id))
    courier = result.scalar_one_or_none()
    if not courier:
        raise HTTPException(404, "Courier not found")
    data = await _courier_report_data(courier.id, date_from, date_to, db)

    buf = io.StringIO()
    buf.write(f"﻿")  # UTF-8 BOM for Excel
    w = csv.writer(buf, delimiter=";")
    w.writerow([f"Отчёт курьера: {courier.name}"])
    w.writerow([f"Период: {date_from} — {date_to}"])
    w.writerow([])
    w.writerow(["Доставок", "Выручка (сум)", "в т.ч. доставки (сум)", "Средний рейтинг"])
    w.writerow([data["deliveries"], data["total_revenue"], data["total_delivery_revenue"], data["avg_rating"] or "—"])
    w.writerow([])
    w.writerow(["№ заказа", "Дата доставки", "Адрес", "Сумма (сум)", "Доставка (сум)", "Оплата", "Возврат бутылок", "Оценка"])
    for r in data["orders"]:
        w.writerow([r["order_id"], r["delivered_at"], r["address"],
                    r["total"], r["delivery_fee"], r["payment_method"], r["return_bottles"], r["rating"]])

    fname = f"courier_{courier_id}_{date_from}_{date_to}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


def _find_dejavu_fonts() -> tuple[str, str]:
    """Return (regular_path, bold_path) for DejaVu Sans, trying multiple locations."""
    candidates = [
        Path("/usr/share/fonts/truetype/dejavu"),
        Path("/usr/share/fonts/dejavu"),
        Path(_fpdf_module.__file__).parent / "fonts",
        Path(_fpdf_module.__file__).parent / "font",
    ]
    for d in candidates:
        r = d / "DejaVuSans.ttf"
        b = d / "DejaVuSans-Bold.ttf"
        if r.exists() and b.exists():
            return str(r), str(b)
    raise FileNotFoundError(
        f"DejaVu fonts not found. Searched: {[str(d) for d in candidates]}"
    )


@router.get("/{courier_id}/report/pdf")
async def download_courier_report_pdf(
    courier_id: int,
    date_from: date,
    date_to: date,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Courier).where(Courier.id == courier_id))
    courier = result.scalar_one_or_none()
    if not courier:
        raise HTTPException(404, "Courier not found")
    data = await _courier_report_data(courier.id, date_from, date_to, db)

    try:
        font_regular, font_bold = _find_dejavu_fonts()
    except FileNotFoundError as e:
        raise HTTPException(500, f"Font error: {e}")

    try:
        pdf = FPDF(orientation="P", unit="mm", format="A4")
        pdf.set_margins(8, 10, 8)
        pdf.set_auto_page_break(auto=True, margin=12)
        pdf.add_page()
        pdf.add_font("DJ", "",  font_regular)
        pdf.add_font("DJ", "B", font_bold)

        # Usable page width: 210 - 8 - 8 = 194 mm
        PW = pdf.w - pdf.l_margin - pdf.r_margin

        # ── Helpers ─────────────────────────────────────────────────────────

        def body(text, bold=False, size=10, lh=5.5):
            """Block of text that wraps; always starts at left margin."""
            pdf.set_font("DJ", "B" if bold else "", size)
            pdf.set_x(pdf.l_margin)
            pdf.multi_cell(PW, lh, str(text or ""))

        def rule():
            pdf.set_draw_color(190, 190, 190)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + PW, pdf.get_y())
            pdf.ln(3)

        def clip(text, max_w, size=8, bold=False):
            """Return text truncated to fit in max_w mm; uses current font size for measurement."""
            pdf.set_font("DJ", "B" if bold else "", size)
            t = str(text or "")
            if pdf.get_string_width(t) <= max_w - 1.5:
                return t
            while t and pdf.get_string_width(t + "…") > max_w - 1.5:
                t = t[:-1]
            return (t + "…") if t else ""

        # Orders table: №|Дата|Телефон|Адрес|Товары|Оплата|Возврат|Оц.|Доставка|Сумма
        # Widths must sum to PW (194): 7+22+22+33+29+18+14+12+18+19 = 194
        O_COLS   = [7,  22,  22,  33,  29,  18,  14,  12,  18,  19]
        O_ALIGNS = ['C','C', 'L', 'L', 'L', 'C', 'C', 'C', 'R', 'R']
        O_HDRS   = ['№','Дата','Телефон','Адрес','Товары','Оплата','Возврат','Оц.','Доставка','Сумма']
        ROW_H = 6
        HDR_H = 7

        pay_abbr = {
            "cash": "Нал.", "card": "Карта", "online": "Онлайн",
        }
        pay_full = {
            "cash": "Наличные", "card": "Карта", "online": "Онлайн / перевод",
        }

        def orders_header():
            pdf.set_fill_color(230, 243, 215)
            pdf.set_draw_color(170, 200, 140)
            pdf.set_font("DJ", "B", 8)
            x0, y0 = pdf.l_margin, pdf.get_y()
            for h_txt, w, al in zip(O_HDRS, O_COLS, O_ALIGNS):
                pdf.set_xy(x0, y0)
                pdf.cell(w, HDR_H, h_txt, border=1, fill=True, align=al)
                x0 += w
            pdf.set_xy(pdf.l_margin, y0 + HDR_H)

        def orders_row(cells, zebra=False):
            pdf.set_fill_color(249, 253, 244) if zebra else pdf.set_fill_color(255, 255, 255)
            pdf.set_draw_color(210, 210, 210)
            x0, y0 = pdf.l_margin, pdf.get_y()
            for c_txt, w, al in zip(cells, O_COLS, O_ALIGNS):
                t = clip(c_txt, w, size=8)
                pdf.set_font("DJ", "", 8)
                pdf.set_xy(x0, y0)
                pdf.cell(w, ROW_H, t, border=1, fill=zebra, align=al)
                x0 += w
            pdf.set_xy(pdf.l_margin, y0 + ROW_H)

        def generic_header(hdrs, cols, aligns):
            pdf.set_fill_color(230, 243, 215)
            pdf.set_draw_color(170, 200, 140)
            x0, y0 = pdf.l_margin, pdf.get_y()
            for h_txt, w, al in zip(hdrs, cols, aligns):
                pdf.set_font("DJ", "B", 9)
                pdf.set_xy(x0, y0)
                pdf.cell(w, HDR_H, h_txt, border=1, fill=True, align=al)
                x0 += w
            pdf.set_xy(pdf.l_margin, y0 + HDR_H)

        def generic_row(cells, cols, aligns, zebra=False, bold=False, h=ROW_H, size=9, total_row=False):
            if total_row:
                pdf.set_fill_color(210, 236, 185)
                pdf.set_draw_color(170, 200, 140)
            elif zebra:
                pdf.set_fill_color(249, 253, 244)
                pdf.set_draw_color(210, 210, 210)
            else:
                pdf.set_fill_color(255, 255, 255)
                pdf.set_draw_color(210, 210, 210)
            x0, y0 = pdf.l_margin, pdf.get_y()
            for c_txt, w, al in zip(cells, cols, aligns):
                t = clip(c_txt, w, size=size, bold=bold or total_row)
                pdf.set_font("DJ", "B" if (bold or total_row) else "", size)
                pdf.set_xy(x0, y0)
                pdf.cell(w, h, t, border=1, fill=(zebra or total_row), align=al)
                x0 += w
            pdf.set_xy(pdf.l_margin, y0 + h)

        # ════════════════════════════════════════════════════════════════════
        # PAGE 1 — HEADER + ORDERS TABLE
        # ════════════════════════════════════════════════════════════════════
        body(f"ОТЧЁТ ПО КУРЬЕРУ: {courier.name.upper()}", bold=True, size=14, lh=8)
        body(f"Период: {date_from.strftime('%d.%m.%Y')} — {date_to.strftime('%d.%m.%Y')}", size=10)
        body(f"Сформирован: {datetime.now().strftime('%d.%m.%Y %H:%M')}  •  Доставок: {data['deliveries']}",
             size=9)
        pdf.ln(3)
        rule()

        if not data["orders"]:
            body("За указанный период доставок не найдено.", size=11)
        else:
            body("Список доставок", bold=True, size=11, lh=7)
            pdf.ln(2)
            orders_header()

            for idx, o in enumerate(data["orders"]):
                if pdf.get_y() + ROW_H > pdf.h - pdf.b_margin - 4:
                    pdf.add_page()
                    orders_header()

                items_str = "; ".join(
                    f"{it['name']} {it['quantity']} шт."
                    for it in (o.get("items") or [])
                )
                dt_str = str(o["delivered_at"])[:16]
                pay = pay_abbr.get(str(o.get("payment_method") or ""), str(o.get("payment_method") or "—"))
                ret = f"{o['return_bottles']} шт." if o.get("return_bottles") else "—"
                rating_str = f"{int(o['rating'])}/5" if o.get("rating") is not None else "—"
                delivery_fee_val = float(o.get("delivery_fee") or 0)
                total_val = float(o.get("total") or 0)
                delivery_str = f"{int(delivery_fee_val):,}" if delivery_fee_val > 0 else "—"
                total_str = f"{int(total_val):,}"

                orders_row([
                    str(idx + 1),
                    dt_str,
                    str(o.get("client_phone") or "—"),
                    str(o.get("address") or "—"),
                    items_str or "—",
                    pay, ret, rating_str, delivery_str, total_str,
                ], zebra=idx % 2 == 0)

        # ════════════════════════════════════════════════════════════════════
        # PAGE 2 — ИТОГИ
        # ════════════════════════════════════════════════════════════════════
        pdf.add_page()
        body(f"ИТОГИ ЗА ПЕРИОД", bold=True, size=14, lh=8)
        body(f"Курьер: {courier.name}  •  {date_from.strftime('%d.%m.%Y')} — {date_to.strftime('%d.%m.%Y')}",
             size=10)
        pdf.ln(3)
        rule()

        # ── Aggregated products ────────────────────────────────────────────
        prod_agg: dict = {}
        for o in data["orders"]:
            for it in (o.get("items") or []):
                nm = it.get("name") or "—"
                qty = int(it.get("quantity") or 0)
                subtotal = float(it.get("price") or 0) * qty
                if nm not in prod_agg:
                    prod_agg[nm] = {"qty": 0, "total": 0.0}
                prod_agg[nm]["qty"] += qty
                prod_agg[nm]["total"] += subtotal

        body("Доставленные товары:", bold=True, size=11, lh=7)
        pdf.ln(1)

        P_COLS   = [PW - 40 - 40, 40, 40]   # name | qty | sum  (= 194)
        P_ALIGNS = ['L', 'C', 'R']
        P_HDRS   = ["Товар", "Количество", "Сумма (сум)"]
        generic_header(P_HDRS, P_COLS, P_ALIGNS)

        total_prod_qty = 0
        for i, (pname, pvals) in enumerate(sorted(prod_agg.items(), key=lambda x: -x[1]["total"])):
            total_prod_qty += pvals["qty"]
            generic_row(
                [pname, f"{pvals['qty']} шт.", f"{int(pvals['total']):,}"],
                P_COLS, P_ALIGNS, zebra=i % 2 == 0,
            )
        generic_row(
            ["ИТОГО", f"{total_prod_qty} шт.", f"{int(data['total_revenue']):,}"],
            P_COLS, P_ALIGNS, total_row=True, h=HDR_H,
        )
        pdf.ln(5)

        # ── Delivery breakdown ─────────────────────────────────────────────
        if data.get("total_delivery_revenue", 0) > 0:
            body("Платная доставка:", bold=True, size=11, lh=7)
            pdf.ln(1)
            D_COLS   = [PW - 52 - 52, 52, 52]
            D_ALIGNS = ['L', 'C', 'R']
            generic_header(["Услуга", "Кол-во заказов", "Сумма (сум)"], D_COLS, D_ALIGNS)
            generic_row(
                ["Доставка", f"{data['paid_delivery_orders']} шт.", f"{int(data['total_delivery_revenue']):,}"],
                D_COLS, D_ALIGNS, zebra=True,
            )
            generic_row(
                ["ИТОГО", f"{data['paid_delivery_orders']} шт.", f"{int(data['total_delivery_revenue']):,}"],
                D_COLS, D_ALIGNS, total_row=True, h=HDR_H,
            )
            pdf.ln(5)

        # ── Payment breakdown ──────────────────────────────────────────────
        body("Разбивка по способу оплаты:", bold=True, size=11, lh=7)
        pdf.ln(1)

        pay_rows = [
            (pay_full.get(pm, pm), amt)
            for pm, amt in [
                ("cash",   data.get("total_cash",   0)),
                ("card",   data.get("total_card",   0)),
                ("online", data.get("total_online", 0)),
            ]
            if amt > 0
        ]

        PAY_COLS   = [PW - 52, 52]
        PAY_ALIGNS = ['L', 'R']
        generic_header(["Способ оплаты", "Сумма (сум)"], PAY_COLS, PAY_ALIGNS)
        for i, (lbl, amt) in enumerate(pay_rows):
            generic_row([lbl, f"{int(amt):,}"], PAY_COLS, PAY_ALIGNS, zebra=i % 2 == 0)
        generic_row(
            ["ИТОГО", f"{int(data['total_revenue']):,}"],
            PAY_COLS, PAY_ALIGNS, total_row=True, h=HDR_H,
        )
        pdf.ln(5)

        # ── Summary stats ──────────────────────────────────────────────────
        rule()
        stat_lines = [
            f"Всего доставок: {data['deliveries']}",
            f"Бутылок 19л доставлено клиентам: {data.get('total_bottles_19l_delivered', 0)} шт.",
            f"Бутылок 19л возвращено от клиентов: {data.get('total_bottles_returned', 0)} шт.",
        ]
        if data.get("avg_rating") is not None:
            stat_lines.append(f"Средний рейтинг: {data['avg_rating']:.1f} / 5.0")
        for line in stat_lines:
            body(line, size=10, lh=6)
        pdf.ln(3)
        body(f"ИТОГО ВЫРУЧКА: {int(data['total_revenue']):,} сум", bold=True, size=13, lh=8)
        if data.get("total_delivery_revenue", 0) > 0:
            body(f"  в т.ч. оплата за доставку: {int(data['total_delivery_revenue']):,} сум", size=10, lh=6)

        pdf_bytes = bytes(pdf.output())
    except Exception as exc:
        import traceback
        raise HTTPException(500, f"{type(exc).__name__}: {exc} | {traceback.format_exc()}")

    fname = f"courier_{courier_id}_{date_from}_{date_to}.pdf"
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


# ─── Courier creates order ────────────────────────────────────────────────────

class CourierOrderCreate(BaseModel):
    phone: str
    address: str
    items: list[dict]
    payment_method: str = "cash"
    delivery_time: str | None = None
    note: str | None = None
    total: float | None = None
    return_bottles_count: int = 0
    bottle_surcharge: float = 0.0
    latitude: float | None = None
    longitude: float | None = None
    courier_telegram_id: int | None = None  # set when a courier creates the order
    courier_id: int | None = None           # set when manager pre-selects courier
    creator_role: str = "manager"           # "courier" | "manager" | "admin" | "agent"
    manager_name: str | None = None
    manager_phone: str | None = None
    agent_id: int | None = None             # set when an agent creates the order


@router.post("/orders")
async def courier_create_order(body: CourierOrderCreate, db: AsyncSession = Depends(get_db)):
    """Staff (courier/manager/admin) creates an order on behalf of a client."""
    from app.models.order import Order, OrderItem, OrderStatus
    from app.models.product import Product
    from app.config import settings as cfg
    from app.models.manager import Manager
    from app.services.tg_notify import notify_all
    from app.routers.orders import _tg, _tg_send
    from app.services.settings_service import get_all_settings
    from sqlalchemy import update as sa_update

    # Fuzzy phone lookup (last 9 digits to handle prefix differences)
    digits = ''.join(c for c in body.phone if c.isdigit())
    user = None
    if len(digits) >= 9:
        user_q = await db.execute(
            select(User).where(User.phone.contains(digits[-9:])).limit(1)
        )
        user = user_q.scalars().first()

    # Build order items using full product.price as subtotal base
    subtotal = 0.0
    items_data = []
    for item in body.items:
        product = None
        if item.get("product_id"):
            prod_q = await db.execute(select(Product).where(Product.id == item["product_id"]))
            product = prod_q.scalar_one_or_none()
        if product:
            subtotal += product.price * item["quantity"]
            items_data.append((product, item["quantity"]))
        elif item.get("price"):
            subtotal += float(item["price"]) * item["quantity"]

    if not subtotal and body.total:
        subtotal = body.total

    # Apply surcharge only — no legacy bottle return discount in this flow
    settings_cfg = await get_all_settings(db)
    bottle_discount = 0.0
    bottle_surcharge = body.bottle_surcharge or 0.0
    total = max(0.0, subtotal + bottle_surcharge)

    order = Order(
        user_id=user.id if user else None,
        recipient_phone=body.phone,
        address=body.address,
        extra_info=body.note,
        delivery_time=body.delivery_time,
        subtotal=subtotal,
        total=total,
        bottle_discount=bottle_discount,
        bottle_surcharge=bottle_surcharge,
        payment_method=body.payment_method,
        return_bottles_count=body.return_bottles_count,
        latitude=body.latitude,
        longitude=body.longitude,
        status=OrderStatus.CONFIRMED,
        creator_role=body.creator_role,
        agent_id=body.agent_id,
    )
    db.add(order)
    await db.flush()
    for product, quantity in items_data:
        db.add(OrderItem(order_id=order.id, product_id=product.id,
                         quantity=quantity, price=product.price))

    # Resolve creator courier (courier-created order)
    creator_courier = None
    if body.courier_telegram_id:
        c_q = await db.execute(
            select(Courier).where(Courier.telegram_id == body.courier_telegram_id)
        )
        creator_courier = c_q.scalar_one_or_none()
        if creator_courier and body.creator_role == "courier":
            order.courier_id = creator_courier.id
            order.status = OrderStatus.ASSIGNED_TO_COURIER

    # Resolve manager-pre-selected courier (manager-created order with courier chosen at creation)
    manager_assigned_courier = None
    if body.creator_role in ("manager", "admin") and body.courier_id and not creator_courier:
        mac_q = await db.execute(select(Courier).where(Courier.id == body.courier_id))
        manager_assigned_courier = mac_q.scalar_one_or_none()
        if manager_assigned_courier:
            order.courier_id = manager_assigned_courier.id

    is_return_only = not items_data and body.return_bottles_count > 0

    if is_return_only:
        assigned_courier = creator_courier or manager_assigned_courier
        if assigned_courier:
            # Auto-deliver return-only order when courier is known
            order.status = OrderStatus.DELIVERED
            order.delivered_at = datetime.utcnow()
            from app.models.warehouse import WaterTransaction
            db.add(WaterTransaction(
                courier_id=assigned_courier.id,
                transaction_type="bottle_return",
                quantity=body.return_bottles_count,
                order_id=order.id,
            ))
        # else: no courier yet — stays CONFIRMED for later assignment
    elif order.courier_id and items_data:
        from app.models.warehouse import CourierWater, WaterTransaction
        for product, quantity in items_data:
            row_q = await db.execute(
                select(CourierWater).where(
                    CourierWater.courier_id == order.courier_id,
                    CourierWater.product_id == product.id,
                )
            )
            row = row_q.scalar_one_or_none()
            if manager_assigned_courier:
                # Manager pre-assigned: record as issue transaction and set reserved
                if not row:
                    row = CourierWater(courier_id=order.courier_id, product_id=product.id, quantity=0, reserved=0)
                    db.add(row)
                row.reserved = (row.reserved or 0) + quantity
                db.add(WaterTransaction(
                    product_id=product.id,
                    courier_id=order.courier_id,
                    order_id=order.id,
                    transaction_type="issue",
                    quantity=quantity,
                    note="Заказ создан менеджером",
                ))
            elif row:
                # Courier-created: move from available to reserved
                qty = min(quantity, max(0, row.quantity))
                row.quantity = max(0, row.quantity - qty)
                row.reserved = (row.reserved or 0) + qty
        if manager_assigned_courier:
            order.status = OrderStatus.ASSIGNED_TO_COURIER
    await db.commit()

    oid = order.id
    items_text = ", ".join(f"{p.name} {q} шт." for p, q in items_data) if items_data else "—"
    items_lines = "\n".join(f"  • {p.name} {q} шт." for p, q in items_data) if items_data else "  —"
    total_int = int(total)

    # Map URL: prefer lat/lng, fall back to address string
    def _map_url(addr, lat, lng):
        from urllib.parse import quote as _uq
        if lat and lng:
            return f"https://maps.google.com/?q={lat},{lng}"
        return f"https://maps.google.com/?q={_uq(addr)}" if addr else None

    note_line = f"\n🏠 {body.note}" if body.note else ""
    client_tg = user.telegram_id if user else None
    mgrs = (await db.execute(select(Manager).where(Manager.is_active == True))).scalars().all()

    # ── Return-only order ──
    if is_return_only:
        client_phone_r = (user.phone if user and user.phone else None) or body.phone
        client_name_r = (user.name if user else None) or ""
        client_identity_r = f"{client_name_r} | {client_phone_r}".strip(" |") if client_name_r else client_phone_r
        assigned_courier_r = creator_courier or manager_assigned_courier

        if assigned_courier_r:
            # Courier known: auto-delivered, notify courier + admins
            await _tg(assigned_courier_r.telegram_id, (
                f"♻️ Возврат бутылок оформлен!\n\n"
                f"👤 {client_identity_r}\n"
                f"📍 {body.address}{note_line}\n"
                f"Бутылки 19л: {body.return_bottles_count} шт."
            ))
            extra_line = f"\nКурьер: {assigned_courier_r.name} ({assigned_courier_r.phone or '—'})"
            info_text_r = (
                f"♻️ Возврат бутылок\n"
                f"Клиент: {client_identity_r}\n"
                f"Адрес: {body.address}{note_line}\n"
                f"Бутылки 19л: {body.return_bottles_count} шт."
                f"{extra_line}"
            )
            for aid in cfg.ADMIN_IDS:
                await _tg(aid, info_text_r)
            for m in mgrs:
                if m.telegram_id and m.telegram_id not in cfg.ADMIN_IDS:
                    await _tg(m.telegram_id, info_text_r)
            return {"id": oid, "status": "delivered"}
        else:
            # No courier yet — notify admins/managers to assign one
            phone_part = f" ({body.manager_phone})" if body.manager_phone else ""
            mgr_line = f"\nМенеджер: {body.manager_name}{phone_part}" if body.manager_name else ""
            info_text_r = (
                f"♻️ Возврат бутылок (нужен курьер)\n"
                f"Клиент: {client_identity_r}\n"
                f"Адрес: {body.address}{note_line}\n"
                f"Бутылки 19л: {body.return_bottles_count} шт."
                f"{mgr_line}"
            )
            for aid in cfg.ADMIN_IDS:
                await _tg(aid, info_text_r)
            for m in mgrs:
                if m.telegram_id and m.telegram_id not in cfg.ADMIN_IDS:
                    await _tg(m.telegram_id, info_text_r)
            return {"id": oid, "status": "confirmed"}

    # ── Courier-created order (already assigned) ──
    if body.creator_role == "courier" and creator_courier:
        courier_name = creator_courier.name
        courier_phone = creator_courier.phone or ""

        # Notify courier with new order confirmation
        def _fmt_n(n): return f"{int(n):,}".replace(',', ' ')
        qty19L_c = sum(q for p, q in items_data if p.has_bottle_deposit)
        missing_c = max(0, qty19L_c - body.return_bottles_count)
        client_phone_display = (user.phone if user and user.phone else None) or body.phone
        items_lines_c = "\n".join(f"  • {p.name} {q} шт. — {_fmt_n(p.price * q)} сум" for p, q in items_data) if items_data else "  —"
        if missing_c > 0 and bottle_surcharge > 0:
            items_lines_c += f"\n  • Невозвращённые бутылки {missing_c} шт. — +{_fmt_n(bottle_surcharge)} сум"
        courier_text = (
            f"🚴 <b>Вы создали новый заказ!</b>\n\n"
            f"📍 {body.address}{note_line}\n"
            f"👤 {client_phone_display}\n\n"
            f"Состав:\n{items_lines_c}"
        )
        if body.return_bottles_count > 0:
            courier_text += f"\n\n♻️ Забрать пустых бутылок: {body.return_bottles_count} шт."
        courier_text += f"\n\nИтого: {_fmt_n(total_int)} сум"
        from urllib.parse import quote as url_quote
        kb_rows = []
        _m = _map_url(body.address, body.latitude, body.longitude)
        if _m:
            kb_rows.append([{"text": "🗺 На карте", "url": _m}])
        kb_rows.append([{"text": "🚴 Выехал", "callback_data": f"courier:in_delivery:{oid}"}])
        kb_rows.append([{"text": "◀️ К списку", "callback_data": "cor:back"}])
        courier_kb = {"inline_keyboard": kb_rows}
        await _tg_send(creator_courier.telegram_id, courier_text, courier_kb, parse_mode="HTML")

        # Notify client about created+assigned order (two messages)
        if client_tg:
            def _fmt_n2(n): return f"{int(n):,}".replace(',', ' ')
            items_lines_client = "\n".join(
                f"  • {p.name} {q} шт. — {_fmt_n2(p.price * q)} сум"
                for p, q in items_data
            ) if items_data else "  —"
            return_block_c = (
                f"\n\nВозврат:\n• Бутылки 19л — {body.return_bottles_count} шт."
                if body.return_bottles_count else ""
            )
            await _tg(client_tg, (
                f"✅ Для вас создан заказ!\n\n"
                f"Состав:\n{items_lines_client}"
                f"{return_block_c}\n\n"
                f"Сумма: {_fmt_n2(total_int)} сум\n"
                f"Адрес: {body.address}"
            ))
            phone_line = f"\nТелефон курьера: {courier_phone}" if courier_phone else ""
            await _tg(client_tg, (
                f"🚴 Курьер {courier_name} назначен на ваш заказ!\n"
                f"Ожидайте доставку.{phone_line}"
            ))

        # Inform admins/managers (no action needed)
        def _fmt_n3(n): return f"{int(n):,}".replace(',', ' ')
        client_name_display = (user.name if user and user.name else None) or ""
        client_identity = f"{client_name_display} | {client_phone_display}".strip(" |") if client_name_display else client_phone_display
        admin_items_lines = "\n".join(f"  • {p.name} {q} шт. — {_fmt_n3(p.price * q)} сум" for p, q in items_data) if items_data else "  —"
        if missing_c > 0 and bottle_surcharge > 0:
            admin_items_lines += f"\n  • Невозвращённые бутылки {missing_c} шт. — +{_fmt_n3(bottle_surcharge)} сум"
        return_block_adm = (
            f"\n\nВозврат:\n  • Бутылки 19л — {body.return_bottles_count} шт."
            if body.return_bottles_count else ""
        )
        info_text = (
            f"🆕 Новый заказ! Создан курьером {courier_name}\n"
            f"Клиент: {client_identity}\n"
            f"Адрес: {body.address}{note_line}\n\n"
            f"Состав:\n{admin_items_lines}"
            f"{return_block_adm}\n\n"
            f"Сумма: {_fmt_n3(total_int)} сум\n\n"
            f"✅ Курьер {courier_name} назначен автоматически"
        )
        for aid in cfg.ADMIN_IDS:
            await _tg(aid, info_text)
        for m in mgrs:
            if m.telegram_id and m.telegram_id not in cfg.ADMIN_IDS:
                await _tg(m.telegram_id, info_text)

    # ── Manager/admin-created order ──
    else:
        role_label = "менеджером" if body.creator_role == "manager" else "администратором"

        def _fmt_nm(n): return f"{int(n):,}".replace(',', ' ')
        mgr_client_name = (user.name if user and user.name else None) or ""
        mgr_client_phone = (user.phone if user and user.phone else None) or body.phone
        mgr_client_identity = f"{mgr_client_name} | {mgr_client_phone}".strip(" |") if mgr_client_name else mgr_client_phone
        mgr_items_lines = "\n".join(f"  • {p.name} {q} шт. — {_fmt_nm(p.price * q)} сум" for p, q in items_data) if items_data else "  —"
        qty19L_m = sum(q for p, q in items_data if p.has_bottle_deposit)
        missing_m = max(0, qty19L_m - body.return_bottles_count)
        if missing_m > 0 and bottle_surcharge > 0:
            mgr_items_lines += f"\n  • Невозвращённые бутылки {missing_m} шт. — +{_fmt_nm(bottle_surcharge)} сум"
        mgr_return_block = (
            f"\n\nВозврат:\n  • Бутылки 19л — {body.return_bottles_count} шт."
            if body.return_bottles_count else ""
        )

        if manager_assigned_courier:
            courier_name_m = manager_assigned_courier.name
            courier_phone_m = manager_assigned_courier.phone or ""

            items_lines_c = "\n".join(f"  • {p.name} {q} шт. — {_fmt_nm(p.price * q)} сум" for p, q in items_data) if items_data else "  —"
            if missing_m > 0 and bottle_surcharge > 0:
                items_lines_c += f"\n  • Невозвращённые бутылки {missing_m} шт. — +{_fmt_nm(bottle_surcharge)} сум"
            courier_text = (
                f"🚴 <b>Новый заказ назначен вам!</b>\n\n"
                f"📍 {body.address}{note_line}\n"
                f"👤 {mgr_client_identity}\n\n"
                f"Состав:\n{items_lines_c}"
                f"{mgr_return_block}\n\n"
                f"Итого: {_fmt_nm(total_int)} сум"
            )
            from urllib.parse import quote as url_quote
            kb_rows = []
            _m = _map_url(body.address, body.latitude, body.longitude)
            if _m:
                kb_rows.append([{"text": "🗺 На карте", "url": _m}])
            kb_rows.append([{"text": "🚴 Выехал", "callback_data": f"courier:in_delivery:{oid}"}])
            await _tg_send(manager_assigned_courier.telegram_id, courier_text, {"inline_keyboard": kb_rows}, parse_mode="HTML")

            if client_tg:
                await _tg(client_tg, (
                    f"✅ Для вас создан заказ!\n\n"
                    f"Состав:\n{items_lines_c}"
                    f"{mgr_return_block}\n\n"
                    f"Сумма: {_fmt_nm(total_int)} сум\n"
                    f"Адрес: {body.address}"
                ))
                phone_line = f"\nТелефон курьера: {courier_phone_m}" if courier_phone_m else ""
                await _tg(client_tg, (
                    f"🚴 Курьер {courier_name_m} назначен на ваш заказ!\n"
                    f"Ожидайте доставку.{phone_line}"
                ))

            info_text = (
                f"🆕 Новый заказ! Создан {role_label}\n"
                f"Клиент: {mgr_client_identity}\n"
                f"Адрес: {body.address}{note_line}\n\n"
                f"Состав:\n{mgr_items_lines}"
                f"{mgr_return_block}\n\n"
                f"Сумма: {_fmt_nm(total_int)} сум\n\n"
                f"✅ Курьер {courier_name_m} назначен"
            )
            for aid in cfg.ADMIN_IDS:
                await _tg(aid, info_text)
            for m in mgrs:
                if m.telegram_id and m.telegram_id not in cfg.ADMIN_IDS:
                    await _tg(m.telegram_id, info_text)
        else:
            if client_tg:
                items_lines_fmt = "\n".join(
                    f"  • {p.name} {q} шт. — {_fmt_nm(p.price * q)} сум"
                    for p, q in items_data
                ) if items_data else "  —"
                if missing_m > 0 and bottle_surcharge > 0:
                    items_lines_fmt += f"\n  • Невозвращённые бутылки {missing_m} шт. — +{_fmt_nm(bottle_surcharge)} сум"
                await _tg(client_tg, (
                    f"✅ Для вас создан заказ!\n\n"
                    f"Состав:\n{items_lines_fmt}"
                    f"{mgr_return_block}\n\n"
                    f"Сумма: {_fmt_nm(total_int)} сум\n"
                    f"Адрес: {body.address}"
                ))
                await _tg(client_tg, (
                    f"✅ Заказ передан на подтверждение.\n"
                    f"Мы уведомим вас когда подтвердят."
                ))

            text = (
                f"🆕 Новый заказ! Создан {role_label}\n"
                f"Клиент: {mgr_client_identity}\n"
                f"Адрес: {body.address}{note_line}\n\n"
                f"Состав:\n{mgr_items_lines}"
                f"{mgr_return_block}\n\n"
                f"Сумма: {_fmt_nm(total_int)} сум\n\n"
                f"Назначьте курьера!"
            )
            kb = {"inline_keyboard": [
                [{"text": "🚴 Назначить курьера", "callback_data": f"admin:assign:{oid}"}],
                [{"text": "🌐 Заказ на сайте", "url": cfg.MINI_APP_URL.rstrip("/") + "/admin/orders"}],
            ]}
            msg_ids_json = await notify_all(cfg.ADMIN_IDS, mgrs, text, kb)
            await db.execute(sa_update(Order).where(Order.id == oid).values(notification_msg_ids=msg_ids_json))
            await db.commit()

    return {"ok": True, "order_id": oid}