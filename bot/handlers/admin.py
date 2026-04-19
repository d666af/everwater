from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.admin import admin_menu_kb, order_confirm_kb, courier_select_kb, stats_period_kb
from config import settings

router = Router()

STATUS_RU = {
    "new": "🆕 Новый",
    "awaiting_confirmation": "⏳ Ожидает подтверждения",
    "confirmed": "✅ Подтверждён",
    "assigned_to_courier": "🚚 Передан курьеру",
    "in_delivery": "🚴 В доставке",
    "delivered": "✔️ Доставлен",
    "rejected": "❌ Отклонён",
}


def is_admin(user_id: int) -> bool:
    return user_id in settings.ADMIN_IDS


class AdminReject(StatesGroup):
    waiting_reason = State()
    order_id = None


async def _notify_client(bot, order: dict, text: str):
    """Send a Telegram notification to the client who placed the order."""
    tg_id = order.get("client_telegram_id")
    if tg_id:
        try:
            await bot.send_message(tg_id, text)
        except Exception:
            pass


@router.message(Command("admin"))
async def admin_panel(message: Message):
    if not is_admin(message.from_user.id):
        return
    await message.answer("🔧 Админ-панель:", reply_markup=admin_menu_kb())


@router.callback_query(F.data == "admin:orders:all")
async def admin_all_orders(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    orders = await api.get_all_orders()
    if not orders:
        await call.message.edit_text("Заказов нет.")
        return
    text = "📋 Все заказы:\n\n"
    for o in orders[:20]:
        text += f"#{o['id']} — {STATUS_RU.get(o['status'], o['status'])} — {int(o['total']):,} сум — {o['address'][:30]}\n"
    await call.message.edit_text(text, reply_markup=admin_menu_kb())
    await call.answer()


@router.callback_query(F.data == "admin:orders:awaiting_confirmation")
async def admin_pending_orders(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    orders = await api.get_all_orders(status="awaiting_confirmation")
    if not orders:
        await call.message.edit_text("Нет заказов, ожидающих подтверждения.", reply_markup=admin_menu_kb())
        await call.answer()
        return
    for o in orders[:5]:
        items_text = "\n".join(f"  • {i['product_name']} x{i['quantity']}" for i in o.get("items", []))
        text = (
            f"📦 Заказ #{o['id']}\n"
            f"Клиент: {o.get('client_name', '—')}\n"
            f"Адрес: {o['address']}\n"
            f"Телефон: {o['recipient_phone']}\n"
            f"Время: {o.get('delivery_time', '—')}\n"
            f"Товары:\n{items_text}\n"
            f"Сумма: {int(o['total']):,} сум\n"
            f"Возврат бутылок: {o['return_bottles_count']} шт."
        )
        await call.message.answer(text, reply_markup=order_confirm_kb(o["id"]))
    await call.answer()


@router.callback_query(F.data.startswith("admin:confirm:"))
async def admin_confirm(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await api.confirm_order(order_id)
    order = await api.get_order(order_id)

    # Notify client
    await _notify_client(
        call.bot, order,
        f"✅ Ваш заказ #{order_id} подтверждён!\n"
        f"Время доставки: {order.get('delivery_time', 'уточняется')}.\n"
        "Скоро назначим курьера."
    )

    couriers = await api.get_couriers()
    await call.message.edit_text(
        f"✅ Заказ #{order_id} подтверждён!\n\nВыберите курьера:",
        reply_markup=courier_select_kb(couriers, order_id),
    )
    await call.answer()


@router.callback_query(F.data.startswith("admin:reject:"))
async def admin_reject(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await state.update_data(reject_order_id=order_id)
    await state.set_state(AdminReject.waiting_reason)
    await call.message.answer(f"Укажите причину отклонения заказа #{order_id}:")
    await call.answer()


@router.message(AdminReject.waiting_reason)
async def admin_reject_reason(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    data = await state.get_data()
    order_id = data["reject_order_id"]
    reason = message.text
    await api.reject_order(order_id, reason)
    order = await api.get_order(order_id)
    await state.clear()

    # Notify client
    await _notify_client(
        message.bot, order,
        f"❌ Ваш заказ #{order_id} отклонён.\n"
        f"Причина: {reason}\n"
        "Если у вас есть вопросы, обратитесь в поддержку."
    )

    await message.answer(f"❌ Заказ #{order_id} отклонён. Причина: {reason}")


@router.callback_query(F.data.startswith("admin:set_courier:"))
async def admin_set_courier(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    _, _, _, order_id, courier_id = call.data.split(":")
    order_id, courier_id = int(order_id), int(courier_id)
    await api.assign_courier(order_id, courier_id)

    order = await api.get_order(order_id)
    couriers = await api.get_couriers()
    courier = next((c for c in couriers if c["id"] == courier_id), None)

    if courier:
        bot = call.bot
        items_text = "\n".join(f"  • {i['product_name']} x{i['quantity']}" for i in order.get("items", []))
        total_str = f"{int(order['total']):,}".replace(",", " ")
        try:
            await bot.send_message(
                courier["telegram_id"],
                f"🚴 Вам назначен заказ #{order_id}!\n\n"
                f"Адрес: {order['address']}\n"
                f"Телефон клиента: {order['recipient_phone']}\n"
                f"Время: {order.get('delivery_time', '—')}\n"
                f"Товары:\n{items_text}\n"
                f"Сумма: {total_str} сум\n"
                f"Возврат бутылок: {order['return_bottles_count']} шт.\n"
                f"Геолокация: {order.get('latitude', '—')}, {order.get('longitude', '—')}",
                reply_markup=__import__('keyboards.courier', fromlist=['courier_order_kb']).courier_order_kb(order_id),
            )
        except Exception:
            pass

        # Notify client that courier is assigned
        await _notify_client(
            bot, order,
            f"🚴 Курьер назначен на ваш заказ #{order_id}!\n"
            f"Курьер: {courier['name']}\n"
            f"Ожидайте доставку в указанное время."
        )

    await call.message.edit_text(f"✅ Курьер назначен на заказ #{order_id}.")
    await call.answer()


@router.callback_query(F.data.startswith("admin_topup_confirm:"))
async def admin_topup_confirm(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    parts = call.data.split(":")
    user_id = int(parts[1])
    amount = int(parts[2])
    tg_id = int(parts[3]) if len(parts) > 3 else None
    try:
        result = await api.topup_user(user_id, amount)
        amount_str = f"{amount:,}".replace(",", " ")
        new_balance = result.get("new_balance", 0)
        await call.message.edit_text(
            f"✅ Баланс пользователя (ID {user_id}) пополнен на {amount_str} сум.\n"
            f"Новый баланс: {int(new_balance):,} сум"
        )
        # Notify the user
        if tg_id:
            try:
                await call.bot.send_message(
                    tg_id,
                    f"✅ Ваш баланс пополнен на {amount_str} сум!\n"
                    f"Текущий баланс: {int(new_balance):,} сум"
                )
            except Exception:
                pass
    except Exception:
        await call.message.edit_text("❌ Ошибка при пополнении баланса.")
    await call.answer()


@router.callback_query(F.data == "admin:stats")
async def admin_stats_menu(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    await call.message.edit_text("Выберите период:", reply_markup=stats_period_kb())
    await call.answer()


@router.callback_query(F.data.startswith("admin:stats:"))
async def admin_stats(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    period = call.data.split(":")[2]
    stats = await api.get_stats(period)
    period_label = {"day": "день", "week": "неделю", "month": "месяц"}.get(period, period)
    text = (
        f"📊 Статистика за {period_label}:\n\n"
        f"📦 Заказов: {stats.get('order_count', 0)}\n"
        f"💰 Выручка: {int(stats.get('revenue', 0)):,} сум\n"
        f"🧾 Средний чек: {int(stats.get('avg_check', 0)):,} сум\n"
        f"🫙 Возвращено бутылок: {stats.get('bottles_returned', 0)}\n"
        f"❌ Отменено: {stats.get('cancelled', 0)}\n"
        f"🔄 Повторных клиентов: {stats.get('repeat_customers', 0)}\n"
    )
    await call.message.edit_text(text, reply_markup=admin_menu_kb())
    await call.answer()


@router.callback_query(F.data == "admin:couriers")
async def admin_couriers(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    couriers = await api.get_couriers()
    if not couriers:
        await call.message.edit_text("Нет активных курьеров.", reply_markup=admin_menu_kb())
        await call.answer()
        return
    text = "🚴 Курьеры:\n\n"
    for c in couriers:
        text += f"• {c['name']} (tg_id: {c['telegram_id']}) — {c['total_deliveries']} доставок\n"
    await call.message.edit_text(text, reply_markup=admin_menu_kb())
    await call.answer()
