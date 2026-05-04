"""Periodic background tasks: subscription reminders, bonus expiry."""
import asyncio
import logging
from datetime import datetime, timedelta

import aiohttp

from app.config import settings as cfg
from app.database import AsyncSessionLocal
from app.models.client_data import Subscription
from app.models.user import User

from sqlalchemy import select

logger = logging.getLogger(__name__)

_REMINDER_INTERVAL = 3600  # check every hour


async def _send_tg(chat_id: int, text: str) -> None:
    url = f"https://api.telegram.org/bot{cfg.BOT_TOKEN}/sendMessage"
    try:
        async with aiohttp.ClientSession() as session:
            await session.post(url, json={"chat_id": chat_id, "text": text},
                               timeout=aiohttp.ClientTimeout(total=5))
    except Exception:
        pass


async def _run_subscription_reminders() -> None:
    """Send 24h reminders for subscriptions due tomorrow."""
    now = datetime.utcnow()
    tomorrow_start = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_end = tomorrow_start + timedelta(days=1)

    async with AsyncSessionLocal() as db:
        q = await db.execute(
            select(Subscription, User)
            .join(User, User.id == Subscription.user_id)
            .where(
                Subscription.status == "active",
                Subscription.next_delivery_date >= tomorrow_start,
                Subscription.next_delivery_date < tomorrow_end,
                Subscription.reminder_sent_at == None,
            )
        )
        rows = q.all()

        for sub, user in rows:
            if not user.telegram_id:
                continue
            ndd = sub.next_delivery_date
            date_str = ndd.strftime("%d.%m.%Y") if ndd else "завтра"
            text = (
                f"⏰ Напоминание о подписке\n"
                f"Завтра ({date_str}) запланирована доставка: {sub.water_summary}\n"
                f"Адрес: {sub.address}"
            )
            await _send_tg(user.telegram_id, text)
            sub.reminder_sent_at = now
            logger.info("Sent subscription reminder for sub_id=%s to user=%s", sub.id, user.id)

        if rows:
            await db.commit()


async def _run_bonus_expiry() -> None:
    """Zero out expired bonuses."""
    now = datetime.utcnow()
    async with AsyncSessionLocal() as db:
        q = await db.execute(
            select(User).where(
                User.bonus_expires_at != None,
                User.bonus_expires_at <= now,
                User.bonus_points > 0,
            )
        )
        users = q.scalars().all()
        for user in users:
            user.bonus_points = 0.0
            user.bonus_expires_at = None
            logger.info("Expired bonuses for user_id=%s", user.id)
        if users:
            await db.commit()


async def background_loop() -> None:
    """Main loop that runs periodic tasks."""
    while True:
        try:
            await _run_subscription_reminders()
        except Exception as e:
            logger.error("Subscription reminder error: %s", e)
        try:
            await _run_bonus_expiry()
        except Exception as e:
            logger.error("Bonus expiry error: %s", e)
        await asyncio.sleep(_REMINDER_INTERVAL)
