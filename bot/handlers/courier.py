from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
import services.api_client as api
from keyboards.courier import courier_menu_kb, courier_order_kb

router = Router()


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
            f"Статус: {o['status']}\n"
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
    await message.answer(
        f"📊 Ваша статистика:\n\n"
        f"✔️ Выполнено доставок: {courier['total_deliveries']}\n"
    )


@router.callback_query(F.data.startswith("courier:accept:"))
async def courier_accept(call: CallbackQuery):
    order_id = int(call.data.split(":")[2])
    await api.courier_accept_order(order_id)
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
    from config import settings
    bot = call.bot
    for admin_id in settings.ADMIN_IDS:
        try:
            await bot.send_message(admin_id, f"🚴 Курьер начал доставку заказа #{order_id}")
        except Exception:
            pass

    await call.message.edit_text(f"🚴 Статус заказа #{order_id} обновлен: В доставке")
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

    await call.message.edit_text(f"✔️ Заказ #{order_id} помечен как доставленный!")
    await call.answer()
