"""Periodic background tasks: subscription reminders, bonus expiry, water forecast."""
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
_last_forecast_notify_date: str | None = None


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
    from app.services.settings_service import is_subscriptions_enabled

    now = datetime.utcnow()
    tomorrow_start = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_end = tomorrow_start + timedelta(days=1)

    async with AsyncSessionLocal() as db:
        if not await is_subscriptions_enabled(db):
            return
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


async def _run_water_forecast_notify() -> None:
    """Send daily Telegram notification about clients whose water is running low."""
    global _last_forecast_notify_date
    from app.services.settings_service import get_all_settings
    from app.services.water_forecast import calculate_water_forecast
    from app.services.tg_notify import get_all_admin_ids
    from app.models.manager import Manager

    now_utc = datetime.utcnow()
    now_local = now_utc + timedelta(hours=5)  # UTC+5 Tashkent
    today_str = now_local.strftime("%Y-%m-%d")

    if _last_forecast_notify_date == today_str:
        return

    async with AsyncSessionLocal() as db:
        cfg_data = await get_all_settings(db)
        if not cfg_data.get("forecast_enabled", True):
            return
        if not cfg_data.get("forecast_notify_enabled", True):
            _last_forecast_notify_date = today_str
            return

        notify_time = str(cfg_data.get("forecast_notify_time", "08:00"))
        try:
            notify_hour = int(notify_time.split(":")[0])
        except Exception:
            notify_hour = 8
        if now_local.hour < notify_hour:
            return

        results = await calculate_water_forecast(db, cfg_data)
        _last_forecast_notify_date = today_str

        if not results:
            return

        admin_ids = await get_all_admin_ids(db)
        managers_q = await db.execute(
            select(Manager).where(Manager.is_active == True, Manager.telegram_id.isnot(None))
        )
        managers = managers_q.scalars().all()

        critical = [r for r in results if r["urgency"] == "critical"]
        warning = [r for r in results if r["urgency"] == "warning"]

        lines = ["💧 Прогноз воды\n"]
        if critical:
            lines.append(f"🔴 Критично ({len(critical)} клиентов):")
            for r in critical[:10]:
                name = r["name"] or r["phone"] or "?"
                days = r["days_until_empty"]
                lines.append(f"  • {name}: ~{days} дн.")
            if len(critical) > 10:
                lines.append(f"  ...и ещё {len(critical) - 10}")
        if warning:
            lines.append(f"\n🟡 Скоро закончится ({len(warning)} клиентов):")
            for r in warning[:10]:
                name = r["name"] or r["phone"] or "?"
                days = r["days_until_empty"]
                lines.append(f"  • {name}: ~{days} дн.")
            if len(warning) > 10:
                lines.append(f"  ...и ещё {len(warning) - 10}")

        text = "\n".join(lines)
        seen: set[int] = set()
        for aid in admin_ids:
            if aid not in seen:
                seen.add(aid)
                await _send_tg(aid, text)
        for m in managers:
            if m.telegram_id:
                tid = int(m.telegram_id)
                if tid not in seen:
                    seen.add(tid)
                    await _send_tg(tid, text)

        logger.info("Sent water forecast to %d recipients", len(seen))


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
        try:
            await _run_water_forecast_notify()
        except Exception as e:
            logger.error("Water forecast notify error: %s", e)
        await asyncio.sleep(_REMINDER_INTERVAL)
