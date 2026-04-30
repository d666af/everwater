from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.manager import (
    manager_menu_kb, mgr_order_kb, mgr_courier_select_kb,
    mgr_stats_period_kb, mgr_client_kb, mgr_debt_kb,
    mgr_order_reject_kb, mgr_topup_presets_kb, mgr_support_chat_kb, mgr_support_quick_kb,
)
from keyboards.admin import subs_menu_kb, subs_list_kb
from handlers.admin import _format_subs, _subs_summary_text, _sub_card_text
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

class MgrSupportReply(StatesGroup):
    waiting_text = State()

class MgrRejectCustom(StatesGroup):
    waiting_reason = State()


# ─── Entry ────────────────────────────────────────────────────────────────────

@router.message(Command("manager"))
async def manager_panel(message: Message):
    if not await is_manager(message.from_user.id):
        return
    await message.answer("🧑‍💼 Панель менеджера:", reply_markup=manager_menu_kb())


# ─── Orders ───────────────────────────────────────────────────────────────────

def _mgr_order_text(o: dict) -> str:
    st = STATUS_RU.get(o["status"], o["status"])
    items_text = "\n".join(f"  • {i['product_name']} ×{i['quantity']}" for i in o.get("items", []))
    pay = PAY_RU.get(o.get("payment_method", ""), "—")
    lines = [
        f"📦 <b>{st}</b>",
        f"Клиент: {o.get('client_name','—')}  |  {o.get('recipient_phone','—')}",
        f"Адрес: {o.get('address','—')}",
    ]
    if o.get("extra_info"):
        lines.append(f"Доп.: {o['extra_info']}")
    lines += [f"\nТовары:\n{items_text}", f"\nСумма: {fmt(o['total'])}  |  {pay}"]
    if o.get("courier_name"):
        lines.append(f"Курьер: {o['courier_name']}")
    return "\n".join(lines)


def _mgr_order_kb(o: dict):
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    oid = o["id"]
    status = o.get("status", "")
    rows = []
    client_phone = o.get("recipient_phone", "")
    courier_phone = o.get("courier_phone", "")
    client_tg = o.get("client_telegram_id")
    if client_phone:
        rows.append([InlineKeyboardButton(text="📞 Клиенту", url=f"tel:{client_phone}")])
    if courier_phone:
        rows.append([InlineKeyboardButton(text="📞 Курьеру", url=f"tel:{courier_phone}")])
    if client_tg:
        rows.append([InlineKeyboardButton(text="✉️ Написать клиенту", url=f"tg://user?id={client_tg}")])
    if status == "confirmed":
        rows.append([InlineKeyboardButton(text="🚴 Отметить в пути", callback_data=f"mgr:in_delivery:{oid}")])
    if status in ("confirmed", "assigned_to_courier", "in_delivery"):
        rows.append([InlineKeyboardButton(text="✔️ Отметить доставлен", callback_data=f"mgr:delivered:{oid}")])
    if status not in ("delivered", "rejected"):
        rows.append([InlineKeyboardButton(text="❌ Отменить заказ", callback_data=f"mgr:cancel_order:{oid}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


@router.message(F.text == "📋 Заказы")
async def mgr_all_orders(message: Message):
    if not await is_manager(message.from_user.id):
        return
    orders = await api.get_all_orders()
    if not orders:
        await message.answer("Заказов нет.")
        return
    active = [o for o in orders if o.get("status") not in ("delivered", "rejected")][:10]
    if not active:
        await message.answer("Нет активных заказов.")
        return
    for o in active:
        await message.answer(_mgr_order_text(o), reply_markup=_mgr_order_kb(o), parse_mode="HTML")


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
    try:
        await api.confirm_order(order_id, from_bot=True)
    except Exception as e:
        if "409" in str(e):
            await call.answer("Заказ уже обработан другим администратором", show_alert=True)
        else:
            await call.answer("❌ Ошибка подтверждения. Попробуйте ещё раз.", show_alert=True)
        return
    order = await api.get_order(order_id)
    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            await call.bot.send_message(
                client_tg,
                f"✅ Ваш заказ #{order_id} подтверждён!\nСкоро назначим курьера."
            )
        except Exception:
            pass
    couriers = await api.get_couriers()
    kb = mgr_courier_select_kb(couriers, order_id)
    try:
        await call.message.edit_text(
            f"✅ Заказ #{order_id} подтверждён!\n\nВыберите курьера:", reply_markup=kb,
        )
    except Exception:
        await call.message.answer(
            f"✅ Заказ #{order_id} подтверждён!\n\nВыберите курьера:", reply_markup=kb,
        )
    await call.answer()


@router.callback_query(F.data.startswith("mgr:reject:"))
async def mgr_reject(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await call.message.answer(
        f"Выберите причину отклонения заказа #{order_id}:",
        reply_markup=mgr_order_reject_kb(order_id),
    )
    await call.answer()


_REJECT_REASONS = {
    "stock": "Товар временно закончился",
    "addr": "Адрес недоступен для доставки",
    "time": "Выбранное время недоступно",
}


@router.callback_query(F.data.startswith("mgr:rj_r:"))
async def mgr_reject_quick(call: CallbackQuery, state: FSMContext):
    if not await is_manager(call.from_user.id):
        return
    parts = call.data.split(":")
    order_id, reason_key = int(parts[2]), parts[3]
    if reason_key == "custom":
        await state.update_data(reject_order_id=order_id)
        await state.set_state(MgrRejectCustom.waiting_reason)
        await call.message.answer(f"Введите причину отклонения заказа #{order_id}:")
        await call.answer()
        return
    reason = _REJECT_REASONS.get(reason_key, reason_key)
    await _do_reject(call, order_id, reason)


async def _do_reject(target, order_id: int, reason: str):
    try:
        await api.reject_order(order_id, reason, from_bot=True)
    except Exception as e:
        if "409" in str(e):
            if isinstance(target, CallbackQuery):
                await target.answer("Заказ уже обработан другим администратором", show_alert=True)
            return
    order = await api.get_order(order_id)
    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            send = target.bot.send_message if isinstance(target, CallbackQuery) else target.bot.send_message
            await send(
                client_tg,
                f"❌ Ваш заказ #{order_id} отклонён.\nПричина: {reason}\n"
                "Если есть вопросы — обратитесь в поддержку."
            )
        except Exception:
            pass
    reply_text = f"❌ Заказ #{order_id} отклонён.\nПричина: {reason}"
    if isinstance(target, CallbackQuery):
        await target.message.edit_text(reply_text)
        await target.answer()
    else:
        await target.answer(reply_text)


@router.message(MgrRejectCustom.waiting_reason)
async def mgr_reject_custom_reason(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    data = await state.get_data()
    order_id = data["reject_order_id"]
    await state.clear()
    await _do_reject(message, order_id, message.text.strip())


@router.message(MgrReject.waiting_reason)
async def mgr_reject_reason(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    data = await state.get_data()
    order_id = data["reject_order_id"]
    await state.clear()
    await _do_reject(message, order_id, message.text.strip())


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
    try:
        await api.assign_courier(order_id, courier_id, from_bot=True, manager_telegram_id=call.from_user.id)
    except Exception:
        await call.answer("❌ Не удалось назначить курьера.", show_alert=True)
        return
    order = await api.get_order(order_id)
    couriers = await api.get_couriers()
    courier = next((c for c in couriers if c["id"] == courier_id), None)
    if courier and courier.get("telegram_id"):
        items_text = "\n".join(f"  • {i['product_name']} ×{i['quantity']}" for i in order.get("items", []))
        try:
            from keyboards.courier import courier_order_kb
            await call.bot.send_message(
                courier["telegram_id"],
                f"🚴 Вам назначен заказ #{order_id}!\n\n"
                f"Адрес: {order.get('address','—')}\nТелефон: {order.get('recipient_phone','—')}\n"
                f"Товары:\n{items_text}\nСумма: {fmt(order.get('total',0))}\n"
                f"Возврат бутылок: {order.get('return_bottles_count', 0)} шт.",
                reply_markup=courier_order_kb(order_id),
            )
        except Exception:
            pass
    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
            cname = courier["name"] if courier else "Курьер"
            courier_phone = courier.get("phone", "") if courier else ""
            kb = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="📞 Позвонить курьеру", url=f"tel:{courier_phone}")]
            ]) if courier_phone else None
            await call.bot.send_message(
                client_tg,
                f"🚴 {cname} назначен на ваш заказ #{order_id}!\nОжидайте доставку.",
                reply_markup=kb,
            )
        except Exception:
            pass
    result_text = f"✅ Курьер назначен на заказ #{order_id}."
    try:
        await call.message.edit_text(result_text)
    except Exception:
        await call.message.answer(result_text)
    await call.answer()


@router.callback_query(F.data.startswith("mgr:in_delivery:"))
async def mgr_mark_in_delivery(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await api.start_delivery(order_id, from_bot=True)
    order = await api.get_order(order_id)
    await call.message.edit_text(_mgr_order_text(order), reply_markup=_mgr_order_kb(order), parse_mode="HTML")
    await call.answer("✅ Статус обновлён")


@router.callback_query(F.data.startswith("mgr:delivered:"))
async def mgr_mark_delivered(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await api.mark_delivered(order_id, from_bot=True)
    order = await api.get_order(order_id)
    await call.message.edit_text(_mgr_order_text(order), reply_markup=_mgr_order_kb(order), parse_mode="HTML")
    await call.answer("✅ Доставлен")


@router.callback_query(F.data.startswith("mgr:cancel_order:"))
async def mgr_cancel_order_cb(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await api.reject_order(order_id, "Отменён менеджером", from_bot=True)
    order = await api.get_order(order_id)
    await call.message.edit_text(_mgr_order_text(order), reply_markup=_mgr_order_kb(order), parse_mode="HTML")
    await call.answer("❌ Заказ отменён")


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
    await call.message.answer(
        f"Выберите сумму пополнения для клиента ID {user_id}:",
        reply_markup=mgr_topup_presets_kb(user_id),
    )
    await call.answer()


@router.callback_query(F.data.startswith("mgr:tp_p:"))
async def mgr_topup_preset(call: CallbackQuery, state: FSMContext):
    if not await is_manager(call.from_user.id):
        return
    parts = call.data.split(":")
    user_id, amount = int(parts[2]), int(parts[3])
    result = await api.topup_user(user_id, amount)
    new_balance = result.get("new_balance", 0)
    await call.message.edit_text(
        f"✅ Баланс пополнен на {fmt(amount)}.\nНовый баланс: {fmt(new_balance)}"
    )
    await call.answer()


@router.callback_query(F.data.startswith("mgr:topup_manual:"))
async def mgr_topup_manual(call: CallbackQuery, state: FSMContext):
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


# ─── Client detail tabs ───────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("mgr:client_orders:"))
async def mgr_client_orders(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    user_id = int(call.data.split(":")[2])
    orders = await api.get_user_orders(user_id)
    if not orders:
        await call.answer("У клиента нет заказов.")
        return
    STATUS_SHORT = {"new": "🆕", "awaiting_confirmation": "⏳", "confirmed": "✅",
                    "assigned_to_courier": "🚚", "in_delivery": "🚴", "delivered": "✔️", "rejected": "❌"}
    lines = [f"📦 <b>Заказы клиента (последние {min(len(orders), 10)}):</b>\n"]
    for o in orders[:10]:
        icon = STATUS_SHORT.get(o["status"], "•")
        lines.append(f"{icon} #{o['id']} — {fmt(o['total'])} — {o.get('delivery_time', '—')[:10]}")
    await call.message.answer("\n".join(lines), parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("mgr:client_tx:"))
async def mgr_client_tx(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    user_id = int(call.data.split(":")[2])
    txs = await api.get_user_transactions(user_id)
    if not txs:
        await call.answer("Транзакций нет.")
        return
    lines = [f"💳 <b>Транзакции клиента (последние {min(len(txs), 10)}):</b>\n"]
    for t in txs[:10]:
        sign = "+" if t.get("amount", 0) > 0 else ""
        lines.append(f"• {t.get('created_at', '')[:10]} {sign}{fmt(t.get('amount', 0))} — {t.get('type', '—')}")
    await call.message.answer("\n".join(lines), parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("mgr:client_subs:"))
async def mgr_client_subs(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    user_id = int(call.data.split(":")[2])
    subs = await api.get_subscriptions(user_id)
    active = [s for s in subs if s.get("status") == "active"]
    if not active:
        await call.answer("Активных подписок нет.")
        return
    lines = [f"📋 <b>Подписки клиента ({len(active)} активных):</b>\n"]
    plan_label = {"weekly": "Еженедельная", "monthly": "Ежемесячная"}
    for s in active:
        lines.append(
            f"• {plan_label.get(s.get('plan', ''), s.get('plan', ''))} — "
            f"{s.get('water_summary', '')} | День: {s.get('day', '—')}"
        )
    await call.message.answer("\n".join(lines), parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("mgr:client_bottles:"))
async def mgr_client_bottles(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    user_id = int(call.data.split(":")[2])
    bottles = await api.get_bottles_owed(user_id)
    count = bottles.get("count", 0)
    await call.answer()
    await call.message.answer(
        f"🫙 <b>Бутылки клиента</b>\n\nК возврату: <b>{count} шт.</b>",
        parse_mode="HTML",
    )


# ─── Support chat ──────────────────────────────────────────────────────────────

@router.message(F.text.in_({"💬 Поддержка", "💬 Чат поддержки", "🆘 Поддержка"}))
async def mgr_support(message: Message):
    if not await is_manager(message.from_user.id):
        return
    try:
        chats = await api.get_manager_support_chats()
    except Exception:
        chats = []

    if not chats:
        from keyboards.user import site_link_kb
        await message.answer(
            "💬 <b>Поддержка</b>\n\nНет активных обращений.\nИли откройте веб-панель:",
            reply_markup=site_link_kb("🌐 Открыть на сайте", "/manager/support"),
            parse_mode="HTML",
        )
        return

    lines = [f"💬 <b>Обращения в поддержку ({len(chats)}):</b>\n"]
    for c in chats[:10]:
        unread = f" 🔴{c['unread']}" if c.get("unread") else ""
        lines.append(f"• {c.get('client_name', '—')}: {(c.get('last_message') or '')[:40]}{unread}")
    await message.answer("\n".join(lines), parse_mode="HTML")
    for c in chats[:5]:
        await message.answer(
            f"👤 <b>{c.get('client_name', '—')}</b>\n{c.get('last_message', '')[:80]}",
            reply_markup=mgr_support_quick_kb(c["id"]),
            parse_mode="HTML",
        )


@router.callback_query(F.data.startswith("mgr:sup_reply:"))
async def mgr_support_reply_start(call: CallbackQuery, state: FSMContext):
    if not await is_manager(call.from_user.id):
        return
    chat_id = int(call.data.split(":")[2])
    await state.update_data(sup_chat_id=chat_id)
    await state.set_state(MgrSupportReply.waiting_text)
    await call.message.answer("Введите ответ клиенту:")
    await call.answer()


@router.message(MgrSupportReply.waiting_text)
async def mgr_support_reply_send(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    data = await state.get_data()
    chat_id = data["sup_chat_id"]
    await state.clear()
    try:
        result = await api.send_manager_support_reply(chat_id, message.text.strip())
        client_tg = result.get("client_telegram_id")
        if client_tg:
            try:
                await message.bot.send_message(
                    client_tg,
                    f"💬 Ответ от поддержки:\n\n{message.text.strip()}"
                )
            except Exception:
                pass
        await message.answer("✅ Ответ отправлен.")
    except Exception:
        await message.answer("❌ Не удалось отправить ответ.")


_QUICK_REPLIES = {
    "1": "✅ Ваш заказ обрабатывается. Ожидайте.",
    "2": "🚴 Курьер уже в пути к вам!",
    "3": "📞 Ожидайте звонка от нашего оператора.",
    "4": "🙏 Спасибо за обращение! Рады помочь.",
}


@router.callback_query(F.data.startswith("mgr:sup_q:"))
async def mgr_support_quick_reply(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    parts = call.data.split(":")
    chat_id, reply_key = int(parts[2]), parts[3]
    reply_text = _QUICK_REPLIES.get(reply_key, "")
    if not reply_text:
        await call.answer("Неизвестный ответ")
        return
    try:
        result = await api.send_manager_support_reply(chat_id, reply_text)
        client_tg = result.get("client_telegram_id")
        if client_tg:
            try:
                await call.bot.send_message(client_tg, f"💬 Ответ от поддержки:\n\n{reply_text}")
            except Exception:
                pass
        await call.message.edit_text(f"✅ Отправлено: {reply_text}")
    except Exception:
        await call.answer("Не удалось отправить", show_alert=True)
    await call.answer()


# ─── Subscriptions management ─────────────────────────────────────────────────

async def _mgr_subs_menu(message_or_call, is_call: bool = False):
    weekly = await api.get_admin_subscriptions(plan="weekly", status="active")
    monthly = await api.get_admin_subscriptions(plan="monthly", status="active")
    text = _subs_summary_text(weekly, monthly)
    kb = subs_menu_kb("mgr", len(weekly), len(monthly))
    if is_call:
        try:
            await message_or_call.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
        except Exception:
            await message_or_call.message.answer(text, parse_mode="HTML", reply_markup=kb)
        await message_or_call.answer()
    else:
        await message_or_call.answer(text, parse_mode="HTML", reply_markup=kb)


@router.message(F.text == "📅 Подписки")
async def mgr_subs_overview(message: Message):
    if not await is_manager(message.from_user.id):
        return
    await _mgr_subs_menu(message, is_call=False)


@router.callback_query(F.data == "mgr:subs:menu")
async def mgr_subs_menu_cb(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    await _mgr_subs_menu(call, is_call=True)


@router.callback_query(F.data.startswith("mgr:subs:weekly:") | F.data.startswith("mgr:subs:monthly:"))
async def mgr_subs_list(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    parts = call.data.split(":")
    plan, page = parts[2], int(parts[3])
    subs = await api.get_admin_subscriptions(plan=plan, status="active")

    def _sort_key(s):
        return 0 if s.get("overdue") else (1 if s.get("due_today") else 2)

    subs.sort(key=_sort_key)
    plan_label = "Еженедельные" if plan == "weekly" else "Ежемесячные"
    PAGE_SIZE = 5
    start = page * PAGE_SIZE
    chunk = subs[start:start + PAGE_SIZE]
    header = f"📋 <b>{plan_label} подписки ({len(subs)}):</b>\n\n"
    detail_lines = [f"{i + 1}. {_sub_card_text(s)}" for i, s in enumerate(chunk, start=start)]
    text = header + "\n\n".join(detail_lines) if chunk else header + "Нет активных подписок."

    kb = subs_list_kb("mgr", subs, plan, page, can_create_order=True)
    try:
        await call.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
    except Exception:
        await call.message.answer(text, parse_mode="HTML", reply_markup=kb)
    await call.answer()


@router.callback_query(F.data.startswith("mgr:sub_order:"))
async def mgr_sub_create_order(call: CallbackQuery):
    if not await is_manager(call.from_user.id):
        return
    sub_id = int(call.data.split(":")[2])
    try:
        result = await api.create_order_from_subscription(sub_id)
    except Exception as e:
        await call.answer(f"❌ Ошибка: {e}", show_alert=True)
        return

    order_id = result["order_id"]
    couriers = await api.get_couriers()
    from keyboards.admin import courier_select_kb
    kb = courier_select_kb(couriers, order_id)
    text = (
        f"✅ Заказ #{order_id} создан из подписки!\n\n"
        f"Клиент: {result.get('client_name', '—')}\n"
        f"Адрес: {result.get('address', '—')}\n"
        f"Товары: {result.get('items_text', '—')}\n"
        f"Сумма: {int(result.get('total', 0)):,} сум\n\n"
        f"Выберите курьера для назначения:"
    )
    try:
        await call.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
    except Exception:
        await call.message.answer(text, parse_mode="HTML", reply_markup=kb)
    await call.answer()
