"""Water depletion forecast: predict when each client will run out of water."""
from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.order import Order, OrderStatus
from app.models.user import User


async def calculate_water_forecast(db: AsyncSession, cfg: dict) -> list[dict]:
    """Return users whose water is predicted to run out soon (urgency != 'ok')."""
    if not cfg.get("forecast_enabled", True):
        return []

    warning_days = int(cfg.get("forecast_warning_days", 5))
    critical_days = int(cfg.get("forecast_critical_days", 2))
    lookback = int(cfg.get("forecast_orders_lookback", 5))
    default_interval = int(cfg.get("forecast_default_interval_days", 14))

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

    user_orders: dict[int, list[datetime]] = {}
    for row in orders_q.all():
        uid = row.user_id
        if uid not in user_orders:
            user_orders[uid] = []
        if len(user_orders[uid]) < lookback:
            user_orders[uid].append(row.created_at)

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    results = []

    for uid, dates in user_orders.items():
        if uid not in users_map:
            continue
        u = users_map[uid]
        dates_sorted = sorted(dates)
        last_order_date = dates_sorted[-1]

        if len(dates_sorted) < 2:
            avg_interval = float(default_interval)
        else:
            span = (dates_sorted[-1] - dates_sorted[0]).days
            avg_interval = max(1.0, span / (len(dates_sorted) - 1))

        estimated_empty = last_order_date + timedelta(days=avg_interval)
        days_until_empty = (estimated_empty - today).days

        if days_until_empty <= critical_days:
            urgency = "critical"
        elif days_until_empty <= warning_days:
            urgency = "warning"
        else:
            continue

        results.append({
            "user_id": uid,
            "name": u.name,
            "phone": u.phone,
            "last_order_at": last_order_date.isoformat(),
            "avg_interval_days": round(avg_interval, 1),
            "estimated_empty_at": estimated_empty.isoformat(),
            "days_until_empty": days_until_empty,
            "urgency": urgency,
        })

    results.sort(key=lambda r: (0 if r["urgency"] == "critical" else 1, r["days_until_empty"]))
    return results
