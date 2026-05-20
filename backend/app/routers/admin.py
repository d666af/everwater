from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from datetime import datetime, timedelta
from pydantic import BaseModel
from app.database import get_db
from app.models.order import Order, OrderStatus, OrderItem
from app.models.product import Product
from app.models.user import User
from app.models.courier import Courier
from app.models.courier_product_earning import CourierProductEarning as _CPE
from app.models.manager import Manager
from app.models.support import SupportChat, SupportMessage
from app.models.client_data import SavedAddress, Subscription, BottleDebt
from app.schemas.order import CourierCreate, CourierOut
from app.services.settings_service import is_subscriptions_enabled
from app.models.warehouse import WaterTransaction
import aiohttp

router = APIRouter(prefix="/admin", tags=["admin"])


async def _ensure_subs_enabled(db: AsyncSession) -> None:
    if not await is_subscriptions_enabled(db):
        raise HTTPException(status_code=403, detail="Subscriptions are disabled")


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.get("/stats")
async def get_stats(
    period: str = "month",
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    if date_from:
        df = datetime.strptime(date_from, "%Y-%m-%d")
        since = datetime(df.year, df.month, df.day, 0, 0, 0)
        dt_str = date_to or date_from
        dt = datetime.strptime(dt_str, "%Y-%m-%d")
        until = datetime(dt.year, dt.month, dt.day, 23, 59, 59)
    else:
        until = now
        if period == "day":
            since = now - timedelta(days=1)
        elif period == "week":
            since = now - timedelta(weeks=1)
        else:
            since = now - timedelta(days=30)

    def _order_time(*extra):
        return and_(Order.created_at >= since, Order.created_at <= until, *extra)

    def _tx_time(*extra):
        return and_(WaterTransaction.created_at >= since, WaterTransaction.created_at <= until, *extra)

    delivered_q = await db.execute(
        select(Order).where(_order_time(Order.status == OrderStatus.DELIVERED))
    )
    orders = delivered_q.scalars().all()

    revenue = sum(o.total for o in orders)
    avg_check = revenue / len(orders) if orders else 0
    bottles_returned = sum(o.return_bottles_count for o in orders)
    delivery_revenue = sum(o.delivery_fee for o in orders if (o.delivery_fee or 0) > 0)
    delivery_orders_count = sum(1 for o in orders if (o.delivery_fee or 0) > 0)
    free_delivery_count = len(orders) - delivery_orders_count
    bonus_used = round(sum(float(o.bonus_used or 0) for o in orders), 2)

    # Bonus earned this period (computed from current settings)
    try:
        from app.services.settings_service import get_all_settings
        cfg = await get_all_settings(db)
    except Exception:
        cfg = {}
    bonus_per_bottle = float(cfg.get("bonus_per_bottle") or 0)
    cashback_pct = float(cfg.get("cashback_percent") or 0)
    permanent_min_orders = int(cfg.get("permanent_customer_min_orders") or 5)
    permanent_period_days = int(cfg.get("permanent_customer_period_days") or 0)
    inactive_days_val = int(cfg.get("inactive_customer_days") or 60)
    if bonus_per_bottle > 0 and orders:
        order_ids = [o.id for o in orders]
        bottles_q = await db.execute(
            select(func.sum(OrderItem.quantity))
            .join(Product, Product.id == OrderItem.product_id)
            .where(and_(OrderItem.order_id.in_(order_ids), Product.volume >= 18.9))
        )
        total_bottles = bottles_q.scalar() or 0
        bonus_earned = round(float(total_bottles) * bonus_per_bottle, 2)
    elif cashback_pct > 0:
        bonus_earned = round(revenue * cashback_pct / 100, 2)
    else:
        bonus_earned = 0.0

    cancelled_q = await db.execute(
        select(func.count(Order.id)).where(
            _order_time(Order.status == OrderStatus.REJECTED)
        )
    )
    cancelled = cancelled_q.scalar()

    repeat_q = await db.execute(
        select(Order.user_id, func.count(Order.id).label("cnt"))
        .where(_order_time(Order.status == OrderStatus.DELIVERED))
        .group_by(Order.user_id)
        .having(func.count(Order.id) > 1)
    )
    repeat_customers = len(repeat_q.fetchall())

    by_status_q = await db.execute(
        select(Order.status, func.count(Order.id).label("cnt"))
        .where(and_(Order.created_at >= since, Order.created_at <= until))
        .group_by(Order.status)
    )
    by_status = {str(row[0]).replace("OrderStatus.", "").lower(): row[1]
                 for row in by_status_q.fetchall()}

    # "Не возвращено": bottles that triggered surcharges in delivered orders this period
    surcharge_orders = [o for o in orders if (o.bottle_surcharge or 0) > 0]
    bottles_surcharge_total = round(sum(float(o.bottle_surcharge) for o in surcharge_orders), 2)
    if surcharge_orders:
        s_order_ids = [o.id for o in surcharge_orders]
        delivered_19l_q = await db.execute(
            select(func.sum(OrderItem.quantity))
            .join(Product, Product.id == OrderItem.product_id)
            .where(and_(OrderItem.order_id.in_(s_order_ids), Product.volume >= 18.9))
        )
        delivered_19l = int(delivered_19l_q.scalar() or 0)
        returned_19l = sum(o.return_bottles_count for o in surcharge_orders)
        bottles_surcharge_count = max(0, delivered_19l - returned_19l)
    else:
        bottles_surcharge_count = 0

    # "Долг": current outstanding bottle debt — clients + couriers (global)
    bottle_debt_count_q = await db.execute(select(func.sum(BottleDebt.count)))
    client_debt_count = int(bottle_debt_count_q.scalar() or 0)

    bottle_surcharge_price_q = await db.execute(
        select(Product.bottle_surcharge).where(
            and_(Product.volume >= 18.9, Product.bottle_surcharge.isnot(None))
        ).order_by(Product.bottle_surcharge.desc()).limit(1)
    )
    bottle_surcharge_price = float(bottle_surcharge_price_q.scalar() or 0)

    # Courier debt: 19L issued via WaterTransaction - returned via bottle_return
    prod_19l_q = await db.execute(select(Product.id).where(Product.volume >= 18.9))
    prod_19l_ids = [r[0] for r in prod_19l_q.all()]
    if prod_19l_ids:
        courier_issued_q = await db.execute(
            select(func.sum(WaterTransaction.quantity)).where(
                and_(WaterTransaction.transaction_type == "issue",
                     WaterTransaction.product_id.in_(prod_19l_ids))
            )
        )
    else:
        courier_issued_q = None
    courier_returned_q = await db.execute(
        select(func.sum(WaterTransaction.quantity)).where(
            WaterTransaction.transaction_type == "bottle_return"
        )
    )
    bottles_returned_to_warehouse_q = await db.execute(
        select(func.sum(WaterTransaction.quantity)).where(
            _tx_time(WaterTransaction.transaction_type == "bottle_return")
        )
    )
    bottles_returned_to_warehouse = int(bottles_returned_to_warehouse_q.scalar() or 0)
    courier_debt_count = max(
        0,
        ((courier_issued_q.scalar() if courier_issued_q else None) or 0)
        - (courier_returned_q.scalar() or 0)
    )

    bottle_debt_count = client_debt_count + courier_debt_count
    bottle_debt_value = round(bottle_debt_count * bottle_surcharge_price, 2)

    # Product sales breakdown for the period (with per-courier earning overrides)
    product_sales_q = await db.execute(
        select(
            Product.name,
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.quantity * OrderItem.price).label("total"),
            func.sum(
                OrderItem.quantity * func.coalesce(_CPE.earning, Product.courier_earning, 0)
            ).label("courier_earning_total"),
        )
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(Order, Order.id == OrderItem.order_id)
        .outerjoin(_CPE, and_(
            _CPE.product_id == Product.id,
            _CPE.courier_id == Order.courier_id,
        ))
        .where(_order_time(Order.status == OrderStatus.DELIVERED))
        .group_by(Product.id, Product.name)
        .order_by(func.sum(OrderItem.quantity).desc())
    )
    product_sales = [
        {
            "name": row.name,
            "qty": int(row.qty or 0),
            "total": round(float(row.total or 0), 2),
            "courier_earning": round(float(row.courier_earning_total or 0), 2),
        }
        for row in product_sales_q.all()
    ]

    # Warehouse sales: items issued from warehouse in the period
    # market = qty * sale price; cost = qty * cost_price (for the header total)
    warehouse_sales_q = await db.execute(
        select(
            Product.name,
            Product.cost_price,
            Product.price,
            func.sum(WaterTransaction.quantity).label("qty"),
        )
        .join(Product, Product.id == WaterTransaction.product_id)
        .where(
            _tx_time(
                WaterTransaction.transaction_type == "issue",
                WaterTransaction.product_id.isnot(None),
            )
        )
        .group_by(Product.id, Product.name, Product.cost_price, Product.price)
        .order_by(func.sum(WaterTransaction.quantity).desc())
    )
    warehouse_sales = [
        {
            "name": row.name,
            "qty": int(row.qty or 0),
            "market": round(float(row.price or 0) * int(row.qty or 0), 2),
            "cost": round(float(row.cost_price or 0) * int(row.qty or 0), 2),
        }
        for row in warehouse_sales_q.all()
    ]

    # Customer classification counts
    perm_filter = [Order.status == OrderStatus.DELIVERED]
    if permanent_period_days > 0:
        perm_filter.append(Order.created_at >= now - timedelta(days=permanent_period_days))
    permanent_sq = (
        select(Order.user_id)
        .where(and_(*perm_filter))
        .group_by(Order.user_id)
        .having(func.count(Order.id) >= permanent_min_orders)
        .subquery()
    )
    permanent_customers_q = await db.execute(select(func.count()).select_from(permanent_sq))
    permanent_customers = permanent_customers_q.scalar() or 0

    inactive_cutoff = now - timedelta(days=inactive_days_val)
    inactive_sq = (
        select(Order.user_id)
        .where(Order.status == OrderStatus.DELIVERED)
        .group_by(Order.user_id)
        .having(func.max(Order.created_at) < inactive_cutoff)
        .subquery()
    )
    inactive_customers_q = await db.execute(select(func.count()).select_from(inactive_sq))
    inactive_customers = inactive_customers_q.scalar() or 0

    return {
        "period": period,
        "order_count": len(orders),
        "revenue": round(revenue, 2),
        "avg_check": round(avg_check, 2),
        "bottles_returned": bottles_returned,
        "cancelled": cancelled,
        "repeat_customers": repeat_customers,
        "by_status": by_status,
        "delivery_revenue": round(delivery_revenue, 2),
        "delivery_orders_count": delivery_orders_count,
        "free_delivery_count": free_delivery_count,
        "bonus_used": bonus_used,
        "bonus_earned": bonus_earned,
        "bottles_surcharge_count": bottles_surcharge_count,
        "bottles_surcharge_total": bottles_surcharge_total,
        "product_sales": product_sales,
        "warehouse_sales": warehouse_sales,
        "bottle_debt_count": bottle_debt_count,
        "bottle_debt_value": bottle_debt_value,
        "bottle_debt_clients": client_debt_count,
        "bottle_debt_couriers": courier_debt_count,
        "bottles_returned_to_warehouse": bottles_returned_to_warehouse,
        "permanent_customers": permanent_customers,
        "inactive_customers": inactive_customers,
    }


@router.get("/stats/extended")
async def get_stats_extended(
    period: str = "month",
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    if date_from:
        df = datetime.strptime(date_from, "%Y-%m-%d")
        since = datetime(df.year, df.month, df.day, 0, 0, 0)
        dt_str = date_to or date_from
        dt = datetime.strptime(dt_str, "%Y-%m-%d")
        until = datetime(dt.year, dt.month, dt.day, 23, 59, 59)
        span = (until - since).total_seconds()
        prev_since = since - timedelta(seconds=span)
    else:
        until = now
        if period == "day":
            since = now - timedelta(days=1)
            prev_since = now - timedelta(days=2)
        elif period == "week":
            since = now - timedelta(weeks=1)
            prev_since = now - timedelta(weeks=2)
        else:
            since = now - timedelta(days=30)
            prev_since = now - timedelta(days=60)

    # Delivered orders this period
    orders_q = await db.execute(
        select(Order).where(and_(Order.status == OrderStatus.DELIVERED, Order.created_at >= since, Order.created_at <= until))
    )
    orders = orders_q.scalars().all()

    # Profit: sum of (price - cost_price) * quantity for delivered orders with known cost
    order_ids = [o.id for o in orders]
    profit = 0.0
    if order_ids:
        items_q = await db.execute(
            select(OrderItem, Product)
            .join(Product, Product.id == OrderItem.product_id)
            .where(OrderItem.order_id.in_(order_ids))
        )
        for item, product in items_q.all():
            if product.cost_price is not None:
                profit += (item.price - product.cost_price) * item.quantity

    # LTV: average revenue per user over all time
    ltv_q = await db.execute(
        select(Order.user_id, func.sum(Order.total).label("user_total"))
        .where(Order.status == OrderStatus.DELIVERED)
        .group_by(Order.user_id)
    )
    user_totals = [row.user_total for row in ltv_q.all()]
    ltv = sum(user_totals) / len(user_totals) if user_totals else 0.0

    # Bonus load: total outstanding bonus points
    bonus_load_q = await db.execute(
        select(func.sum(User.bonus_points)).where(User.bonus_points > 0)
    )
    bonus_load = bonus_load_q.scalar() or 0.0

    # Base growth: new users this period vs prev period
    new_this_q = await db.execute(
        select(func.count(User.id)).where(User.created_at >= since)
    )
    new_this = new_this_q.scalar() or 0

    new_prev_q = await db.execute(
        select(func.count(User.id)).where(
            and_(User.created_at >= prev_since, User.created_at < since)
        )
    )
    new_prev = new_prev_q.scalar() or 0
    growth_pct = ((new_this - new_prev) / new_prev * 100) if new_prev > 0 else None

    # Total users
    total_users_q = await db.execute(select(func.count(User.id)))
    total_users = total_users_q.scalar() or 0

    return {
        "period": period,
        "profit": round(profit, 2),
        "ltv": round(ltv, 2),
        "bonus_load": round(bonus_load, 2),
        "new_users": new_this,
        "prev_new_users": new_prev,
        "growth_pct": round(growth_pct, 1) if growth_pct is not None else None,
        "total_users": total_users,
    }


@router.get("/stats/cancelled-orders")
async def get_cancelled_orders_list(
    period: str = "day",
    date_from: str | None = None,
    date_to: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.utcnow()
    if date_from:
        df = datetime.strptime(date_from, "%Y-%m-%d")
        since = datetime(df.year, df.month, df.day, 0, 0, 0)
        dt_str = date_to or date_from
        dt = datetime.strptime(dt_str, "%Y-%m-%d")
        until = datetime(dt.year, dt.month, dt.day, 23, 59, 59)
    else:
        until = now
        if period == "day":
            since = now - timedelta(days=1)
        elif period == "week":
            since = now - timedelta(weeks=1)
        else:
            since = now - timedelta(days=30)

    q = await db.execute(
        select(Order, User.name.label("client_name"))
        .join(User, User.id == Order.user_id)
        .where(and_(Order.status == OrderStatus.REJECTED, Order.created_at >= since, Order.created_at <= until))
        .order_by(Order.created_at.desc())
    )
    rows = q.all()
    result = []
    for order, client_name in rows:
        reason = order.rejection_reason or order.cancellation_reason or ""
        if order.rejection_reason:
            cancelled_by = "Менеджер"
        elif order.cancellation_reason:
            cancelled_by = "Клиент"
        else:
            cancelled_by = "Администратор"
        result.append({
            "id": order.id,
            "client_name": client_name or "",
            "address": order.address or "",
            "total": round(order.total, 2),
            "reason": reason,
            "cancelled_by": cancelled_by,
            "created_at": order.created_at.isoformat(),
        })
    return result


# ─── Couriers ─────────────────────────────────────────────────────────────────

@router.get("/couriers/by_telegram/{telegram_id}")
async def get_courier_by_telegram(telegram_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Courier).where(Courier.telegram_id == telegram_id, Courier.is_active == True))
    courier = result.scalar_one_or_none()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")
    return {"id": courier.id, "telegram_id": courier.telegram_id, "name": courier.name,
            "phone": courier.phone, "is_active": courier.is_active, "total_deliveries": courier.total_deliveries}


@router.get("/managers/by_telegram/{telegram_id}")
async def get_manager_by_telegram(telegram_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Manager).where(Manager.telegram_id == telegram_id, Manager.is_active == True))
    mgr = result.scalar_one_or_none()
    if not mgr:
        raise HTTPException(status_code=404, detail="Manager not found")
    return {"id": mgr.id, "telegram_id": mgr.telegram_id, "name": mgr.name,
            "phone": mgr.phone, "is_active": mgr.is_active}


@router.get("/couriers", response_model=list[CourierOut])
async def get_couriers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Courier))
    return result.scalars().all()


@router.post("/couriers", response_model=CourierOut)
async def create_courier(data: CourierCreate, db: AsyncSession = Depends(get_db)):
    courier = Courier(**data.model_dump())
    db.add(courier)
    await db.commit()
    await db.refresh(courier)
    return courier


@router.get("/couriers/{courier_id}/details")
async def get_courier_details(courier_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Courier).where(Courier.id == courier_id))
    courier = result.scalar_one_or_none()
    if not courier:
        raise HTTPException(status_code=404, detail="Courier not found")

    today_q = await db.execute(
        select(func.count(Order.id)).where(
            and_(Order.courier_id == courier_id,
                 Order.status == OrderStatus.DELIVERED,
                 func.date(Order.delivered_at) == func.current_date())
        )
    )
    today_deliveries = today_q.scalar() or 0

    # Bottle debt: 19L issued minus returned via bottle_return transactions
    prod_19l_q = await db.execute(
        select(Product.id).where(Product.volume >= 18.9)
    )
    prod_19l_ids = [r[0] for r in prod_19l_q.all()]

    if prod_19l_ids:
        issued_q = await db.execute(
            select(func.sum(WaterTransaction.quantity)).where(
                and_(
                    WaterTransaction.courier_id == courier_id,
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
                WaterTransaction.courier_id == courier_id,
                WaterTransaction.transaction_type == "bottle_return",
            )
        )
    )
    total_issued = (issued_q.scalar() if issued_q else None) or 0
    total_returned = returned_q.scalar() or 0
    bottles_must_return = max(0, total_issued - total_returned)

    return {
        "courier_id": courier.id,
        "name": courier.name,
        "phone": courier.phone,
        "total_deliveries": courier.total_deliveries,
        "today_deliveries": today_deliveries,
        "total_revenue": courier.total_earnings,
        "avg_rating": courier.avg_rating if courier.avg_rating else None,
        "rating_count": courier.rating_count,
        "bottles_must_return": bottles_must_return,
    }


@router.delete("/couriers/{courier_id}")
async def deactivate_courier(courier_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Courier).where(Courier.id == courier_id))
    courier = result.scalar_one_or_none()
    if courier:
        courier.is_active = False
        await db.commit()
    return {"ok": True}


class CourierUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    vehicle_type: str | None = None
    vehicle_plate: str | None = None


@router.patch("/couriers/{courier_id}")
async def update_courier(courier_id: int, data: CourierUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Courier).where(Courier.id == courier_id))
    courier = result.scalar_one_or_none()
    if not courier:
        raise HTTPException(404, "Courier not found")
    payload = data.model_dump(exclude_unset=True)
    for k, v in payload.items():
        setattr(courier, k, v)
    await db.commit()
    await db.refresh(courier)
    return {
        "id": courier.id, "name": courier.name, "phone": courier.phone,
        "vehicle_type": courier.vehicle_type, "vehicle_plate": courier.vehicle_plate,
    }


# ─── Users ────────────────────────────────────────────────────────────────────

@router.get("/users")
async def get_all_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User)
        .where(User.phone.isnot(None), User.phone != "")
        .order_by(User.is_registered.desc(), User.created_at.desc())
    )
    users = result.scalars().all()

    orders_q = await db.execute(
        select(Order.user_id, func.count(Order.id).label('cnt')).group_by(Order.user_id)
    )
    orders_map = {row.user_id: row.cnt for row in orders_q.all()}

    bottles_q = await db.execute(select(BottleDebt))
    bottles_map = {b.user_id: b.count for b in bottles_q.scalars().all()}

    # Load classification settings first to build the right queries
    from app.services.settings_service import get_all_settings
    cfg = await get_all_settings(db)
    permanent_min = int(cfg.get("permanent_customer_min_orders") or 5)
    permanent_period = int(cfg.get("permanent_customer_period_days") or 0)
    inactive_days_val = int(cfg.get("inactive_customer_days") or 60)
    inactive_cutoff = datetime.utcnow() - timedelta(days=inactive_days_val)
    perm_since = datetime.utcnow() - timedelta(days=permanent_period) if permanent_period > 0 else None

    # Delivered order counts for classification (period-scoped if configured)
    perm_count_filter = [Order.status == OrderStatus.DELIVERED]
    if perm_since:
        perm_count_filter.append(Order.created_at >= perm_since)
    delivered_counts_q = await db.execute(
        select(Order.user_id, func.count(Order.id).label('delivered_cnt'))
        .where(and_(*perm_count_filter))
        .group_by(Order.user_id)
    )
    delivered_counts_map = {row.user_id: row.delivered_cnt for row in delivered_counts_q.all()}

    last_order_q = await db.execute(
        select(Order.user_id, func.max(Order.created_at).label('last_at'))
        .where(Order.status == OrderStatus.DELIVERED)
        .group_by(Order.user_id)
    )
    last_order_map = {row.user_id: row.last_at for row in last_order_q.all()}

    def _label(user_id):
        cnt = delivered_counts_map.get(user_id, 0)
        last_at = last_order_map.get(user_id)
        if cnt >= permanent_min:
            return "permanent"
        if last_at is not None and last_at < inactive_cutoff:
            return "inactive"
        return None

    return [
        {
            "id": u.id,
            "telegram_id": u.telegram_id,
            "name": u.name,
            "phone": u.phone,
            "is_registered": u.is_registered,
            "bonus_points": u.bonus_points,
            "created_at": u.created_at,
            "orders_count": orders_map.get(u.id, 0),
            "bottles_owed": bottles_map.get(u.id, 0),
            "last_order_at": last_order_map.get(u.id),
            "customer_label": _label(u.id),
        }
        for u in users
    ]


@router.get("/users/{user_id}/details")
async def get_user_details(user_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    addrs_q = await db.execute(
        select(SavedAddress).where(SavedAddress.user_id == user_id).order_by(SavedAddress.created_at.desc())
    )
    addresses = [
        {"id": a.id, "label": a.label, "address": a.address,
         "lat": a.latitude, "lng": a.longitude}
        for a in addrs_q.scalars().all()
    ]

    if await is_subscriptions_enabled(db):
        subs_q = await db.execute(
            select(Subscription).where(Subscription.user_id == user_id).order_by(Subscription.created_at.desc())
        )
        subscriptions = [
            {"id": s.id, "plan": s.plan, "water_summary": s.water_summary,
             "qty": s.qty, "address": s.address, "day": s.day,
             "status": s.status, "created_at": s.created_at}
            for s in subs_q.scalars().all()
        ]
    else:
        subscriptions = []

    bottles_q = await db.execute(select(BottleDebt).where(BottleDebt.user_id == user_id))
    bottle_row = bottles_q.scalar_one_or_none()
    bottles_owed = bottle_row.count if bottle_row else 0

    pending_return = int((await db.execute(
        select(func.sum(Order.return_bottles_count)).where(
            Order.user_id == user_id,
            Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.ASSIGNED_TO_COURIER, OrderStatus.IN_DELIVERY]),
            Order.return_bottles_count > 0,
        )
    )).scalar() or 0)

    orders_q = await db.execute(
        select(Order).where(Order.user_id == user_id).order_by(Order.created_at.desc()).limit(20)
    )
    orders = [
        {"id": o.id, "status": o.status, "total": o.total,
         "created_at": o.created_at, "address": o.address}
        for o in orders_q.scalars().all()
    ]

    return {
        "id": user.id,
        "telegram_id": user.telegram_id,
        "name": user.name,
        "phone": user.phone,
        "bonus_points": user.bonus_points,
        "is_registered": user.is_registered,
        "created_at": user.created_at,
        "addresses": addresses,
        "subscriptions": subscriptions,
        "bottles_owed": bottles_owed,
        "pending_return": pending_return,
        "available_bottles": max(0, bottles_owed - pending_return),
        "recent_orders": orders,
        "coolers": [],
    }




# ─── Subscriptions (admin view) ───────────────────────────────────────────────

_WEEKDAY_MAP = {
    "Понедельник": 0, "Вторник": 1, "Среда": 2, "Четверг": 3,
    "Пятница": 4, "Суббота": 5, "Воскресенье": 6,
}


def _calc_next_delivery(plan: str, day: str | None, from_dt: datetime | None = None) -> datetime | None:
    base = (from_dt or datetime.utcnow()).replace(hour=0, minute=0, second=0, microsecond=0)
    if plan == "monthly":
        return base + timedelta(days=30)
    if plan == "biweekly":
        return base + timedelta(days=14)
    if plan == "ten_days":
        return base + timedelta(days=10)
    if plan == "weekly" and day:
        target_dow = _WEEKDAY_MAP.get(day, 0)
        days_ahead = (target_dow - base.weekday()) % 7 or 7
        return base + timedelta(days=days_ahead)
    return None


def _sub_out(sub: Subscription, user: User) -> dict:
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    ndd = sub.next_delivery_date
    if ndd is None:
        ndd = _calc_next_delivery(sub.plan, sub.day, sub.created_at)
    overdue = bool(ndd and ndd.date() < today.date())
    due_today = bool(ndd and ndd.date() == today.date())
    return {
        "id": sub.id,
        "type": "subscription",
        "user_id": sub.user_id,
        "client_name": user.name or "",
        "client_telegram_id": user.telegram_id,
        "recipient_phone": sub.phone or user.phone or "",
        "client_phone": user.phone or "",
        "water_summary": sub.water_summary,
        "qty": sub.qty,
        "total": sub.total or 0,
        "address": sub.address,
        "landmark": sub.landmark,
        "phone": sub.phone or user.phone or "",
        "day": sub.day,
        "time_slot": sub.time_slot,
        "payment_method": sub.payment_method,
        "payment_confirmed": sub.payment_confirmed,
        "status": sub.status,
        "plan": sub.plan,
        "created_at": sub.created_at.isoformat(),
        "next_delivery_date": ndd.isoformat() if ndd else None,
        "last_delivered_at": sub.last_delivered_at.isoformat() if sub.last_delivered_at else None,
        "overdue": overdue,
        "due_today": due_today,
        "items": [],
    }


@router.get("/subscriptions")
async def list_all_subscriptions(
    status: str = "all",
    plan: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    if not await is_subscriptions_enabled(db):
        return []
    q = select(Subscription, User).join(User, User.id == Subscription.user_id)
    if status == "pending":
        q = q.where(Subscription.payment_confirmed == False)
    elif status != "all":
        q = q.where(Subscription.status == status)
    if plan:
        q = q.where(Subscription.plan == plan)
    q = q.order_by(Subscription.created_at.desc())
    rows = (await db.execute(q)).all()
    return [_sub_out(sub, user) for sub, user in rows]


@router.post("/subscriptions/{sub_id}/create_order")
async def create_order_from_sub(sub_id: int, db: AsyncSession = Depends(get_db)):
    """Create a delivery order from an active subscription and advance its delivery date."""
    import re
    from app.models.order import OrderItem
    from app.routers.warehouse import _resolve_product

    await _ensure_subs_enabled(db)
    sub_q = await db.execute(select(Subscription).where(Subscription.id == sub_id))
    sub = sub_q.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.status != "active":
        raise HTTPException(status_code=400, detail="Subscription not active")

    user_q = await db.execute(select(User).where(User.id == sub.user_id))
    user = user_q.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Parse "Вода 20л x2, Газ. вода 1.5л x1"
    items_data: list[tuple] = []
    for part in sub.water_summary.split(","):
        part = part.strip()
        if not part:
            continue
        m = re.match(r"(.+?)\s*[xхX×]\s*(\d+)", part)
        name = m.group(1).strip() if m else part
        qty = int(m.group(2)) if m else 1
        try:
            product = await _resolve_product(db, None, name)
            items_data.append((product, qty))
        except HTTPException:
            pass

    if not items_data:
        raise HTTPException(status_code=400, detail="Could not resolve products from water_summary")

    subtotal = sum(p.price * q for p, q in items_data)

    order = Order(
        user_id=sub.user_id,
        recipient_phone=sub.phone or user.phone or "",
        address=sub.address,
        extra_info=sub.landmark,
        latitude=sub.latitude,
        longitude=sub.longitude,
        subtotal=subtotal,
        total=subtotal,
        payment_method=sub.payment_method,
        status=OrderStatus.CONFIRMED,
        confirmed_at=datetime.utcnow(),
    )
    db.add(order)
    await db.flush()

    for product, qty in items_data:
        db.add(OrderItem(order_id=order.id, product_id=product.id, quantity=qty, price=product.price))

    sub.last_delivered_at = datetime.utcnow()
    sub.next_delivery_date = _calc_next_delivery(sub.plan, sub.day, datetime.utcnow())

    await db.commit()

    items_text = ", ".join(f"{p.name} {q} шт." for p, q in items_data)
    return {
        "order_id": order.id,
        "total": subtotal,
        "items_count": len(items_data),
        "items_text": items_text,
        "client_name": user.name or "",
        "address": sub.address,
        "next_delivery_date": sub.next_delivery_date.isoformat() if sub.next_delivery_date else None,
    }


@router.post("/subscriptions/{sub_id}/confirm")
async def confirm_subscription(sub_id: int, db: AsyncSession = Depends(get_db)):
    from app.config import settings as cfg
    from app.services.tg_notify import edit_all_notifications
    await _ensure_subs_enabled(db)
    sub_q = await db.execute(select(Subscription).where(Subscription.id == sub_id))
    sub = sub_q.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.payment_confirmed and sub.status == "active":
        raise HTTPException(status_code=409, detail="Already confirmed")

    msg_ids_json = sub.notification_msg_ids
    sub.payment_confirmed = True
    sub.status = "active"
    await db.commit()

    plan_label = {"weekly": "Еженедельная", "monthly": "Ежемесячная"}.get(sub.plan, sub.plan)
    await edit_all_notifications(msg_ids_json, f"✅ {plan_label} подписка #{sub_id} подтверждена")

    user_q = await db.execute(select(User).where(User.id == sub.user_id))
    user = user_q.scalar_one_or_none()
    if user and user.telegram_id:
        try:
            async with aiohttp.ClientSession() as s:
                await s.post(
                    f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage",
                    json={"chat_id": user.telegram_id, "text": f"✅ Ваша подписка подтверждена и активирована!"},
                    timeout=aiohttp.ClientTimeout(total=5),
                )
        except Exception:
            pass

    return {"ok": True}


@router.post("/subscriptions/{sub_id}/reject")
async def reject_subscription(sub_id: int, db: AsyncSession = Depends(get_db)):
    from app.config import settings as cfg
    from app.services.tg_notify import edit_all_notifications
    await _ensure_subs_enabled(db)
    sub_q = await db.execute(select(Subscription).where(Subscription.id == sub_id))
    sub = sub_q.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    if sub.status == "cancelled":
        raise HTTPException(status_code=409, detail="Already rejected")

    msg_ids_json = sub.notification_msg_ids
    sub.status = "cancelled"
    sub.payment_confirmed = False
    await db.commit()

    plan_label = {"weekly": "Еженедельная", "monthly": "Ежемесячная"}.get(sub.plan, sub.plan)
    await edit_all_notifications(msg_ids_json, f"❌ {plan_label} подписка #{sub_id} отклонена")

    user_q = await db.execute(select(User).where(User.id == sub.user_id))
    user = user_q.scalar_one_or_none()
    if user and user.telegram_id:
        try:
            async with aiohttp.ClientSession() as s:
                await s.post(
                    f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage",
                    json={"chat_id": user.telegram_id, "text": f"❌ Ваша подписка отклонена. Обратитесь в поддержку."},
                    timeout=aiohttp.ClientTimeout(total=5),
                )
        except Exception:
            pass

    return {"ok": True}


# ─── Managers (DB-backed) ─────────────────────────────────────────────────────

class ManagerCreate(BaseModel):
    name: str
    phone: str = ""
    telegram_id: int


@router.get("/managers")
async def get_managers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Manager).order_by(Manager.created_at.desc()))
    mgrs = result.scalars().all()
    return [
        {"id": m.id, "name": m.name, "phone": m.phone,
         "telegram_id": m.telegram_id, "is_active": m.is_active,
         "created_at": m.created_at.isoformat()}
        for m in mgrs
    ]


@router.post("/managers")
async def create_manager(data: ManagerCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Manager).where(Manager.telegram_id == data.telegram_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Manager with this telegram_id already exists")
    mgr = Manager(name=data.name, phone=data.phone or None, telegram_id=data.telegram_id)
    db.add(mgr)
    await db.commit()
    await db.refresh(mgr)
    return {"id": mgr.id, "name": mgr.name, "phone": mgr.phone,
            "telegram_id": mgr.telegram_id, "is_active": mgr.is_active,
            "created_at": mgr.created_at.isoformat()}


@router.delete("/managers/{manager_id}")
async def deactivate_manager(manager_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Manager).where(Manager.id == manager_id))
    mgr = result.scalar_one_or_none()
    if mgr:
        mgr.is_active = False
        await db.commit()
    return {"ok": True}


# ─── Settings (DB-backed key-value) ──────────────────────────────────────────

@router.get("/settings")
async def get_settings(db: AsyncSession = Depends(get_db)):
    from app.services.settings_service import get_all_settings
    return await get_all_settings(db)


@router.patch("/settings")
async def update_settings_route(data: dict, db: AsyncSession = Depends(get_db)):
    from app.services.settings_service import update_settings
    result = await update_settings(db, data)
    return {"ok": True, **result}


# ─── Broadcast (sends real Telegram messages) ─────────────────────────────────

class BroadcastData(BaseModel):
    message: str
    target: str = "all"  # "all" | "managers" | "couriers"


@router.post("/broadcast")
async def broadcast_message(data: BroadcastData, db: AsyncSession = Depends(get_db)):
    from app.config import settings as cfg

    telegram_ids: list[int] = []

    if data.target in ("all", "clients"):
        users_q = await db.execute(
            select(User.telegram_id).where(User.is_registered == True, User.telegram_id.isnot(None))
        )
        telegram_ids.extend(r[0] for r in users_q.all())

    if data.target in ("all", "couriers"):
        couriers_q = await db.execute(
            select(Courier.telegram_id).where(Courier.is_active == True)
        )
        telegram_ids.extend(r[0] for r in couriers_q.all())

    if data.target in ("all", "managers"):
        mgrs_q = await db.execute(
            select(Manager.telegram_id).where(Manager.is_active == True)
        )
        telegram_ids.extend(r[0] for r in mgrs_q.all())

    telegram_ids = list(set(telegram_ids))
    sent, failed = 0, 0
    tg_url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage"

    async with aiohttp.ClientSession() as session:
        for tg_id in telegram_ids:
            try:
                async with session.post(tg_url, json={"chat_id": tg_id, "text": data.message}) as resp:
                    if resp.status == 200:
                        sent += 1
                    else:
                        failed += 1
            except Exception:
                failed += 1

    return {"ok": True, "sent": sent, "failed": failed, "total": len(telegram_ids)}


# ─── Notifications (in-memory cache; events are pushed by order actions) ─────

_notifications: list[dict] = []
_id_counter = 1


def push_notification(title: str, body: str, ntype: str = "info"):
    global _notifications, _id_counter
    _notifications.append({
        "id": _id_counter,
        "type": ntype,
        "title": title,
        "body": body,
        "read": False,
        "time": datetime.utcnow().isoformat(),
    })
    _id_counter += 1
    if len(_notifications) > 200:
        _notifications = _notifications[-200:]


@router.get("/notifications")
async def get_notifications():
    return list(reversed(_notifications))


@router.patch("/notifications/{notif_id}/read")
async def mark_notification_read(notif_id: int):
    global _notifications
    _notifications = [
        {**n, "read": True} if n.get("id") == notif_id else n
        for n in _notifications
    ]
    return {"ok": True}


@router.patch("/notifications/read_all")
async def mark_all_read():
    global _notifications
    _notifications = [{**n, "read": True} for n in _notifications]
    return {"ok": True}


# ─── Support Chats (DB-backed) ───────────────────────────────────────────────

def _chat_out(chat: SupportChat) -> dict:
    return {
        "id": chat.id,
        "name": chat.user_name or str(chat.id),
        "last_message": chat.last_message,
        "last_time": chat.last_time.isoformat() if chat.last_time else None,
        "unread": chat.unread_count,
    }


def _msg_out(msg: SupportMessage) -> dict:
    return {
        "id": msg.id,
        "from": "support" if msg.from_admin else "user",
        "text": msg.text,
        "time": msg.created_at.isoformat() if msg.created_at else None,
    }


@router.get("/support/chats")
async def get_support_chats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SupportChat).order_by(SupportChat.last_time.desc())
    )
    return [_chat_out(c) for c in result.scalars().all()]


@router.get("/support/chats/{chat_id}/messages")
async def get_chat_messages(chat_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.chat_id == chat_id)
        .order_by(SupportMessage.created_at)
    )
    return [_msg_out(m) for m in result.scalars().all()]


class MessageData(BaseModel):
    text: str


@router.post("/support/chats/{chat_id}/messages")
async def send_admin_message(chat_id: int, data: MessageData, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupportChat).where(SupportChat.id == chat_id))
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    now = datetime.utcnow()
    msg = SupportMessage(
        chat_id=chat_id,
        text=data.text,
        from_admin=True,
        delivered=False,
        created_at=now,
    )
    db.add(msg)
    chat.last_message = data.text
    chat.last_time = now
    await db.commit()
    await db.refresh(msg)
    return _msg_out(msg)


@router.patch("/support/chats/{chat_id}/read")
async def mark_chat_read(chat_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupportChat).where(SupportChat.id == chat_id))
    chat = result.scalar_one_or_none()
    if chat:
        chat.unread_count = 0
        await db.commit()
    return {"ok": True}


class UserMessageData(BaseModel):
    telegram_id: int
    user_name: str = ""
    text: str


@router.post("/support/user_message")
async def receive_user_message(data: UserMessageData, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupportChat).where(SupportChat.id == data.telegram_id))
    chat = result.scalar_one_or_none()
    now = datetime.utcnow()
    if not chat:
        chat = SupportChat(
            id=data.telegram_id,
            user_name=data.user_name,
            unread_count=0,
            last_message="",
            last_time=now,
        )
        db.add(chat)
        await db.flush()
    chat.unread_count = (chat.unread_count or 0) + 1
    chat.last_message = data.text
    chat.last_time = now
    if data.user_name:
        chat.user_name = data.user_name
    msg = SupportMessage(
        chat_id=data.telegram_id,
        text=data.text,
        from_admin=False,
        delivered=True,
        created_at=now,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return _msg_out(msg)


@router.get("/support/undelivered")
async def get_undelivered_messages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SupportMessage)
        .where(SupportMessage.from_admin == True, SupportMessage.delivered == False)
        .order_by(SupportMessage.created_at)
    )
    return [_msg_out(m) | {"chat_id": m.chat_id} for m in result.scalars().all()]


@router.patch("/support/messages/{msg_id}/delivered")
async def mark_message_delivered(msg_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupportMessage).where(SupportMessage.id == msg_id))
    msg = result.scalar_one_or_none()
    if msg:
        msg.delivered = True
        await db.commit()
    return {"ok": True}


# ─── Cron helpers ──────────────────────────────────────────────────────────────

@router.get("/cron/delivery-eta")
async def cron_delivery_eta(db: AsyncSession = Depends(get_db)):
    """Returns in_delivery orders with ETA info and courier telegram_id."""
    result = await db.execute(
        select(Order, Courier.telegram_id.label("courier_tg_id"))
        .join(Courier, Order.courier_id == Courier.id, isouter=True)
        .where(
            Order.status == OrderStatus.IN_DELIVERY,
            Order.delivery_expected_at.isnot(None),
        )
    )
    rows = result.all()
    return [
        {
            "order_id": order.id,
            "delivery_expected_at": order.delivery_expected_at.isoformat(),
            "delivery_reminder_sent": order.delivery_reminder_sent,
            "delivery_reminder_2_sent": order.delivery_reminder_2_sent,
            "courier_telegram_id": courier_tg_id,
        }
        for order, courier_tg_id in rows
    ]


class MarkReminderBody(BaseModel):
    order_id: int
    reminder_num: int  # 1 or 2


@router.post("/cron/mark-delivery-reminder")
async def cron_mark_delivery_reminder(body: MarkReminderBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == body.order_id))
    order = result.scalar_one_or_none()
    if order:
        if body.reminder_num == 1:
            order.delivery_reminder_sent = True
        else:
            order.delivery_reminder_2_sent = True
        await db.commit()
    return {"ok": True}


@router.post("/cron/expire-bonuses")
async def cron_expire_bonuses(db: AsyncSession = Depends(get_db)):
    """Expire bonuses for users past their expiry date. Returns list for bot notifications."""
    now = datetime.utcnow()
    result = await db.execute(
        select(User).where(
            User.bonus_expires_at <= now,
            User.bonus_points > 0,
            User.telegram_id.isnot(None),
        )
    )
    users = result.scalars().all()
    expired = [{"telegram_id": u.telegram_id, "bonus_points": u.bonus_points} for u in users]
    for u in users:
        u.bonus_points = 0.0
        u.bonus_expires_at = None
    if expired:
        await db.commit()
    return expired


@router.get("/cron/bonus-warnings")
async def cron_bonus_warnings(db: AsyncSession = Depends(get_db)):
    """Users whose bonuses expire in the next 7-day window (1-hour slot to avoid duplicate sends)."""
    now = datetime.utcnow()
    window_end = now + timedelta(days=7)
    window_start = window_end - timedelta(hours=1)
    result = await db.execute(
        select(User).where(
            User.bonus_expires_at >= window_start,
            User.bonus_expires_at < window_end,
            User.bonus_points > 0,
            User.telegram_id.isnot(None),
        )
    )
    users = result.scalars().all()
    return [{"telegram_id": u.telegram_id, "bonus_points": u.bonus_points} for u in users]


@router.get("/cron/subscription-reminders")
async def cron_subscription_reminders(db: AsyncSession = Depends(get_db)):
    """Active subscriptions with next delivery in <24h that haven't been reminded yet."""
    if not await is_subscriptions_enabled(db):
        return []
    now = datetime.utcnow()
    tomorrow = now + timedelta(hours=24)
    result = await db.execute(
        select(Subscription, User.telegram_id.label("tg_id"))
        .join(User, Subscription.user_id == User.id)
        .where(
            Subscription.status == "active",
            Subscription.next_delivery_date.between(now, tomorrow),
            or_(
                Subscription.reminder_sent_at.is_(None),
                Subscription.reminder_sent_at < Subscription.next_delivery_date - timedelta(hours=24),
            ),
            User.telegram_id.isnot(None),
        )
    )
    rows = result.all()
    return [
        {
            "sub_id": sub.id,
            "telegram_id": tg_id,
            "next_delivery_date": sub.next_delivery_date.isoformat() if sub.next_delivery_date else None,
            "water_summary": sub.water_summary,
        }
        for sub, tg_id in rows
    ]


class MarkSubRemindedBody(BaseModel):
    sub_id: int


@router.post("/cron/mark-subscription-reminded")
async def cron_mark_subscription_reminded(body: MarkSubRemindedBody, db: AsyncSession = Depends(get_db)):
    if not await is_subscriptions_enabled(db):
        return {"ok": True, "skipped": True}
    result = await db.execute(select(Subscription).where(Subscription.id == body.sub_id))
    sub = result.scalar_one_or_none()
    if sub:
        sub.reminder_sent_at = datetime.utcnow()
        await db.commit()
    return {"ok": True}


# ─── Coolers ─────────────────────────────────────────────────────────────────

from app.models.cooler import Cooler, CoolerPayment
from sqlalchemy.orm import selectinload as _sil


def _cooler_out(c: Cooler) -> dict:
    total_paid = sum(p.amount for p in c.payments)
    remaining = max(0.0, c.price - total_paid)
    return {
        "id": c.id,
        "user_id": c.user_id,
        "name": c.name,
        "price": c.price,
        "total_paid": total_paid,
        "remaining": remaining,
        "created_at": c.created_at.isoformat(),
        "payments": [
            {"id": p.id, "amount": p.amount, "note": p.note,
             "created_at": p.created_at.isoformat()}
            for p in c.payments
        ],
    }


@router.get("/users/{user_id}/coolers")
async def list_user_coolers(user_id: int, db: AsyncSession = Depends(get_db)):
    q = await db.execute(
        select(Cooler).where(Cooler.user_id == user_id)
        .options(_sil(Cooler.payments))
        .order_by(Cooler.created_at.desc())
    )
    return [_cooler_out(c) for c in q.scalars().all()]


class CoolerBody(BaseModel):
    name: str
    price: float = 0.0


@router.post("/users/{user_id}/coolers")
async def add_user_cooler(user_id: int, body: CoolerBody, db: AsyncSession = Depends(get_db)):
    c = Cooler(user_id=user_id, name=body.name.strip(), price=body.price)
    db.add(c)
    await db.commit()
    await db.refresh(c)
    c.payments = []
    return _cooler_out(c)


@router.delete("/users/{user_id}/coolers/{cooler_id}")
async def remove_user_cooler(user_id: int, cooler_id: int, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(
        select(Cooler).where(Cooler.id == cooler_id, Cooler.user_id == user_id)
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Cooler not found")
    await db.delete(c)
    await db.commit()
    return {"ok": True}


class CoolerPaymentBody(BaseModel):
    amount: float
    note: str | None = None


@router.post("/coolers/{cooler_id}/payments")
async def add_cooler_payment(cooler_id: int, body: CoolerPaymentBody, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(
        select(Cooler).where(Cooler.id == cooler_id).options(_sil(Cooler.payments))
    )).scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Cooler not found")
    p = CoolerPayment(cooler_id=cooler_id, amount=body.amount, note=body.note)
    db.add(p)
    await db.commit()
    await db.refresh(p)
    c.payments.append(p)
    return _cooler_out(c)
