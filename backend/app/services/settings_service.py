"""DB-backed key-value settings with typed defaults."""
import json
from typing import Any

from sqlalchemy import select
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
    "delivery_price": 0,
    "min_order": 25000,
    "working_hours": "08:00–22:00",
}


async def get_all_settings(db: AsyncSession) -> dict[str, Any]:
    result = await db.execute(select(AppSetting))
    rows = {r.key: json.loads(r.value) for r in result.scalars().all()}
    return {**DEFAULTS, **rows}


async def update_settings(db: AsyncSession, data: dict[str, Any]) -> dict[str, Any]:
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
