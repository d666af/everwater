"""
Планировщик задач: напоминания, уведомления, доставка ответов поддержки.
"""
from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import services.api_client as api
from config import settings

scheduler = AsyncIOScheduler(timezone="UTC")

# Track already-notified IDs between runs to avoid spam
_notified_new_orders: set[int] = set()
_notified_cash_debts: set[int] = set()


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
    managers = await api.get_managers()
    active_mgr_ids = [m["telegram_id"] for m in managers if m.get("is_active") and m.get("telegram_id")]

    from keyboards.admin import order_confirm_kb
    for order in orders:
        oid = order["id"]
        if oid in _notified_new_orders:
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


async def notify_cash_debt_requests(bot):
    """Уведомляет админов о новых запросах на погашение долгов."""
    global _notified_cash_debts
    debts = await api.get_cash_debts_admin(status="requested")
    couriers = await api.get_couriers()
    courier_map = {c["id"]: c for c in couriers}

    for d in debts:
        did = d["id"]
        if did in _notified_cash_debts:
            continue
        _notified_cash_debts.add(did)
        c = courier_map.get(d.get("courier_id"), {})
        text = (
            f"💸 Курьер {c.get('name', '—')} запрашивает погашение долга #{did}\n"
            f"Сумма: {int(d['amount']):,} сум\n"
            f"Заказ: #{d.get('order_id') or '—'}"
        )
        for admin_id in settings.ADMIN_IDS:
            try:
                await bot.send_message(admin_id, text)
            except Exception:
                pass


async def notify_low_stock(bot):
    """Уведомляет склад и админов о низких остатках (< 10 шт.)."""
    stock = await api.get_warehouse_stock()
    low = [s for s in stock if s.get("quantity", 0) < 10]
    if not low:
        return
    lines = ["⚠️ <b>Низкие остатки на складе:</b>\n"]
    for s in low:
        lines.append(f"• {s['product_name']} — {s.get('quantity', 0)} шт.")
    text = "\n".join(lines)
    recipients = list(settings.ADMIN_IDS) + list(settings.WAREHOUSE_IDS)
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
    scheduler.add_job(notify_cash_debt_requests, "interval", minutes=2, args=[bot])
    scheduler.add_job(notify_low_stock, "interval", hours=4, args=[bot])
    scheduler.start()
