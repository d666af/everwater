from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
import services.api_client as api
from keyboards.courier import courier_menu_kb, courier_order_kb
from config import settings

router = Router()

STATUS_RU = {
    "assigned_to_courier": "🚚 Назначен курьеру",
    "in_delivery": "🚴 В доставке",
    "delivered": "✔️ Доставлен",
}


async def _notify_client(bot, order: dict, text: str):
    tg_id = order.get("client_telegram_id")
    if tg_id:
        try:
            await bot.send_message(tg_id, text)
        except Exception:
            pass


@router.message(Command("courier"))
async def courier_panel(message: Message):
    await message.answer("🚴 Панель курьера:", reply_markup=courier_menu_kb())


@router.message(F.text == "📋 Мои заказы")
async def courier_orders(message: Message):
    orders = await api.get_courier_orders(message.from_user.id)
    active = [o for o in orders if o.get("status") not in ("delivered", "rejected")]

    if not active:
        await message.answer("У вас нет активных заказов.")
        return

    for o in active:
        items_text = "\n".join(f"  • {i['product_name']} x{i['quantity']}" for i in o.get("items", []))
        total_str = f"{int(o['total']):,}".replace(",", " ")
        text = (
            f"📦 Заказ #{o['id']}\n"
            f"Статус: {STATUS_RU.get(o['status'], o['status'])}\n"
            f"Адрес: {o['address']}\n"
            f"Телефон: {o['recipient_phone']}\n"
            f"Время: {o.get('delivery_time', '—')}\n"
            f"Товары:\n{items_text}\n"
            f"Сумма: {total_str} сум"
        )
        await message.answer(text, reply_markup=courier_order_kb(o["id"]))


@router.message(F.text == "📊 Мои отчеты")
async def courier_report(message: Message):
    couriers = await api.get_couriers()
    courier = next((c for c in couriers if c["telegram_id"] == message.from_user.id), None)
    if not courier:
        await message.answer("Вы не зарегистрированы как курьер.")
        return

    stats = await api.get_courier_stats(message.from_user.id)
    avg = stats.get("avg_rating", 0)
    stars = "⭐" * round(avg) if avg else "—"
    await message.answer(
        f"📊 Ваша статистика:\n\n"
        f"✔️ Выполнено доставок: {stats.get('total_deliveries', courier['total_deliveries'])}\n"
        f"💰 Общая выручка: {int(stats.get('total_revenue', 0)):,} сум\n"
        f"⭐ Средний рейтинг: {avg:.1f} {stars}\n"
        f"📝 Отзывов: {stats.get('review_count', 0)}\n"
        f"🚴 Активных заказов: {stats.get('active_orders', 0)}\n"
    )


@router.callback_query(F.data.startswith("courier:accept:"))
async def courier_accept(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    await api.courier_accept_order(order_id)
    order = await api.get_order(order_id)

    # Notify client
    await _notify_client(
        call.bot, order,
        f"🚴 Ваш заказ #{order_id} принят курьером и скоро будет доставлен!"
    )

    await call.message.edit_text(
        f"✅ Вы приняли заказ #{order_id}. Хорошей доставки!",
        reply_markup=courier_order_kb(order_id),
    )
    await call.answer()


@router.callback_query(F.data.startswith("courier:in_delivery:"))
async def courier_in_delivery(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    await api.start_delivery(order_id)
    order = await api.get_order(order_id)

    # Notify admins
    bot = call.bot
    for admin_id in settings.ADMIN_IDS:
        try:
            await bot.send_message(admin_id, f"🚴 Курьер начал доставку заказа #{order_id}")
        except Exception:
            pass

    # Notify client
    await _notify_client(
        bot, order,
        f"🚴 Ваш заказ #{order_id} в пути!\n"
        f"Курьер уже едет к вам. Ожидайте."
    )

    await call.message.edit_text(
        f"🚴 Статус заказа #{order_id} обновлён: В доставке",
        reply_markup=courier_order_kb(order_id),
    )
    await call.answer()


@router.callback_query(F.data.startswith("courier:done:"))
async def courier_done(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    await api.mark_delivered(order_id)
    order = await api.get_order(order_id)

    from config import settings
    from keyboards.user import review_kb
    bot = call.bot

    # Notify admins
    for admin_id in settings.ADMIN_IDS:
        try:
            await bot.send_message(admin_id, f"✔️ Заказ #{order_id} доставлен!")
        except Exception:
            pass

    # Notify client with review prompt
    tg_id = order.get("client_telegram_id")
    if tg_id:
        try:
            await bot.send_message(
                tg_id,
                f"✔️ Ваш заказ #{order_id} доставлен!\n"
                "Пожалуйста, оцените качество доставки:",
                reply_markup=review_kb(order_id),
            )
        except Exception:
            pass

    await call.message.edit_text(f"✔️ Заказ #{order_id} помечен как доставленный!")
    await call.answer()
