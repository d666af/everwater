"""Courier-specific endpoints: stats, reviews, water inventory, cash debts."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.courier import Courier
from app.models.order import Order, OrderStatus, Review
from app.models.cash_debt import CashDebt
from app.models.warehouse import CourierWater
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
        select(CourierWater).where(CourierWater.courier_id == courier.id)
    )
    items = result.scalars().all()
    return [
        {"product_id": w.product_id, "quantity": w.quantity, "issued_today": w.issued_today}
        for w in items
    ]


# ─── Cash debts ───────────────────────────────────────────────────────────────

@router.get("/{telegram_id}/cash_debts")
async def get_cash_debts(telegram_id: int, db: AsyncSession = Depends(get_db)):
    courier = await _get_courier_by_telegram(telegram_id, db)
    result = await db.execute(
        select(CashDebt).where(CashDebt.courier_id == courier.id)
        .order_by(CashDebt.created_at.desc())
    )
    debts = result.scalars().all()
    total = sum(d.amount for d in debts if d.status == "pending")
    return {
        "total_pending": total,
        "debts": [
            {"id": d.id, "amount": d.amount, "status": d.status,
             "order_id": d.order_id, "note": d.note,
             "created_at": d.created_at.isoformat()}
            for d in debts
        ],
    }


class DebtClearBody(BaseModel):
    note: str | None = None


@router.post("/cash_debts/{debt_id}/request_clearance")
async def request_debt_clearance(debt_id: int, body: DebtClearBody = DebtClearBody(),
                                 db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CashDebt).where(CashDebt.id == debt_id))
    debt = result.scalar_one_or_none()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    debt.status = "requested"
    if body.note:
        debt.note = body.note
    await db.commit()
    return {"ok": True}


# ─── Admin: cash debt approval ────────────────────────────────────────────────

@router.get("/admin/cash_debts")
async def list_all_cash_debts(status: str | None = None, db: AsyncSession = Depends(get_db)):
    q = select(CashDebt).order_by(CashDebt.created_at.desc())
    if status:
        q = q.where(CashDebt.status == status)
    result = await db.execute(q)
    debts = result.scalars().all()
    return [
        {"id": d.id, "courier_id": d.courier_id, "amount": d.amount,
         "status": d.status, "order_id": d.order_id, "note": d.note,
         "created_at": d.created_at.isoformat()}
        for d in debts
    ]


class DebtDecisionBody(BaseModel):
    action: str  # "approve" | "reject"
    note: str | None = None


@router.post("/admin/cash_debts/{debt_id}/decide")
async def decide_debt(debt_id: int, body: DebtDecisionBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CashDebt).where(CashDebt.id == debt_id))
    debt = result.scalar_one_or_none()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    if body.action == "approve":
        debt.status = "approved"
        debt.resolved_at = datetime.utcnow()
    elif body.action == "reject":
        debt.status = "rejected"
        debt.resolved_at = datetime.utcnow()
    else:
        raise HTTPException(status_code=400, detail="action must be approve or reject")
    if body.note:
        debt.note = body.note
    await db.commit()
    return {"ok": True, "status": debt.status}


# ─── Courier creates order ────────────────────────────────────────────────────

class CourierOrderCreate(BaseModel):
    phone: str
    address: str
    items: list[dict]
    payment_method: str = "cash"
    delivery_time: str | None = None
    note: str | None = None
    total: float | None = None


@router.post("/orders")
async def courier_create_order(body: CourierOrderCreate, db: AsyncSession = Depends(get_db)):
    """Courier creates an order on behalf of a client (by phone lookup)."""
    from app.models.order import Order, OrderItem, OrderStatus
    from app.models.product import Product

    normalized = body.phone.replace(" ", "").replace("-", "")
    user_q = await db.execute(select(User).where(User.phone.contains(normalized[-9:])))
    user = user_q.scalar_one_or_none()

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

    order = Order(
        user_id=user.id if user else None,
        recipient_phone=body.phone,
        address=body.address,
        extra_info=body.note,
        delivery_time=body.delivery_time,
        subtotal=subtotal,
        total=subtotal,
        payment_method=body.payment_method,
        status=OrderStatus.CONFIRMED,
    )
    db.add(order)
    await db.flush()
    for product, quantity in items_data:
        db.add(OrderItem(order_id=order.id, product_id=product.id,
                         quantity=quantity, price=product.price))
    await db.commit()
    return {"ok": True, "order_id": order.id}
