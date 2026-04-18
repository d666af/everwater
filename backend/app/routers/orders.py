from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from app.database import get_db
from app.models.order import Order, OrderItem, OrderStatus, Review
from app.models.product import Product
from app.models.user import User
from app.models.courier import Courier
from app.schemas.order import OrderCreate, OrderOut, ReviewCreate
from app.services.settings_service import get_all_settings

router = APIRouter(prefix="/orders", tags=["orders"])


def calc_bottle_discount(count: int, subtotal: float, cfg: dict) -> float:
    if count <= 0:
        return 0.0
    if cfg.get("bottle_discount_type") == "percent":
        pct = float(cfg.get("bottle_discount_value") or 0)
        return min(subtotal, subtotal * pct / 100.0)
    per = float(cfg.get("bottle_discount_value") or 0)
    return count * per


@router.post("/", response_model=OrderOut)
async def create_order(data: OrderCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == data.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    subtotal = 0.0
    items_data = []
    for item in data.items:
        prod_result = await db.execute(select(Product).where(Product.id == item.product_id))
        product = prod_result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        subtotal += product.price * item.quantity
        items_data.append((product, item.quantity))

    cfg = await get_all_settings(db)
    # Prefer client-sent bottle_discount (already shown to user); fallback to server calc
    bottle_discount = data.bottle_discount if data.bottle_discount is not None else \
        calc_bottle_discount(data.return_bottles_count, subtotal, cfg)

    bonus_used = min(float(data.bonus_used or 0), float(user.bonus_points or 0), subtotal)
    balance_used = min(float(data.balance_used or 0), float(user.balance or 0),
                       max(0.0, subtotal - bottle_discount - bonus_used))
    total = max(0.0, subtotal - bottle_discount - bonus_used - balance_used)

    order = Order(
        user_id=data.user_id,
        recipient_phone=data.recipient_phone,
        address=data.address,
        extra_info=data.extra_info,
        delivery_time=data.delivery_time,
        latitude=data.latitude,
        longitude=data.longitude,
        return_bottles_count=data.return_bottles_count,
        return_bottles_volume=data.return_bottles_volume,
        bottle_discount=bottle_discount,
        subtotal=subtotal,
        total=total,
        bonus_used=bonus_used,
        balance_used=balance_used,
        payment_method=data.payment_method or "cash",
        status=OrderStatus.NEW,
    )
    db.add(order)
    await db.flush()

    for product, quantity in items_data:
        item = OrderItem(order_id=order.id, product_id=product.id, quantity=quantity, price=product.price)
        db.add(item)

    if bonus_used > 0:
        user.bonus_points = max(0.0, user.bonus_points - bonus_used)
    if balance_used > 0:
        user.balance = max(0.0, user.balance - balance_used)

    await db.commit()
    await db.refresh(order)

    result = await db.execute(
        select(Order).where(Order.id == order.id).options(*_order_opts())
    )
    order = result.scalar_one()
    return _order_to_out(order)


def _order_opts():
    return (
        selectinload(Order.items).selectinload(OrderItem.product),
        selectinload(Order.user),
        selectinload(Order.courier),
    )


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).where(Order.id == order_id).options(*_order_opts())
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _order_to_out(order)


@router.get("/user/{user_id}", response_model=list[OrderOut])
async def get_user_orders(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).where(Order.user_id == user_id)
        .options(*_order_opts())
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    return [_order_to_out(o) for o in orders]


@router.get("/", response_model=list[OrderOut])
async def get_all_orders(status: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Order).options(*_order_opts())
    if status:
        query = query.where(Order.status == status)
    query = query.order_by(Order.created_at.desc())
    result = await db.execute(query)
    orders = result.scalars().all()
    return [_order_to_out(o) for o in orders]


@router.patch("/{order_id}/confirm")
async def confirm_order(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    order.status = OrderStatus.CONFIRMED
    order.confirmed_at = datetime.utcnow()
    await db.commit()
    return {"ok": True, "status": order.status}


class RejectBody(BaseModel):
    reason: str = ""


@router.patch("/{order_id}/reject")
async def reject_order(order_id: int, body: RejectBody = RejectBody(), db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    order.status = OrderStatus.REJECTED
    order.rejection_reason = body.reason
    await db.commit()
    return {"ok": True}


@router.patch("/{order_id}/payment_confirmed")
async def payment_confirmed(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    order.payment_confirmed = True
    order.status = OrderStatus.AWAITING_CONFIRMATION
    await db.commit()
    return {"ok": True}


class AssignBody(BaseModel):
    courier_id: int


@router.patch("/{order_id}/assign_courier")
async def assign_courier(order_id: int, body: AssignBody, db: AsyncSession = Depends(get_db)):
    courier_id = body.courier_id
    order = await _get_order(order_id, db)
    result = await db.execute(select(Courier).where(Courier.id == courier_id))
    courier = result.scalar_one_or_none()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")
    order.courier_id = courier_id
    order.status = OrderStatus.ASSIGNED_TO_COURIER
    await db.commit()
    return {"ok": True}


@router.patch("/{order_id}/in_delivery")
async def start_delivery(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    order.status = OrderStatus.IN_DELIVERY
    await db.commit()
    return {"ok": True}


class DeliveredBody(BaseModel):
    cash_collected: bool = False


@router.patch("/{order_id}/delivered")
async def mark_delivered(order_id: int, body: DeliveredBody = DeliveredBody(), db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    order.status = OrderStatus.DELIVERED
    order.delivered_at = datetime.utcnow()
    order.cash_collected = body.cash_collected

    result = await db.execute(select(User).where(User.id == order.user_id))
    user = result.scalar_one_or_none()
    if user:
        bonus = order.total * 0.05  # 5% кэшбек бонусами
        user.bonus_points += bonus

    if order.courier_id:
        result = await db.execute(select(Courier).where(Courier.id == order.courier_id))
        courier = result.scalar_one_or_none()
        if courier:
            courier.total_deliveries += 1

    await db.commit()
    return {"ok": True}


@router.patch("/{order_id}/courier_accept")
async def courier_accept(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await _get_order(order_id, db)
    if order.status == OrderStatus.ASSIGNED_TO_COURIER:
        order.status = OrderStatus.IN_DELIVERY
        await db.commit()
    return {"ok": True}


@router.get("/courier/{telegram_id}", response_model=list[OrderOut])
async def get_courier_orders(telegram_id: int, db: AsyncSession = Depends(get_db)):
    courier_q = await db.execute(select(Courier).where(Courier.telegram_id == telegram_id))
    courier = courier_q.scalar_one_or_none()
    if not courier:
        return []
    result = await db.execute(
        select(Order)
        .where(Order.courier_id == courier.id)
        .options(*_order_opts())
        .order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    return [_order_to_out(o) for o in orders]


@router.post("/reviews/")
async def create_review(data: ReviewCreate, db: AsyncSession = Depends(get_db)):
    # Look up order to derive user_id and courier_id if not provided
    order = None
    if data.order_id:
        order_q = await db.execute(select(Order).where(Order.id == data.order_id))
        order = order_q.scalar_one_or_none()

    review = Review(
        order_id=data.order_id,
        user_id=data.user_id or (order.user_id if order else None),
        courier_id=data.courier_id or (order.courier_id if order else None),
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return {"ok": True, "id": review.id}


async def _get_order(order_id: int, db: AsyncSession) -> Order:
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _order_to_out(order: Order) -> OrderOut:
    from app.schemas.order import OrderItemOut
    items = [
        OrderItemOut(
            id=i.id,
            product_id=i.product_id,
            quantity=i.quantity,
            price=i.price,
            product_name=i.product.name if i.product else None,
        )
        for i in order.items
    ]
    return OrderOut(
        id=order.id,
        user_id=order.user_id,
        courier_id=order.courier_id,
        status=order.status,
        recipient_phone=order.recipient_phone,
        address=order.address,
        extra_info=order.extra_info,
        delivery_time=order.delivery_time,
        latitude=order.latitude,
        longitude=order.longitude,
        return_bottles_count=order.return_bottles_count,
        return_bottles_volume=order.return_bottles_volume,
        bottle_discount=order.bottle_discount,
        subtotal=order.subtotal,
        total=order.total,
        bonus_used=order.bonus_used,
        balance_used=order.balance_used,
        payment_method=order.payment_method,
        cash_collected=order.cash_collected,
        rejection_reason=order.rejection_reason,
        payment_confirmed=order.payment_confirmed,
        created_at=order.created_at,
        items=items,
        client_name=order.user.name if order.user else None,
        client_telegram_id=order.user.telegram_id if order.user else None,
        courier_name=order.courier.name if order.courier else None,
        courier_phone=order.courier.phone if order.courier else None,
    )
