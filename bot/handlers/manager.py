from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.manager import (
    manager_menu_kb, mgr_order_kb, mgr_courier_select_kb,
    mgr_stats_period_kb, mgr_client_kb, mgr_debt_kb,
)
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

PAY_RU = {"cash": "💵 Наличные", "card": "💳 Карта", "balance": "💰 Баланс"}


def fmt(amount):
    return f"{int(amount):,}".replace(",", " ") + " сум"


async def is_manager(telegram_id: int) -> bool:
    mgr = await api.get_manager_by_telegram(telegram_id)
    return mgr is not None


class MgrReject(StatesGroup):
    waiting_reason = State()


class MgrTopup(StatesGroup):
    waiting_user_id = State()
    waiting_amount = State()


class MgrClientSearch(StatesGroup):
    waiting_phone = State()


class MgrBroadcast(StatesGroup):
    waiting_text = State()


class MgrMsgClient(StatesGroup):
    waiting_text = State()


# ─── Entry ────────────────────────────────────────────────────────────────────

@router.message(Command("manager"))
async def manager_panel(message: Message):
    if not await is_manager(message.from_user.id):
        return
    await message.answer("🧑‍💼 Панель менеджера:", reply_markup=manager_menu_kb())


# ─── Orders ───────────────────────────────────────────────────────────────────

@router.message(F.text == "📋 Заказы")
async def mgr_all_orders(message: Message):
    if not await is_manager(message.from_user.id):
        return
    orders = await api.get_all_orders()
    if not orders:
        await message.answer("Заказов нет.")
        return
    lines = ["📋 <b>Последние заказы:</b>\n"]
    for o in orders[:20]:
        status = STATUS_RU.get(o["status"], o["status"])
        lines.append(f"#{o['id']} {status} — {fmt(o['total'])} — {o['address'][:25]}")
    await message.answer("\n".join(lines), parse_mode="HTML")


@router.message(F.text == "⏳ Новые заказы")
async def mgr_pending_orders(message: Message):
    if not await is_manager(message.from_user.id):
        return
    orders = await api.get_all_orders(status="awaiting_confirmation")
    if not orders:
        await message.answer("Нет заказов, ожидающих подтверждения.")
        return
    for o in orders[:5]:
        items_text = "\n".join(f"  • {i['product_name']} ×{i['quantity']}" for i in o.get("items", []))
        text = (
            f"📦 <b>Заказ #{o['id']}</b>\n"
            f"Клиент: {o.get('client_name', '—')}\n"
            f"Телефон: {o.get('recipient_phone', '—')}\n"
            f"Адрес: {o['address']}\n"
            f"Время: {o.get('delivery_time') or '—'}\n"
            f"Товары:\n{items_text}\n"
            f"Сумма: {fmt(o['total'])}\n"
            f"Оплата: {PAY_RU.get(o.get('payment_method', ''), '—')}\n"
            f"Возврат бутылок: {o.get('return_bottles_count', 0)} шт."
        )
        await message.answer(text, reply_markup=mgr_order_kb(o["id"]), parse_mode="HTML")


@router.callback_query(F.data.startswith("mgr:confirm:"))
async def mgr_confirm(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await api.confirm_order(order_id, from_bot=True)
    order = await api.get_order(order_id)
    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            await call.bot.send_message(
                client_tg,
                f"✅ Ваш заказ #{order_id} подтверждён!\n"
                f"Время доставки: {order.get('delivery_time') or 'уточняется'}.\nСкоро назначим курьера."
            )
        except Exception:
            pass
    couriers = await api.get_couriers()
    await call.message.edit_text(
        f"✅ Заказ #{order_id} подтверждён!\n\nВыберите курьера:",
        reply_markup=mgr_courier_select_kb(couriers, order_id),
    )
    await call.answer()


@router.callback_query(F.data.startswith("mgr:reject:"))
async def mgr_reject(call: CallbackQuery, state: FSMContext):
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await state.update_data(reject_order_id=order_id)
    await state.set_state(MgrReject.waiting_reason)
    await call.message.answer(f"Укажите причину отклонения заказа #{order_id}:")
    await call.answer()


@router.message(MgrReject.waiting_reason)
async def mgr_reject_reason(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    data = await state.get_data()
    order_id = data["reject_order_id"]
    reason = message.text.strip()
    await api.reject_order(order_id, reason, from_bot=True)
    order = await api.get_order(order_id)
    await state.clear()
    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            await message.bot.send_message(
                client_tg,
                f"❌ Ваш заказ #{order_id} отклонён.\nПричина: {reason}\n"
                "Если есть вопросы — обратитесь в поддержку."
            )
        except Exception:
            pass
    await message.answer(f"❌ Заказ #{order_id} отклонён.")


@router.callback_query(F.data.startswith("mgr:assign:"))
async def mgr_assign(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    couriers = await api.get_couriers()
    await call.message.edit_text(
        f"Выберите курьера для заказа #{order_id}:",
        reply_markup=mgr_courier_select_kb(couriers, order_id),
    )
    await call.answer()


@router.callback_query(F.data.startswith("mgr:set_courier:"))
async def mgr_set_courier(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    parts = call.data.split(":")
    order_id, courier_id = int(parts[2]), int(parts[3])
    await api.assign_courier(order_id, courier_id, from_bot=True)
    order = await api.get_order(order_id)
    couriers = await api.get_couriers()
    courier = next((c for c in couriers if c["id"] == courier_id), None)
    if courier:
        items_text = "\n".join(f"  • {i['product_name']} ×{i['quantity']}" for i in order.get("items", []))
        try:
            from keyboards.courier import courier_order_kb
            await call.bot.send_message(
                courier["telegram_id"],
                f"🚴 Вам назначен заказ #{order_id}!\n\n"
                f"Адрес: {order['address']}\nТелефон: {order['recipient_phone']}\n"
                f"Время: {order.get('delivery_time') or '—'}\n"
                f"Товары:\n{items_text}\nСумма: {fmt(order['total'])}\n"
                f"Возврат бутылок: {order.get('return_bottles_count', 0)} шт.",
                reply_markup=courier_order_kb(order_id),
            )
        except Exception:
            pass
        client_tg = order.get("client_telegram_id")
        if client_tg:
            try:
                await call.bot.send_message(
                    client_tg,
                    f"🚴 Курьер {courier['name']} назначен на ваш заказ #{order_id}!\nОжидайте доставку."
                )
            except Exception:
                pass
    await call.message.edit_text(f"✅ Курьер назначен на заказ #{order_id}.")
    await call.answer()


# ─── Clients ──────────────────────────────────────────────────────────────────

@router.message(F.text == "👥 Клиенты")
async def mgr_clients(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    await state.set_state(MgrClientSearch.waiting_phone)
    await message.answer("Введите номер телефона или имя клиента для поиска:")


@router.message(MgrClientSearch.waiting_phone)
async def mgr_client_search(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    query = message.text.strip()
    await state.clear()
    users = await api.get_all_users()
    found = [u for u in users if
             (query.lower() in (u.get("name") or "").lower() or
              query.replace("+", "").replace(" ", "") in (u.get("phone") or "").replace("+", "").replace(" ", ""))]
    if not found:
        await message.answer("Клиент не найден.")
        return
    for u in found[:5]:
        text = (
            f"👤 <b>{u.get('name', '—')}</b>\n"
            f"Телефон: {u.get('phone', '—')}\n"
            f"Баланс: {fmt(u.get('balance', 0))}\n"
            f"Бонусы: {fmt(u.get('bonus_points', 0))}"
        )
        await message.answer(text, reply_markup=mgr_client_kb(u["id"], u.get("telegram_id")),
                             parse_mode="HTML")


@router.callback_query(F.data.startswith("mgr:topup:"))
async def mgr_topup_start(call: CallbackQuery, state: FSMContext):
    if not await is_manager(call.from_user.id):
        return
    user_id = int(call.data.split(":")[2])
    await state.update_data(topup_user_id=user_id)
    await state.set_state(MgrTopup.waiting_amount)
    await call.message.answer(f"Введите сумму пополнения для клиента ID {user_id}:")
    await call.answer()


@router.message(MgrTopup.waiting_amount)
async def mgr_topup_amount(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    text = message.text.strip().replace(" ", "")
    if not text.isdigit() or int(text) <= 0:
        await message.answer("Введите корректную сумму.")
        return
    amount = int(text)
    data = await state.get_data()
    user_id = data["topup_user_id"]
    result = await api.topup_user(user_id, amount)
    await state.clear()
    new_balance = result.get("new_balance", 0)
    await message.answer(
        f"✅ Баланс пополнен на {fmt(amount)}.\nНовый баланс: {fmt(new_balance)}"
    )


@router.callback_query(F.data.startswith("mgr:msg_client:"))
async def mgr_msg_client_start(call: CallbackQuery, state: FSMContext):
    if not await is_manager(call.from_user.id):
        return
    tg_id = int(call.data.split(":")[2])
    await state.update_data(msg_client_tg=tg_id)
    await state.set_state(MgrMsgClient.waiting_text)
    await call.message.answer("Введите сообщение для клиента:")
    await call.answer()


@router.message(MgrMsgClient.waiting_text)
async def mgr_msg_client_send(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    data = await state.get_data()
    tg_id = data["msg_client_tg"]
    await state.clear()
    try:
        await message.bot.send_message(tg_id, f"📩 Сообщение от менеджера:\n\n{message.text}")
        await message.answer("✅ Сообщение отправлено.")
    except Exception:
        await message.answer("❌ Не удалось отправить сообщение.")


# ─── Stats ────────────────────────────────────────────────────────────────────

@router.message(F.text == "📊 Статистика")
async def mgr_stats_menu(message: Message):
    if not await is_manager(message.from_user.id):
        return
    await message.answer("Выберите период:", reply_markup=mgr_stats_period_kb())


@router.callback_query(F.data.startswith("mgr:stats:"))
async def mgr_stats(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    period = call.data.split(":")[2]
    stats = await api.get_stats(period)
    label = {"day": "день", "week": "неделю", "month": "месяц"}.get(period, period)
    text = (
        f"📊 <b>Статистика за {label}:</b>\n\n"
        f"📦 Заказов: {stats.get('order_count', 0)}\n"
        f"💰 Выручка: {fmt(stats.get('revenue', 0))}\n"
        f"🧾 Средний чек: {fmt(stats.get('avg_check', 0))}\n"
        f"🫙 Возвращено бутылок: {stats.get('bottles_returned', 0)}\n"
        f"❌ Отменено: {stats.get('cancelled', 0)}\n"
        f"🔄 Повторных клиентов: {stats.get('repeat_customers', 0)}"
    )
    await call.message.edit_text(text, parse_mode="HTML")
    await call.answer()


# ─── Cash debts ───────────────────────────────────────────────────────────────

@router.message(F.text == "💸 Долги курьеров")
async def mgr_cash_debts(message: Message):
    if not await is_manager(message.from_user.id):
        return
    debts = await api.get_cash_debts_admin(status="requested")
    if not debts:
        await message.answer("Нет запросов на погашение долгов.")
        return
    couriers = await api.get_couriers()
    courier_map = {c["id"]: c["name"] for c in couriers}
    for d in debts[:10]:
        name = courier_map.get(d.get("courier_id"), f"ID {d.get('courier_id')}")
        text = (
            f"💸 Запрос от <b>{name}</b>\n"
            f"Сумма: {fmt(d['amount'])}\n"
            f"Заказ: #{d.get('order_id') or '—'}\n"
            f"Заметка: {d.get('note') or '—'}"
        )
        await message.answer(text, reply_markup=mgr_debt_kb(d["id"]), parse_mode="HTML")


@router.callback_query(F.data.startswith("mgr:debt:"))
async def mgr_debt_decide(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    parts = call.data.split(":")
    action = parts[2]
    debt_id = int(parts[3])
    await api.decide_cash_debt(debt_id, action)
    result_text = "✅ Одобрено" if action == "approve" else "❌ Отклонено"
    await call.message.edit_text(f"{result_text}: долг #{debt_id}")
    await call.answer()


# ─── Support ──────────────────────────────────────────────────────────────────

@router.message(F.text == "🆘 Поддержка")
async def mgr_support(message: Message):
    if not await is_manager(message.from_user.id):
        return
    from config import settings
    from keyboards.user import miniapp_inline_kb
    await message.answer(
        "🆘 <b>Поддержка</b>\n\nОткройте веб-панель для работы с обращениями клиентов:",
        reply_markup=miniapp_inline_kb(),
        parse_mode="HTML",
    )
