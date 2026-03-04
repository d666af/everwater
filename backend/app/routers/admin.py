from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import datetime, timedelta
from app.database import get_db
from app.models.order import Order, OrderStatus
from app.models.user import User
from app.models.courier import Courier
from app.schemas.order import CourierCreate, CourierOut

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
async def get_stats(period: str = "month", db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    if period == "day":
        since = now - timedelta(days=1)
    elif period == "week":
        since = now - timedelta(weeks=1)
    else:
        since = now - timedelta(days=30)

    delivered_orders = await db.execute(
        select(Order).where(
            and_(Order.status == OrderStatus.DELIVERED, Order.created_at >= since)
        )
    )
    orders = delivered_orders.scalars().all()

    total_revenue = sum(o.total for o in orders)
    avg_check = total_revenue / len(orders) if orders else 0
    total_bottles_returned = sum(o.return_bottles_count for o in orders)

    cancelled = await db.execute(
        select(func.count(Order.id)).where(
            and_(Order.status == OrderStatus.REJECTED, Order.created_at >= since)
        )
    )
    cancelled_count = cancelled.scalar()

    # Повторные клиенты — те кто сделал больше 1 заказа
    repeat_users = await db.execute(
        select(Order.user_id, func.count(Order.id).label("cnt"))
        .where(Order.status == OrderStatus.DELIVERED)
        .group_by(Order.user_id)
        .having(func.count(Order.id) > 1)
    )
    repeat_count = len(repeat_users.fetchall())

    # Заказы по курьерам
    by_courier = await db.execute(
        select(Order.courier_id, func.count(Order.id).label("cnt"))
        .where(and_(Order.status == OrderStatus.DELIVERED, Order.created_at >= since))
        .group_by(Order.courier_id)
    )
    courier_stats = [{"courier_id": r[0], "orders": r[1]} for r in by_courier.fetchall()]

    return {
        "period": period,
        "total_orders": len(orders),
        "total_revenue": round(total_revenue, 2),
        "avg_check": round(avg_check, 2),
        "total_bottles_returned": total_bottles_returned,
        "cancelled_orders": cancelled_count,
        "repeat_customers": repeat_count,
        "by_courier": courier_stats,
    }


@router.get("/couriers", response_model=list[CourierOut])
async def get_couriers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Courier).where(Courier.is_active == True))
    return result.scalars().all()


@router.post("/couriers", response_model=CourierOut)
async def create_courier(data: CourierCreate, db: AsyncSession = Depends(get_db)):
    courier = Courier(**data.model_dump())
    db.add(courier)
    await db.commit()
    await db.refresh(courier)
    return courier


@router.delete("/couriers/{courier_id}")
async def deactivate_courier(courier_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Courier).where(Courier.id == courier_id))
    courier = result.scalar_one_or_none()
    if courier:
        courier.is_active = False
        await db.commit()
    return {"ok": True}


@router.get("/users")
async def get_all_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "telegram_id": u.telegram_id,
            "name": u.name,
            "phone": u.phone,
            "is_registered": u.is_registered,
            "balance": u.balance,
            "bonus_points": u.bonus_points,
            "created_at": u.created_at,
        }
        for u in users
    ]
