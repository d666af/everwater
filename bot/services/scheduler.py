"""
Планировщик задач: напоминания незарегистрированным пользователям.
Запускается вместе с ботом.
"""
import asyncio
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import services.api_client as api

scheduler = AsyncIOScheduler(timezone="UTC")


async def send_registration_reminders(bot):
    """Отправляет напоминания незарегистрированным пользователям."""
    users = await api.get_users_to_remind()
    now = datetime.utcnow()

    for user in users:
        tg_id = user["telegram_id"]
        count = user.get("reminder_count", 0)
        last_at = user.get("last_reminder_at")

        if last_at:
            last_at = datetime.fromisoformat(last_at.replace("Z", ""))
        else:
            last_at = datetime.min

        # Расписание напоминаний
        delays = [timedelta(minutes=5), timedelta(minutes=30), timedelta(hours=24)]
        if count >= len(delays):
            continue

        if now - last_at < delays[count]:
            continue

        try:
            await bot.send_message(
                tg_id,
                "👋 Вы ещё не завершили регистрацию!\n\n"
                "Введите /start чтобы начать и получить доступ к заказам воды."
            )
            await api.update_user(tg_id, reminder_count=count + 1)
        except Exception:
            pass


async def check_delivery_reminders(bot):
    """Напоминания о доставке если статус не обновился за 10 минут."""
    from config import settings
    orders = await api.get_all_orders(status="in_delivery")
    now = datetime.utcnow()

    for order in orders:
        if order.get("delivery_reminder_sent"):
            continue
        expected = order.get("delivery_expected_at")
        if not expected:
            continue
        expected_dt = datetime.fromisoformat(expected.replace("Z", ""))
        if now - expected_dt > timedelta(minutes=10):
            for admin_id in settings.ADMIN_IDS:
                try:
                    await bot.send_message(
                        admin_id,
                        f"⚠️ Заказ #{order['id']} — доставка затягивается более 10 минут!"
                    )
                except Exception:
                    pass


async def deliver_support_replies(bot):
    """Доставляет ответы поддержки пользователям через Telegram."""
    messages = await api.get_undelivered_support_messages()
    for msg in messages:
        chat_id = msg.get("chat_id")
        if not chat_id:
            continue
        try:
            await bot.send_message(chat_id, f"💬 Поддержка:\n{msg['text']}")
            await api.mark_support_message_delivered(msg["id"])
        except Exception:
            pass


def setup_scheduler(bot):
    scheduler.add_job(
        send_registration_reminders, "interval", minutes=5, args=[bot]
    )
    scheduler.add_job(
        check_delivery_reminders, "interval", minutes=5, args=[bot]
    )
    scheduler.add_job(
        deliver_support_replies, "interval", seconds=30, args=[bot]
    )
    scheduler.start()
