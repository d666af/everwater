"""Water depletion forecast: predict when each client will run out of water."""
from datetime import datetime, timedelta
from sqlalchemy import select, func, text as _text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.order import Order, OrderStatus, OrderItem
from app.models.product import Product
from app.models.user import User


async def calculate_water_forecast(db: AsyncSession, cfg: dict) -> list[dict]:
    """Return users whose water is predicted to run out soon (urgency != 'ok')."""
    if not cfg.get("forecast_enabled", True):
        return []

    warning_days = int(cfg.get("forecast_warning_days", 5))
    critical_days = int(cfg.get("forecast_critical_days", 2))
    lookback = int(cfg.get("forecast_orders_lookback", 5))
    default_interval = int(cfg.get("forecast_default_interval_days", 14))

    # Guard against inverted thresholds (admin mis-set critical > warning)
    critical_days = min(critical_days, max(0, warning_days - 1))

    users_q = await db.execute(
        select(User).where(User.phone.isnot(None), User.phone != "")
    )
    users_map = {u.id: u for u in users_q.scalars().all()}

    orders_q = await db.execute(
        select(Order.id, Order.user_id, Order.created_at)
        .where(
            Order.status == OrderStatus.DELIVERED,
            Order.user_id.isnot(None),
            Order.is_deleted == False,
        )
        .order_by(Order.user_id, Order.created_at.desc())
    )

    # user_id → list of (order_id, created_at), newest first, capped at lookback
    user_orders: dict[int, list[tuple[int, datetime]]] = {}
    for row in orders_q.all():
        uid = row.user_id
        if uid not in user_orders:
            user_orders[uid] = []
        if len(user_orders[uid]) < lookback:
            user_orders[uid].append((row.id, row.created_at))

    # Fetch total water volume (liters) per order in one query
    all_order_ids = [oid for orders in user_orders.values() for oid, _ in orders]
    order_volume_map: dict[int, float] = {}
    if all_order_ids:
        vol_q = await db.execute(
            select(
                OrderItem.order_id,
                func.sum(OrderItem.quantity * Product.volume).label("vol"),
            )
            .join(Product, Product.id == OrderItem.product_id)
            .where(OrderItem.order_id.in_(all_order_ids))
            .group_by(OrderItem.order_id)
        )
        order_volume_map = {row.order_id: float(row.vol or 0) for row in vol_q.all()}

    # Most recent delivered-order address per user (fallback display name)
    recent_addr_q = await db.execute(
        _text(
            "SELECT DISTINCT ON (user_id) user_id, address FROM orders "
            "WHERE user_id IS NOT NULL AND status = 'delivered' "
            "ORDER BY user_id, created_at DESC"
        )
    )
    recent_addr_map = {row.user_id: row.address for row in recent_addr_q.all()}

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    results = []

    for uid, order_list in user_orders.items():
        if uid not in users_map:
            continue
        u = users_map[uid]
        order_list_sorted = sorted(order_list, key=lambda x: x[1])  # oldest→newest
        last_order_date = order_list_sorted[-1][1]

        if len(order_list_sorted) < 2:
            avg_interval = float(default_interval)
            span_days = avg_interval
        else:
            span_days = (order_list_sorted[-1][1] - order_list_sorted[0][1]).days
            avg_interval = max(1.0, span_days / (len(order_list_sorted) - 1))

        estimated_empty = last_order_date + timedelta(days=avg_interval)
        days_until_empty = (estimated_empty - today).days

        if days_until_empty <= critical_days:
            urgency = "critical"
        elif days_until_empty <= warning_days:
            urgency = "warning"
        else:
            continue

        total_liters = sum(order_volume_map.get(oid, 0) for oid, _ in order_list_sorted)
        avg_daily_liters = round(total_liters / max(1.0, span_days), 1) if total_liters > 0 else None

        # display_name: registered name → last order address → phone
        display_name = u.name or recent_addr_map.get(uid) or u.phone

        results.append({
            "user_id": uid,
            "name": u.name,
            "display_name": display_name,
            "phone": u.phone,
            "orders_used": len(order_list_sorted),
            "last_order_at": last_order_date.isoformat(),
            "avg_interval_days": round(avg_interval, 1),
            "estimated_empty_at": estimated_empty.isoformat(),
            "days_until_empty": days_until_empty,
            "urgency": urgency,
            "avg_daily_liters": avg_daily_liters,
        })

    # Sort ascending: fewest days first (most urgent at top)
    results.sort(key=lambda r: r["days_until_empty"])
    return results
