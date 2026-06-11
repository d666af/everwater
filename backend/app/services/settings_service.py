"""DB-backed key-value settings with typed defaults."""
import json
from typing import Any

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings as app_cfg
from app.models.settings import AppSetting


DEFAULTS: dict[str, Any] = {
    "payment_card": app_cfg.PAYMENT_CARD,
    "payment_holder": app_cfg.PAYMENT_HOLDER,
    "bottle_discount_type": app_cfg.BOTTLE_DISCOUNT_TYPE,
    "bottle_discount_value": app_cfg.BOTTLE_DISCOUNT_VALUE,
    "cashback_percent": 5,
    "bottle_return_buttons_visible": True,
    "bottle_return_mode": "max",
    "accepted_bottle_companies": [],
    "require_bottle_brand_selection": False,
    "delivery_enabled": True,
    "delivery_price": 0,
    "min_order": 25000,
    "working_hours": "08:00–22:00",
    # Bonus system
    "bonus_program_enabled": True,     # кэшбек с заказа включён
    "bottle_bonus_enabled": True,      # бонус/скидка за возврат бутылки включён
    "bonus_per_bottle": 100,           # сум за каждую доставленную 19л бутылку
    "bonus_expiry_days": 60,           # срок жизни бонусов в днях (0 = бессрочно)
    "bonus_limit_percent": 30,         # максимум бонусов = X% от суммы заказа
    # Cancellation
    "cancellation_penalty_pct": 10,    # % от суммы заказа списывается из бонусов при поздней отмене
    # Late order warning
    "late_order_hour": 18,             # после этого часа — предупреждение о переносе доставки
    "late_order_warning_enabled": True, # показывать предупреждение о позднем заказе
    # ETA / delivery reminders
    "delivery_eta_hours": 2,           # окно доставки в часах после назначения курьера
    "delivery_reminder_enabled": True,  # включить уведомления курьеру при просрочке ETA
    "delivery_reminder_2_delay": 10,   # минут после первого напоминания для второго
    # Subscriptions module (master switch — hides UI and disables API/scheduler when off)
    "subscriptions_enabled": True,
    # Support chat module — when off, all roles see a static "contacts" text
    # configured by the admin instead of the chat UI.
    "support_chat_enabled": True,
    "support_contacts_text": "📞 Телефон поддержки: +998 90 000-00-00\n📨 Telegram: @everwater_support\n🕐 Часы работы: 09:00–22:00",
    # Customer classification
    "permanent_customer_min_orders": 5,   # delivered orders threshold for "постоянный"
    "permanent_customer_period_days": 90, # within last N days (0 = all-time)
    "inactive_customer_days": 60,         # days since last delivered order for "не активный"
    # Water depletion forecast
    "forecast_enabled": True,
    "forecast_warning_days": 5,           # <= N days until empty → warning
    "forecast_critical_days": 2,          # <= N days until empty → critical
    "forecast_orders_lookback": 5,        # use last N delivered orders to calc avg interval
    "forecast_default_interval_days": 14, # fallback if client has <2 orders
    "forecast_notify_time": "08:00",      # HH:MM local time (UTC+5) for daily bot notify
    "forecast_notify_enabled": True,      # send daily Telegram notification
}


async def is_support_chat_enabled(db: AsyncSession) -> bool:
    cfg = await get_all_settings(db)
    return bool(cfg.get("support_chat_enabled", True))


async def is_subscriptions_enabled(db: AsyncSession) -> bool:
    cfg = await get_all_settings(db)
    return bool(cfg.get("subscriptions_enabled", True))


async def get_all_settings(db: AsyncSession) -> dict[str, Any]:
    result = await db.execute(select(AppSetting))
    rows = {r.key: json.loads(r.value) for r in result.scalars().all()}
    return {**DEFAULTS, **rows}


async def update_settings(db: AsyncSession, data: dict[str, Any]) -> dict[str, Any]:
    # When the module is being switched off, wipe every existing subscription
    # so paused/active/pending rows don't linger past the toggle.
    if data.get("subscriptions_enabled") is False:
        from app.models.client_data import Subscription
        await db.execute(delete(Subscription))

    for key, value in data.items():
        if key not in DEFAULTS:
            continue
        payload = json.dumps(value)
        result = await db.execute(select(AppSetting).where(AppSetting.key == key))
        row = result.scalar_one_or_none()
        if row:
            row.value = payload
        else:
            db.add(AppSetting(key=key, value=payload))
    await db.commit()
    return await get_all_settings(db)


async def seed_defaults(db: AsyncSession) -> None:
    """Insert any missing settings with DEFAULTS values (one-time on fresh DB)."""
    result = await db.execute(select(AppSetting.key))
    existing = {row[0] for row in result.all()}
    for key, value in DEFAULTS.items():
        if key in existing:
            continue
        db.add(AppSetting(key=key, value=json.dumps(value)))
    await db.commit()
