"""
Планировщик задач: напоминания, уведомления, доставка ответов поддержки.
"""
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import services.api_client as api
from config import settings

scheduler = AsyncIOScheduler(timezone="UTC")

# Track already-notified IDs between runs to avoid spam.
# None = first run (pre-populate without notifying to avoid re-notifying on restart).
_notified_new_orders: set[int] | None = None


async def send_registration_reminders(bot):
    """Напоминает незарегистрированным пользователям."""
    users = await api.get_users_to_remind()
    now = datetime.utcnow()
    delays = [timedelta(minutes=5), timedelta(minutes=30), timedelta(hours=24)]
    for user in users:
        tg_id = user["telegram_id"]
        count = user.get("reminder_count", 0)
        if count >= len(delays):
            continue
        last_at = user.get("last_reminder_at")
        last_dt = datetime.fromisoformat(last_at.replace("Z", "")) if last_at else datetime.min
        if now - last_dt < delays[count]:
            continue
        try:
            await bot.send_message(
                tg_id,
                "👋 Вы ещё не завершили регистрацию!\n\nВведите /start чтобы начать."
            )
            await api.update_user(tg_id, reminder_count=count + 1)
        except Exception:
            pass


async def check_delivery_reminders(bot):
    """Предупреждает админов если доставка затягивается."""
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
    """Доставляет ответы поддержки пользователям."""
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


async def notify_new_orders(bot):
    """Уведомляет админов и менеджеров о новых заказах (из сайта/API)."""
    global _notified_new_orders
    orders = await api.get_all_orders(status="new")

    # First run after (re)start: mark all existing orders as seen to avoid re-notifying.
    if _notified_new_orders is None:
        _notified_new_orders = {o["id"] for o in orders}
        return

    managers = await api.get_managers()
    active_mgr_ids = [m["telegram_id"] for m in managers if m.get("is_active") and m.get("telegram_id")]

    from keyboards.admin import order_confirm_kb
    for order in orders:
        oid = order["id"]
        if oid in _notified_new_orders:
            continue
        # Skip orders already notified by the bot handler (notification_msg_ids is set)
        if order.get("notification_msg_ids"):
            _notified_new_orders.add(oid)
            continue
        _notified_new_orders.add(oid)
        text = (
            f"🆕 Новый заказ #{oid} (с сайта)!\n"
            f"Клиент: {order.get('client_name', '—')} | {order.get('recipient_phone', '—')}\n"
            f"Адрес: {order.get('address', '—')}\n"
            f"Сумма: {int(order.get('total', 0)):,} сум"
        )
        kb = order_confirm_kb(oid)
        for admin_id in settings.ADMIN_IDS:
            try:
                await bot.send_message(admin_id, text, reply_markup=kb)
            except Exception:
                pass
        for mgr_tg in active_mgr_ids:
            if mgr_tg not in settings.ADMIN_IDS:
                try:
                    await bot.send_message(mgr_tg, text, reply_markup=kb)
                except Exception:
                    pass


async def notify_low_stock(bot):
    """Alert admins, managers and warehouse staff about genuinely low stock.

    Only fires for products with 1-9 units (skips 0 = never produced)
    or products with a subscription shortfall this week.
    """
    stock = await api.get_warehouse_stock()
    # 0 means "never stocked", not "ran out" — skip those to avoid noise
    low_lines = []
    for s in stock:
        qty = s.get("quantity", 0)
        if 0 < qty < 10:
            name = s.get("short_name") or s.get("product_name", "—")
            low_lines.append(f"• {name} — {qty} шт.")

    # Also check subscription shortfall (products we need but don't have enough of)
    shortfall_lines = []
    try:
        overview = await api.get_warehouse_overview("week")
        for item in overview.get("shortfall_items", []):
            deficit = item.get("qty", 0)
            if deficit > 0:
                shortfall_lines.append(f"• {item.get('product_name', '—')} — не хватает {deficit} шт. для подписок")
    except Exception:
        pass

    if not low_lines and not shortfall_lines:
        return

    parts = ["⚠️ <b>Низкие остатки на складе:</b>\n"]
    if low_lines:
        parts += low_lines
    if shortfall_lines:
        parts.append("\n<b>Нехватка для подписок на неделю:</b>")
        parts += shortfall_lines
    text = "\n".join(parts)

    recipients: list[int] = list(settings.ADMIN_IDS) + list(settings.WAREHOUSE_IDS)
    try:
        for s in await api.get_warehouse_staff_db():
            if s.get("telegram_id"):
                recipients.append(s["telegram_id"])
    except Exception:
        pass
    try:
        for m in await api.get_managers():
            if m.get("is_active") and m.get("telegram_id"):
                recipients.append(m["telegram_id"])
    except Exception:
        pass

    for tg_id in set(recipients):
        try:
            await bot.send_message(tg_id, text, parse_mode="HTML")
        except Exception:
            pass


def setup_scheduler(bot):
    scheduler.add_job(send_registration_reminders, "interval", minutes=5, args=[bot])
    scheduler.add_job(check_delivery_reminders, "interval", minutes=5, args=[bot])
    scheduler.add_job(deliver_support_replies, "interval", seconds=30, args=[bot])
    scheduler.add_job(notify_new_orders, "interval", minutes=1, args=[bot])
    scheduler.add_job(notify_low_stock, "interval", hours=4, args=[bot])
    scheduler.start()
