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

from app.models.warehouse import CourierWater
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

    return {
        "courier_id": courier.id,
        "name": courier.name,
        "delivery_count": total_delivered,
        "total_deliveries": total_delivered,
        "today_count": today_count,
        "earnings": round(total_revenue, 2),
        "total_revenue": round(total_revenue, 2),
        "rating": round(float(avg_rating or 0), 2),
        "avg_rating": round(float(avg_rating or 0), 2),
        "review_count": review_count or 0,
        "active_orders": active_orders,
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
    total_bottles_19l_delivered = 0
    total_bottles_returned = 0
    rating_vals = []

    for o in orders:
        total_revenue += float(o.total or 0)
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
            items_list.append({
                "name": prod.name if prod else "—",
                "quantity": qty,
                "price": float(item.price or 0),
                "volume": vol,
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
            "total": float(o.total or 0),
            "payment_method": pm,
            "created_at": o.created_at.strftime("%d.%m.%Y %H:%M") if o.created_at else "—",
            "confirmed_at": o.confirmed_at.strftime("%d.%m.%Y %H:%M") if o.confirmed_at else "—",
            "delivered_at": o.delivered_at.strftime("%d.%m.%Y %H:%M") if o.delivered_at else "—",
            "rating": rating,
        })

    avg_rating = round(sum(rating_vals) / len(rating_vals), 2) if rating_vals else None

    return {
        "deliveries": len(orders),
        "total_revenue": round(total_revenue, 2),
        "total_cash": round(total_cash, 2),
        "total_card": round(total_card, 2),
        "total_online": round(total_online, 2),
        "total_bottles_19l_delivered": total_bottles_19l_delivered,
        "total_bottles_returned": total_bottles_returned,
        "avg_rating": avg_rating,
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
    w.writerow(["Доставок", "Выручка (сум)", "Средний рейтинг"])
    w.writerow([data["deliveries"], data["total_revenue"], data["avg_rating"] or "—"])
    w.writerow([])
    w.writerow(["№ заказа", "Дата доставки", "Адрес", "Сумма (сум)", "Оплата", "Возврат бутылок", "Оценка"])
    for r in data["orders"]:
        w.writerow([r["order_id"], r["delivered_at"], r["address"],
                    r["total"], r["payment_method"], r["return_bottles"], r["rating"]])

    fname = f"courier_{courier_id}_{date_from}_{date_to}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
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

    pay_labels = {"cash": "Наличные", "card": "Карта", "online": "Онлайн", "balance": "Баланс", "balance_card": "Баланс+Карта"}

    _FONT_DIR = Path(_fpdf_module.__file__).parent / "fonts"

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.add_font("DejaVu", "", str(_FONT_DIR / "DejaVuSans.ttf"))
    pdf.add_font("DejaVu", "B", str(_FONT_DIR / "DejaVuSans-Bold.ttf"))

    NL = {"new_x": "LMARGIN", "new_y": "NEXT"}

    def h1(text):
        pdf.set_font("DejaVu", "B", 16)
        pdf.cell(0, 10, text, **NL)

    def h2(text):
        pdf.set_font("DejaVu", "B", 12)
        pdf.cell(0, 8, text, **NL)

    def body(text, indent=0):
        pdf.set_font("DejaVu", "", 10)
        if indent:
            pdf.set_x(pdf.l_margin + indent)
        pdf.multi_cell(0, 6, text)

    def sep():
        pdf.ln(2)
        pdf.set_draw_color(200, 200, 200)
        pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
        pdf.ln(3)

    # ── Header
    h1(f"Отчёт по курьеру: {courier.name}")
    body(f"Период: {date_from.strftime('%d.%m.%Y')} — {date_to.strftime('%d.%m.%Y')}")
    body(f"Сформирован: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
    sep()

    if not data["orders"]:
        body("За указанный период доставок не найдено.")
    else:
        for o in data["orders"]:
            h2(f"Заказ №{o['order_id']}  —  {o['delivered_at']}")
            body(f"Клиент: {o['client_phone']}" + (f" ({o['client_name']})" if o['client_name'] != '—' else ""))
            body(f"Адрес: {o['address']}")
            body(f"Оформлен: {o['created_at']}  |  Подтверждён: {o['confirmed_at']}  |  Доставлен: {o['delivered_at']}")

            if o["items"]:
                body("Товары:")
                for item in o["items"]:
                    vol_str = f" {item['volume']:.0f}л" if item["volume"] > 0 else ""
                    subtotal = item["price"] * item["quantity"]
                    body(f"  • {item['name']}{vol_str} × {item['quantity']} = {subtotal:,.0f} сум", indent=4)

            if o["return_bottles"] > 0:
                body(f"Возврат 19л бутылок: {o['return_bottles']} шт.")

            pay_label = pay_labels.get(o["payment_method"], o["payment_method"])
            body(f"Оплата: {pay_label} — {o['total']:,.0f} сум")

            if o["rating"] is not None:
                stars = "★" * o["rating"] + "☆" * (5 - o["rating"])
                body(f"Оценка: {stars} ({o['rating']}/5)")

            sep()

    # ── Summary
    pdf.add_page()
    h1("Итоги за период")
    sep()
    body(f"Всего доставок: {data['deliveries']}")
    if data["total_cash"] > 0:
        body(f"Наличные: {data['total_cash']:,.0f} сум")
    if data["total_card"] > 0:
        body(f"Карта: {data['total_card']:,.0f} сум")
    if data["total_online"] > 0:
        body(f"Онлайн: {data['total_online']:,.0f} сум")
    pdf.set_font("DejaVu", "B", 12)
    pdf.cell(0, 8, f"ИТОГО: {data['total_revenue']:,.0f} сум", **NL)
    pdf.set_font("DejaVu", "", 10)
    pdf.ln(4)
    body(f"Бутылок 19л доставлено: {data['total_bottles_19l_delivered']} шт.")
    body(f"Бутылок 19л возвращено: {data['total_bottles_returned']} шт.")
    if data["avg_rating"] is not None:
        body(f"Средний рейтинг: {data['avg_rating']:.1f} / 5.0")

    pdf_bytes = bytes(pdf.output())

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
    courier_telegram_id: int | None = None  # set when a courier creates the order
    creator_role: str = "manager"           # "courier" | "manager" | "admin"


@router.post("/orders")
async def courier_create_order(body: CourierOrderCreate, db: AsyncSession = Depends(get_db)):
    """Staff (courier/manager/admin) creates an order on behalf of a client."""
    from app.models.order import Order, OrderItem, OrderStatus
    from app.models.product import Product
    from app.config import settings as cfg
    from app.models.manager import Manager
    from app.services.tg_notify import notify_all
    from app.routers.orders import _tg, _tg_send, calc_bottle_discount
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

    # Apply bottle return discount (same as normal order flow)
    settings_cfg = await get_all_settings(db)
    bottle_discount = calc_bottle_discount(body.return_bottles_count, subtotal, settings_cfg)
    total = max(0.0, subtotal - bottle_discount)

    order = Order(
        user_id=user.id if user else None,
        recipient_phone=body.phone,
        address=body.address,
        extra_info=body.note,
        delivery_time=body.delivery_time,
        subtotal=subtotal,
        total=total,
        bottle_discount=bottle_discount,
        payment_method=body.payment_method,
        return_bottles_count=body.return_bottles_count,
        status=OrderStatus.CONFIRMED,
    )
    db.add(order)
    await db.flush()
    for product, quantity in items_data:
        db.add(OrderItem(order_id=order.id, product_id=product.id,
                         quantity=quantity, price=product.price))

    # Auto-assign if a courier created the order
    creator_courier = None
    if body.courier_telegram_id:
        c_q = await db.execute(
            select(Courier).where(Courier.telegram_id == body.courier_telegram_id)
        )
        creator_courier = c_q.scalar_one_or_none()
        if creator_courier and body.creator_role == "courier":
            order.courier_id = creator_courier.id
            order.status = OrderStatus.ASSIGNED_TO_COURIER

    await db.commit()

    oid = order.id
    items_text = ", ".join(f"{p.name} x{q}" for p, q in items_data) if items_data else "—"
    items_lines = "\n".join(f"  • {p.name} ×{q}" for p, q in items_data) if items_data else "  —"
    total_int = int(total)

    client_tg = user.telegram_id if user else None
    mgrs = (await db.execute(select(Manager).where(Manager.is_active == True))).scalars().all()

    # ── Courier-created order (already assigned) ──
    if body.creator_role == "courier" and creator_courier:
        courier_name = creator_courier.name
        courier_phone = creator_courier.phone or ""

        # Notify courier with full assignment message + action buttons
        from urllib.parse import quote as url_quote
        kb_rows = []
        if body.address:
            kb_rows.append([{"text": "🗺 На карте", "url": f"https://maps.google.com/?q={url_quote(body.address)}"}])
        kb_rows.append([{"text": "🚴 Выехал", "callback_data": f"courier:in_delivery:{oid}"}])
        kb_rows.append([{"text": "◀️ К списку", "callback_data": "cor:back"}])
        courier_kb = {"inline_keyboard": kb_rows}
        bottles_line = f"\nВозврат бутылок: {body.return_bottles_count} шт." if body.return_bottles_count else ""
        courier_text = (
            f"📦 <b>🚚 Назначен курьеру</b>\n\n"
            f"Адрес: {body.address}\n"
            f"Клиент: {body.phone}\n"
            f"Время: {body.delivery_time or '—'}\n"
            f"Товары:\n{items_lines}\n"
            f"Получить от клиента: {total_int:,} сум{bottles_line}"
        )
        await _tg_send(creator_courier.telegram_id, courier_text, courier_kb, parse_mode="HTML")

        # Notify client about created+assigned order
        if client_tg:
            phone_line = f"\nТелефон курьера: {courier_phone}" if courier_phone else ""
            await _tg(client_tg, (
                f"✅ Ваш заказ #{oid} создан и передан курьеру!\n"
                f"Курьер: {courier_name}{phone_line}\n"
                f"Адрес: {body.address}\n"
                f"Состав: {items_text}\n"
                f"Сумма: {total_int:,} сум"
            ))

        # Inform admins/managers (no action needed)
        info_text = (
            f"📦 Новый заказ #{oid} (курьер {courier_name})\n"
            f"Клиент: {body.phone}\n"
            f"Адрес: {body.address}\n"
            f"Состав: {items_text}\n"
            f"Сумма: {total_int:,} сум\n"
            f"✅ Курьер назначен автоматически"
        )
        for aid in cfg.ADMIN_IDS:
            await _tg(aid, info_text)
        for m in mgrs:
            if m.telegram_id and m.telegram_id not in cfg.ADMIN_IDS:
                await _tg(m.telegram_id, info_text)

    # ── Manager/admin-created order (needs courier assignment) ──
    else:
        role_label = "менеджером" if body.creator_role == "manager" else "администратором"

        # Notify client that order was created
        if client_tg:
            await _tg(client_tg, (
                f"✅ Ваш заказ #{oid} создан!\n"
                f"Адрес: {body.address}\n"
                f"Состав: {items_text}\n"
                f"Сумма: {total_int:,} сум\n"
                f"Ожидайте подтверждения и назначения курьера."
            ))

        # Notify admins/managers with "assign courier" inline button
        text = (
            f"🆕 Новый заказ #{oid} (создан {role_label})\n"
            f"Клиент: {body.phone}\n"
            f"Адрес: {body.address}\n"
            f"Состав: {items_text}\n"
            f"Сумма: {total_int:,} сум\n"
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
