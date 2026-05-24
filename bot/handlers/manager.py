import asyncio
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command, Filter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.manager import (
    manager_menu_kb, mgr_order_kb, mgr_courier_select_kb,
    mgr_client_kb,
    mgr_order_reject_kb, mgr_support_chat_kb, mgr_support_quick_kb,
)
from keyboards.admin import subs_menu_kb, subs_list_kb
from keyboards.courier import courier_assignment_text, courier_assignment_kb, _is_phone
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from handlers.admin import _format_subs, _subs_summary_text, _sub_card_text, _order_detail_lines, _notify_order_staff
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

PAY_RU = {"cash": "💵 Наличные", "card": "💳 Карта"}


def fmt(amount):
    return f"{int(amount):,}".replace(",", " ") + " сум"


async def is_manager(telegram_id: int) -> bool:
    mgr = await api.get_manager_by_telegram(telegram_id)
    return mgr is not None


class _IsManagerFilter(Filter):
    async def __call__(self, message: Message) -> bool:
        return await is_manager(message.from_user.id)


class MgrReject(StatesGroup):
    waiting_reason = State()



class MgrBroadcast(StatesGroup):
    waiting_text = State()


class MgrMsgClient(StatesGroup):
    waiting_text = State()

class MgrSupportReply(StatesGroup):
    waiting_text = State()

class MgrRejectCustom(StatesGroup):
    waiting_reason = State()

class MgrOrderCreate(StatesGroup):
    waiting_input = State()
    choosing_product = State()
    waiting_bottles = State()
    waiting_lent_bottles = State()
    choosing_address = State()
    waiting_address = State()
    confirming = State()


# ─── Entry ────────────────────────────────────────────────────────────────────

@router.message(Command("manager"))
async def manager_panel(message: Message):
    if not await is_manager(message.from_user.id):
        return
    subs_on = await api.is_subscriptions_enabled()
    sup_on = await api.is_support_chat_enabled()
    await message.answer(
        "🧑‍💼 Панель менеджера:",
        reply_markup=manager_menu_kb(subs_enabled=subs_on, support_enabled=sup_on),
    )


# ─── Orders ───────────────────────────────────────────────────────────────────



def _mgr_order_text(o: dict) -> str:
    st = STATUS_RU.get(o["status"], o["status"])
    items = o.get("items", [])

    item_lines = [f"  • {i['product_name']} {i['quantity']} шт." for i in items]

    surcharge = o.get("bottle_surcharge") or 0
    if surcharge > 0:
        item_lines.append(f"  • Надбавка за невозврат +{fmt(surcharge)}")

    items_text = "\n".join(item_lines) if item_lines else "—"
    pay = PAY_RU.get(o.get("payment_method", ""), "—")

    delivery_fee = o.get("delivery_fee") or 0
    delivery_part = f"\n🚚 Доставка: +{fmt(delivery_fee)}" if delivery_fee > 0 else ""

    bonus_used = o.get("bonus_used") or 0
    bonus_part = f"\n🎁 Бонусы: -{fmt(bonus_used)}" if bonus_used > 0 else ""

    return_count = o.get("return_bottles_count") or 0
    return_line = f"\n♻️ Возврат бутылок: {return_count} шт." if return_count > 0 else ""

    lent_count = o.get("bottles_lent") or 0
    lent_line = f"\n🔄 Одолжено: {lent_count} шт." if lent_count > 0 else ""

    bottles_owed = o.get("client_bottles_owed") or 0
    bottles_line = f"\n🫙 Долг клиента: {bottles_owed} бут." if bottles_owed > 0 else ""

    lines = [
        f"📦 <b>{st}</b>",
        f"Клиент: {o.get('client_name', '—')}  |  {o.get('recipient_phone', '—')}",
        f"Адрес: {o.get('address', '—')}",
    ]
    if o.get("extra_info"):
        lines.append(f"Доп.: {o['extra_info']}")

    lines += [f"\nТовары:\n{items_text}"]
    lines.append(f"\n💵 Итого: {fmt(o.get('total') or 0)}  |  {pay}{delivery_part}{bonus_part}")

    if return_line:
        lines.append(return_line)
    if lent_line:
        lines.append(lent_line)
    if bottles_line:
        lines.append(bottles_line)

    if o.get("courier_name"):
        courier_phone = o.get("courier_phone", "")
        phone_part = f"  |  {courier_phone}" if courier_phone else ""
        lines.append(f"Курьер: {o['courier_name']}{phone_part}")

    return "\n".join(lines)


def _mgr_order_kb(o: dict):
    """Keyboard for notification-triggered order actions."""
    oid = o["id"]
    status = o.get("status", "")
    rows = []
    client_tg = o.get("client_telegram_id")
    if status == "awaiting_confirmation":
        rows.append([
            InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"mgr:confirm:{oid}"),
            InlineKeyboardButton(text="❌ Отклонить",   callback_data=f"mgr:reject:{oid}"),
        ])
    if status == "confirmed":
        rows.append([InlineKeyboardButton(text="🚴 Назначить курьера", callback_data=f"mgr:assign:{oid}")])
    if status in ("confirmed", "assigned_to_courier", "in_delivery"):
        rows.append([InlineKeyboardButton(text="✔️ Отметить доставлен", callback_data=f"mgr:delivered:{oid}")])
    if client_tg:
        rows.append([InlineKeyboardButton(text="✉️ Написать клиенту", url=f"tg://user?id={client_tg}")])
    if status not in ("delivered", "rejected"):
        rows.append([InlineKeyboardButton(text="❌ Отменить заказ", callback_data=f"mgr:cancel_order:{oid}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _app(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path



@router.callback_query(F.data.startswith("mgr:confirm:"))
async def mgr_confirm(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    parts = call.data.split(":")
    order_id = int(parts[2])
    tab = parts[3] if len(parts) > 3 else ""
    page = int(parts[4]) if len(parts) > 4 else 0
    try:
        await api.confirm_order(order_id, from_bot=True)
    except Exception as e:
        if "409" in str(e):
            await call.message.answer("⚠️ Заказ уже обработан другим администратором.")
        else:
            await call.message.answer("❌ Ошибка подтверждения. Попробуйте ещё раз.")
        return
    order = await api.get_order(order_id)
    couriers = await api.get_couriers()
    kb = mgr_courier_select_kb(couriers, order_id, tab=tab, page=page)
    body = _order_detail_lines(order)
    confirm_text = f"✅ <b>Заказ подтверждён</b>\n\n{body}\n\nВыберите курьера:"
    try:
        await call.message.edit_text(confirm_text, reply_markup=kb, parse_mode="HTML")
    except Exception:
        await call.message.answer(confirm_text, reply_markup=kb, parse_mode="HTML")


@router.callback_query(F.data.startswith("mgr:reject:"))
async def mgr_reject(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await call.message.answer(
        f"Выберите причину отклонения заказа #{order_id}:",
        reply_markup=mgr_order_reject_kb(order_id),
    )


_REJECT_REASONS = {
    "stock": "Товар временно закончился",
    "addr": "Адрес недоступен для доставки",
    "time": "Выбранное время недоступно",
}


@router.callback_query(F.data.startswith("mgr:rj_r:"))
async def mgr_reject_quick(call: CallbackQuery, state: FSMContext):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    parts = call.data.split(":")
    order_id, reason_key = int(parts[2]), parts[3]
    if reason_key == "custom":
        await state.update_data(reject_order_id=order_id)
        await state.set_state(MgrRejectCustom.waiting_reason)
        await call.message.answer(f"Введите причину отклонения заказа #{order_id}:")
        return
    reason = _REJECT_REASONS.get(reason_key, reason_key)
    await _do_reject(call, order_id, reason,
                     rejected_by_name=call.from_user.full_name, rejected_by_role="manager")


async def _do_reject(target, order_id: int, reason: str,
                     rejected_by_name: str | None = None, rejected_by_role: str | None = None):
    try:
        await api.reject_order(order_id, reason, from_bot=True,
                               rejected_by_name=rejected_by_name, rejected_by_role=rejected_by_role)
    except Exception as e:
        if "409" in str(e):
            if isinstance(target, CallbackQuery):
                await target.message.answer("⚠️ Заказ уже обработан другим администратором.")
            return
    reply_text = f"❌ Заказ #{order_id} отменён.\nПричина: {reason}"
    if isinstance(target, CallbackQuery):
        try:
            await target.message.edit_text(reply_text)
        except Exception:
            await target.message.answer(reply_text)
    else:
        await target.answer(reply_text)


@router.message(MgrRejectCustom.waiting_reason)
async def mgr_reject_custom_reason(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    data = await state.get_data()
    order_id = data["reject_order_id"]
    await state.clear()
    await _do_reject(message, order_id, message.text.strip(),
                     rejected_by_name=message.from_user.full_name, rejected_by_role="manager")


@router.message(MgrReject.waiting_reason)
async def mgr_reject_reason(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    data = await state.get_data()
    order_id = data["reject_order_id"]
    await state.clear()
    await _do_reject(message, order_id, message.text.strip(),
                     rejected_by_name=message.from_user.full_name, rejected_by_role="manager")


@router.callback_query(F.data.startswith("mgr:edit_items:"))
async def mgr_edit_items_cb(call: CallbackQuery, state: FSMContext):
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    from handlers.courier import _start_edit_items
    await _start_edit_items(call, state, order_id)
    await state.update_data(editor_role="manager")


@router.callback_query(F.data.startswith("mgr:assign:"))
async def mgr_assign(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    parts = call.data.split(":")
    order_id = int(parts[2])
    tab = parts[3] if len(parts) > 3 else ""
    page = int(parts[4]) if len(parts) > 4 else 0
    try:
        couriers = await api.get_couriers()
        kb = mgr_courier_select_kb(couriers, order_id, tab=tab, page=page)
        text = f"Выберите курьера для заказа #{order_id}:"
        try:
            await call.message.edit_text(text, reply_markup=kb)
        except Exception:
            await call.message.answer(text, reply_markup=kb)
    except Exception as e:
        await call.message.answer(f"❌ Ошибка загрузки курьеров: {e}")


@router.callback_query(F.data.startswith("mgr:set_courier:"))
async def mgr_set_courier(call: CallbackQuery):
    await call.answer()  # acknowledge immediately — all work below can exceed 10s
    if not await is_manager(call.from_user.id):
        return
    parts = call.data.split(":")
    order_id, courier_id = int(parts[2]), int(parts[3])
    tab = parts[4] if len(parts) > 4 else ""
    page = int(parts[5]) if len(parts) > 5 else 0
    try:
        await api.assign_courier(order_id, courier_id, from_bot=True, manager_telegram_id=call.from_user.id)
    except Exception:
        await call.answer("❌ Не удалось назначить курьера.", show_alert=True)
        return
    order = await api.get_order(order_id)
    couriers = await api.get_couriers()
    courier = next((c for c in couriers if c["id"] == courier_id), None)

    if courier and courier.get("telegram_id"):
        try:
            sent = await call.bot.send_message(
                courier["telegram_id"],
                "🚴 Вам назначен новый заказ!\n\n" + courier_assignment_text(order),
                reply_markup=courier_assignment_kb(order_id, order),
                parse_mode="HTML",
            )
            try:
                await api.save_courier_msg_id(order_id, sent.message_id)
            except Exception:
                pass
        except Exception:
            pass

    # Notify client that courier has been assigned
    client_tg = order.get("client_telegram_id")
    if client_tg:
        courier_name_for_client = courier["name"] if courier else "?"
        courier_phone_for_client = courier.get("phone") if courier else None
        phone_line = f"\nТелефон курьера: {courier_phone_for_client}" if courier_phone_for_client else ""
        try:
            client_sent = await call.bot.send_message(
                client_tg,
                f"🚴 Курьер {courier_name_for_client} назначен на ваш заказ!\nОжидайте доставку.{phone_line}",
            )
            try:
                await api.save_client_msg_id(order_id, client_sent.message_id)
            except Exception:
                pass
        except Exception:
            pass

    courier_name = courier["name"] if courier else "?"
    body = _order_detail_lines(order)
    result_text = f"✅ <b>Курьер {courier_name} назначен</b>\n\n{body}"
    back_kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Заказы", url=_app("/manager"))],
        [InlineKeyboardButton(text="❌ Отменить заказ", callback_data=f"order:cancel:{order_id}")],
    ])
    try:
        await call.message.edit_text(result_text, reply_markup=back_kb, parse_mode="HTML")
    except Exception:
        await call.message.answer(result_text, reply_markup=back_kb, parse_mode="HTML")


@router.callback_query(F.data.startswith("mgr:in_delivery:"))
async def mgr_mark_in_delivery(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await api.start_delivery(order_id, from_bot=True)
    order = await api.get_order(order_id)
    try:
        await call.message.edit_text(_mgr_order_text(order), reply_markup=_mgr_order_kb(order), parse_mode="HTML")
    except Exception:
        await call.message.answer(_mgr_order_text(order), reply_markup=_mgr_order_kb(order), parse_mode="HTML")


@router.callback_query(F.data.startswith("mgr:delivered:"))
async def mgr_mark_delivered(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    result = await api.mark_delivered(order_id, from_bot=True)
    order = await api.get_order(order_id)

    from keyboards.user import review_kb
    client_tg = order.get("client_telegram_id")
    bonus = (result or {}).get("bonus", 0) if isinstance(result, dict) else 0
    if client_tg:
        try:
            bonus_txt = f"\n🎁 Начислено {fmt(bonus)} сум бонусных баллов!" if bonus and bonus > 0 else ""
            await call.bot.send_message(client_tg, f"✅ Ваш заказ доставлен!{bonus_txt}")
            await call.bot.send_message(
                client_tg,
                "Пожалуйста, оцените качество доставки:",
                reply_markup=review_kb(order_id),
            )
        except Exception:
            pass

    try:
        await call.message.edit_text(_mgr_order_text(order), reply_markup=_mgr_order_kb(order), parse_mode="HTML")
    except Exception:
        await call.message.answer(_mgr_order_text(order), reply_markup=_mgr_order_kb(order), parse_mode="HTML")


@router.callback_query(F.data.startswith("mgr:cancel_order:"))
async def mgr_cancel_order_cb(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    reason = "Отменён менеджером"
    try:
        await api.reject_order(order_id, reason, from_bot=True,
                               rejected_by_name=call.from_user.full_name, rejected_by_role="manager")
    except Exception as e:
        if "409" in str(e):
            await call.message.answer("⚠️ Заказ уже обработан.")
            return

    order = await api.get_order(order_id)
    try:
        await call.message.edit_text(_mgr_order_text(order), reply_markup=_mgr_order_kb(order), parse_mode="HTML")
    except Exception:
        await call.message.answer(_mgr_order_text(order), reply_markup=_mgr_order_kb(order), parse_mode="HTML")



# ─── Clients ──────────────────────────────────────────────────────────────────


@router.callback_query(F.data.startswith("mgr:msg_client:"))
async def mgr_msg_client_start(call: CallbackQuery, state: FSMContext):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    tg_id = int(call.data.split(":")[2])
    await state.update_data(msg_client_tg=tg_id)
    await state.set_state(MgrMsgClient.waiting_text)
    await call.message.answer("Введите сообщение для клиента:")


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


# ─── Client detail tabs ───────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("mgr:client_orders:"))
async def mgr_client_orders(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    user_id = int(call.data.split(":")[2])
    orders = await api.get_user_orders(user_id)
    if not orders:
        await call.message.answer("У клиента нет заказов.")
        return
    STATUS_SHORT = {"new": "🆕", "awaiting_confirmation": "⏳", "confirmed": "✅",
                    "assigned_to_courier": "🚚", "in_delivery": "🚴", "delivered": "✔️", "rejected": "❌"}
    lines = [f"📦 <b>Заказы клиента (последние {min(len(orders), 10)}):</b>\n"]
    for o in orders[:10]:
        icon = STATUS_SHORT.get(o["status"], "•")
        lines.append(f"{icon} #{o['id']} — {fmt(o['total'])} — {o.get('delivery_time', '—')[:10]}")
    await call.message.answer("\n".join(lines), parse_mode="HTML")


@router.callback_query(F.data.startswith("mgr:client_tx:"))
async def mgr_client_tx(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    user_id = int(call.data.split(":")[2])
    txs = await api.get_user_transactions(user_id)
    if not txs:
        await call.message.answer("Транзакций нет.")
        return
    lines = [f"💳 <b>Транзакции клиента (последние {min(len(txs), 10)}):</b>\n"]
    for t in txs[:10]:
        sign = "+" if t.get("amount", 0) > 0 else ""
        lines.append(f"• {t.get('created_at', '')[:10]} {sign}{fmt(t.get('amount', 0))} — {t.get('type', '—')}")
    await call.message.answer("\n".join(lines), parse_mode="HTML")


@router.callback_query(F.data.startswith("mgr:client_subs:"))
async def mgr_client_subs(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.message.answer("⚠️ Подписки отключены.")
        return
    user_id = int(call.data.split(":")[2])
    subs = await api.get_subscriptions(user_id)
    active = [s for s in subs if s.get("status") == "active"]
    if not active:
        await call.message.answer("Активных подписок нет.")
        return
    lines = [f"📋 <b>Подписки клиента ({len(active)} активных):</b>\n"]
    plan_label = {"weekly": "Еженедельная", "monthly": "Ежемесячная"}
    for s in active:
        lines.append(
            f"• {plan_label.get(s.get('plan', ''), s.get('plan', ''))} — "
            f"{s.get('water_summary', '')} | День: {s.get('day', '—')}"
        )
    await call.message.answer("\n".join(lines), parse_mode="HTML")


@router.callback_query(F.data.startswith("mgr:client_bottles:"))
async def mgr_client_bottles(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    user_id = int(call.data.split(":")[2])
    bottles = await api.get_bottles_owed(user_id)
    count = bottles.get("count", 0)
    pending = bottles.get("pending_return", 0)
    available = bottles.get("available", count)
    if pending > 0:
        text = (
            f"🫙 <b>Бутылки клиента</b>\n\n"
            f"Долг: <b>{count} шт.</b>\n"
            f"В процессе возврата: <b>{pending} шт.</b>\n"
            f"Доступно к возврату: <b>{available} шт.</b>"
        )
    else:
        text = f"🫙 <b>Бутылки клиента</b>\n\nК возврату: <b>{count} шт.</b>"
    await call.message.answer(text, parse_mode="HTML")


# ─── Support chat ──────────────────────────────────────────────────────────────

@router.message(F.text.in_({"💬 Поддержка", "💬 Чат поддержки", "🆘 Поддержка"}))
async def mgr_support(message: Message):
    if not await is_manager(message.from_user.id):
        return
    cfg = await api.get_settings()
    if not cfg.get("support_chat_enabled", True):
        contacts = (cfg.get("support_contacts_text") or "").strip()
        body = ("💬 <b>Поддержка</b>\n\n" + contacts) if contacts else (
            "💬 <b>Поддержка</b>\n\nЧат поддержки отключён администратором."
        )
        await message.answer(body, parse_mode="HTML")
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
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    chat_id = int(call.data.split(":")[2])
    await state.update_data(sup_chat_id=chat_id)
    await state.set_state(MgrSupportReply.waiting_text)
    await call.message.answer("Введите ответ клиенту:")


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
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    parts = call.data.split(":")
    chat_id, reply_key = int(parts[2]), parts[3]
    reply_text = _QUICK_REPLIES.get(reply_key, "")
    if not reply_text:
        await call.message.answer("Неизвестный ответ.")
        return
    try:
        result = await api.send_manager_support_reply(chat_id, reply_text)
        client_tg = result.get("client_telegram_id")
        if client_tg:
            try:
                await call.bot.send_message(client_tg, f"💬 Ответ от поддержки:\n\n{reply_text}")
            except Exception:
                pass
        try:
            await call.message.edit_text(f"✅ Отправлено: {reply_text}")
        except Exception:
            await call.message.answer(f"✅ Отправлено: {reply_text}")
    except Exception:
        await call.message.answer("❌ Не удалось отправить.")


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
    else:
        await message_or_call.answer(text, parse_mode="HTML", reply_markup=kb)


@router.message(F.text == "📅 Подписки", _IsManagerFilter())
async def mgr_subs_overview(message: Message):
    if not await is_manager(message.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await message.answer("📅 Модуль подписок отключён администратором.")
        return
    await _mgr_subs_menu(message, is_call=False)


@router.callback_query(F.data == "mgr:subs:menu")
async def mgr_subs_menu_cb(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.message.answer("⚠️ Подписки отключены.")
        return
    await _mgr_subs_menu(call, is_call=True)


@router.callback_query(F.data.startswith("mgr:subs:weekly:") | F.data.startswith("mgr:subs:monthly:"))
async def mgr_subs_list(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.message.answer("⚠️ Подписки отключены.")
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


@router.callback_query(F.data.startswith("mgr:sub_order:"))
async def mgr_sub_create_order(call: CallbackQuery):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.message.answer("⚠️ Подписки отключены.")
        return
    sub_id = int(call.data.split(":")[2])
    try:
        result = await api.create_order_from_subscription(sub_id)
    except Exception as e:
        await call.message.answer(f"❌ Ошибка: {e}")
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


# ─── Manager manual order creation ────────────────────────────────────────────

from aiogram.types import ReplyKeyboardRemove


def _mco_exch_price(p: dict) -> float:
    if p.get("has_bottle_deposit") and p.get("deposit_price"):
        return float(p["deposit_price"])
    return float(p.get("effective_price") or p.get("price") or 0)


def _mco_full_price(p: dict) -> float:
    return float(p.get("price") or 0)


def _mco_spc(products: list) -> float:
    for p in products:
        if p.get("has_bottle_deposit") and p.get("bottle_surcharge"):
            return float(p["bottle_surcharge"])
    for p in products:
        if p.get("has_bottle_deposit"):
            diff = _mco_full_price(p) - _mco_exch_price(p)
            if diff > 0:
                return diff
    return 0.0


def _mco_qty19(items: dict, products: list) -> int:
    prod_map = {str(p["id"]): p for p in products}
    return sum(qty for pid, qty in items.items() if prod_map.get(pid, {}).get("has_bottle_deposit"))


def _mco_calc_surcharge(items: dict, products: list, return_bottles: int, bottles_lent: int = 0) -> float:
    missing = max(0, _mco_qty19(items, products) - return_bottles - bottles_lent)
    return missing * _mco_spc(products)


def _mco_bottles_step_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔄 Одолжить бутылки", callback_data="mco:lent_bottles")]
    ])


def _mco_client_addrs(client: dict | None) -> list:
    if not client:
        return []
    for key in ("order_addresses", "addresses"):
        raw = client.get(key) or []
        if raw:
            result = []
            for a in raw:
                addr = (a.get("address") or "") if isinstance(a, dict) else str(a)
                if addr and addr not in result:
                    result.append(addr)
            if result:
                return result
    return []


def _mco_grid_kb(products: list, items: dict) -> InlineKeyboardMarkup:
    rows = []
    pair = []
    for p in products:
        if not p.get("is_active", True):
            continue
        pid = str(p["id"])
        qty = items.get(pid, 0)
        name = p.get("name", "?")
        label = f"✅ {name} ×{qty}" if qty > 0 else f"➕ {name}"
        pair.append(InlineKeyboardButton(text=label, callback_data=f"mco:cp:{pid}"))
        if len(pair) == 2:
            rows.append(pair)
            pair = []
    if pair:
        rows.append(pair)
    if items:
        total_qty = sum(items.values())
        prod_map = {str(p["id"]): p for p in products}
        total_price = sum(_mco_exch_price(prod_map[pid]) * qty for pid, qty in items.items() if pid in prod_map)
        rows.append([InlineKeyboardButton(
            text=f"▶ Далее  {total_qty} шт. · {fmt(total_price)}",
            callback_data="mco:done",
        )])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _mco_grid_text(items: dict, products: list) -> str:
    if not items:
        return "🛒 <b>Состав заказа</b>\n\nВыберите товары:"
    prod_map = {str(p["id"]): p for p in products}
    lines = ["🛒 <b>Состав заказа</b>", ""]
    total = 0
    for pid, qty in items.items():
        p = prod_map.get(pid, {})
        ep = _mco_exch_price(p)
        fp = _mco_full_price(p)
        s = ep * qty
        total += s
        dep = " ♻" if p.get("has_bottle_deposit") and ep < fp else ""
        lines.append(f"  • {p.get('name', pid)} {qty} шт. — {fmt(s)}{dep}")
    lines.append(f"\n<b>Итого: {fmt(total)}</b>")
    return "\n".join(lines)


def _mco_qty_kb(pid: str, qty: int) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(text="➖", callback_data=f"mco:qd:{pid}:-1"),
            InlineKeyboardButton(text=f"{qty} шт.", callback_data="mco:noop"),
            InlineKeyboardButton(text="➕", callback_data=f"mco:qd:{pid}:1"),
        ],
        [
            InlineKeyboardButton(text="1", callback_data=f"mco:qs:{pid}:1"),
            InlineKeyboardButton(text="2", callback_data=f"mco:qs:{pid}:2"),
            InlineKeyboardButton(text="3", callback_data=f"mco:qs:{pid}:3"),
        ],
        [
            InlineKeyboardButton(text="5", callback_data=f"mco:qs:{pid}:5"),
            InlineKeyboardButton(text="10", callback_data=f"mco:qs:{pid}:10"),
            InlineKeyboardButton(text="20", callback_data=f"mco:qs:{pid}:20"),
        ],
    ]
    actions = []
    if qty > 0:
        actions.append(InlineKeyboardButton(text="🗑 Убрать", callback_data=f"mco:qremove:{pid}"))
    actions.append(InlineKeyboardButton(text="◀ Назад", callback_data="mco:back_catalog"))
    rows.append(actions)
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _mco_qty_text(pid: str, products: list, items: dict) -> str:
    p = next((x for x in products if str(x["id"]) == pid), {})
    ep = _mco_exch_price(p)
    fp = _mco_full_price(p)
    qty = items.get(pid, 0)
    vol = p.get("volume", "")
    vol_str = f" {vol}л" if vol else ""
    dep_hint = f"\n<i>♻ Цена с обменом. Без обмена: {fmt(fp)}</i>" if p.get("has_bottle_deposit") and ep < fp else ""
    lines = [f"<b>{p.get('name', '?')}{vol_str}</b>", f"💵 {fmt(ep)} за шт.{dep_hint}"]
    if qty > 0:
        lines.append(f"\n📦 В заказе: {qty} шт. — {fmt(ep * qty)}")
    lines.append("\nВыберите количество:")
    return "\n".join(lines)


def _mco_confirm_text(data: dict, products: list) -> str:
    client = data.get("mco_client")
    phone = data.get("mco_phone", "—")
    address = data.get("mco_address", "—")
    items = data.get("mco_items", {})
    return_bottles = data.get("mco_return_bottles", 0)
    lent_bottles = data.get("mco_lent_bottles", 0)
    prod_map = {str(p["id"]): p for p in products}
    surcharge = _mco_calc_surcharge(items, products, return_bottles, lent_bottles)

    lines = ["📋 <b>Подтверждение заказа</b>\n"]
    if client:
        _cname = client.get('name') or (client.get('order_addresses') or [{}])[0].get('address', '—')
        lines.append(f"👤 {_cname} · {phone}")
    else:
        lines.append(f"👤 {phone}")
    lines.append(f"📍 {address}")
    lines.append("\nТовары:")

    total = 0
    for pid, qty in items.items():
        p = prod_map.get(pid, {})
        ep = _mco_exch_price(p)
        fp = _mco_full_price(p)
        s = ep * qty
        total += s
        dep = " ♻" if p.get("has_bottle_deposit") and ep < fp else ""
        lines.append(f"  • {p.get('name', pid)} {qty} шт. — {fmt(s)}{dep}")

    if return_bottles > 0:
        lines.append(f"\n♻️ Возврат: {return_bottles} шт.")
    if lent_bottles > 0:
        lines.append(f"🔄 Одолжено: {lent_bottles} шт.")
    if surcharge > 0:
        missing = max(0, _mco_qty19(items, products) - return_bottles - lent_bottles)
        lines.append(f"🫙 Надбавка за невозврат {missing} бут.: +{fmt(surcharge)}")
        total += surcharge

    lines.append(f"\n<b>Итого: {fmt(total)}</b>")
    return "\n".join(lines)


def _mco_confirm_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✏️ Состав", callback_data="mco:edit:items"),
            InlineKeyboardButton(text="♻️ Возврат", callback_data="mco:edit:bottles"),
            InlineKeyboardButton(text="📍 Адрес", callback_data="mco:edit:address"),
        ],
        [InlineKeyboardButton(text="✅ Создать заказ", callback_data="mco:confirm")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="mco:cancel")],
    ])


def _mco_addr_kb(options: list) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=f"📍 {addr[:45]}", callback_data=f"mco:adr:{i}")]
        for i, addr in enumerate(options)
    ]
    rows.append([InlineKeyboardButton(text="✏️ Другой адрес", callback_data="mco:adr:custom")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _mco_show_addr(target, state: FSMContext):
    data = await state.get_data()
    options = data.get("mco_addr_options", [])
    if options:
        await state.set_state(MgrOrderCreate.choosing_address)
        text = "📍 Выберите адрес доставки:"
        if isinstance(target, CallbackQuery):
            await target.message.edit_text(text, reply_markup=_mco_addr_kb(options))
        else:
            await target.answer(text, reply_markup=_mco_addr_kb(options))
    else:
        await state.set_state(MgrOrderCreate.waiting_address)
        text = "📍 Введите адрес доставки:"
        if isinstance(target, CallbackQuery):
            await target.message.edit_text(text)
        else:
            await target.answer(text)


async def _mco_show_confirm(target, state: FSMContext):
    data = await state.get_data()
    products = data.get("mco_products", [])
    text = _mco_confirm_text(data, products)
    kb = _mco_confirm_kb()
    await state.set_state(MgrOrderCreate.confirming)
    if isinstance(target, CallbackQuery):
        await target.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    else:
        await target.answer(text, reply_markup=kb, parse_mode="HTML")


@router.message(F.text == "📝 Создать заказ", _IsManagerFilter())
async def mgr_create_order_start(message: Message, state: FSMContext):
    await state.update_data(mco_items={})
    await state.set_state(MgrOrderCreate.waiting_input)
    await message.answer(
        "📝 <b>Создать заказ</b>\n\n"
        "Введите номер телефона клиента:\n"
        "<code>+998 90 123-45-67</code>\n\n"
        "Или быстрый ввод (3–4 строки через Enter):\n"
        "<code>5\n"
        "Балгарский, ул. Навои 12\n"
        "+998 91-551-51-44\n"
        "баклажка</code>\n\n"
        "<i>1 строка — кол-во 19л бутылей\n"
        "2 строка — адрес доставки\n"
        "3 строка — телефон клиента\n"
        "4 строка — число = надбавка только для N бутылок; б/баклажка = для всех; пусто = возврат всех</i>",
        parse_mode="HTML",
        reply_markup=ReplyKeyboardRemove(),
    )


@router.message(MgrOrderCreate.waiting_input)
async def mgr_co_input(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    text = message.text.strip()
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    products = await api.get_products()
    products = [p for p in products if p.get("is_active", True)]

    if len(lines) >= 3:
        # ── Quick input mode ──────────────────────────────────────────────────
        try:
            qty = int(lines[0])
        except ValueError:
            await message.answer(
                "❌ Первая строка должна быть числом (количество бутылей).\nПопробуйте ещё раз."
            )
            return

        quick_addr = lines[1]
        phone = lines[2]
        if sum(1 for c in phone if c.isdigit()) < 9:
            await message.answer("❌ 3 строка — неверный номер телефона. Введите минимум 9 цифр.\nПопробуйте ещё раз.")
            return
        non_return = 0
        if len(lines) > 3:
            fourth = lines[3].strip()
            try:
                non_return = max(0, int(fourth))
                return_bottles = max(0, qty - non_return)
            except ValueError:
                if fourth.lstrip()[:1].lower() in ("б", "b"):
                    non_return = qty
                    return_bottles = 0
                else:
                    return_bottles = qty
        else:
            return_bottles = qty

        main_product = next(
            (p for p in products if p.get("has_bottle_deposit") and float(p.get("volume") or 0) >= 18),
            None,
        )
        items = {str(main_product["id"]): qty} if main_product else {}

        client = await api.lookup_user_by_phone(phone)
        addr_options = [quick_addr]
        for a in _mco_client_addrs(client):
            if a not in addr_options:
                addr_options.append(a)

        await state.update_data(
            mco_phone=phone,
            mco_products=products,
            mco_items=items,
            mco_client=client,
            mco_return_bottles=return_bottles,
            mco_addr_options=addr_options,
            mco_edit_mode=False,
        )

        if client:
            bottles_owed = client.get("bottles_owed", 0)
            _cn = client.get('name') or (client.get('order_addresses') or [{}])[0].get('address', '—')
            info = f"✅ {_cn} · {client.get('phone', phone)}"
            if bottles_owed > 0:
                info += f"\n🫙 Долг бутылок: {bottles_owed} шт."
        else:
            info = f"ℹ️ Клиент не найден — заказ по номеру {phone}"

        if main_product:
            items_info = f"\n🛒 {main_product['name']} {qty} шт."
            if non_return > 0:
                items_info += f" · надбавка за {non_return} бут."
        else:
            items_info = "\n⚠️ 19л продукт не найден — добавьте состав вручную"

        await message.answer(f"{info}{items_info}", parse_mode="HTML")
        await _mco_show_addr(message, state)

    else:
        # ── Normal mode (phone) ───────────────────────────────────────────────
        phone = text
        if sum(1 for c in phone if c.isdigit()) < 9:
            await message.answer("❌ Неверный номер телефона — введите минимум 9 цифр.\nПопробуйте ещё раз.")
            return
        client = await api.lookup_user_by_phone(phone)

        await state.update_data(
            mco_phone=phone,
            mco_products=products,
            mco_items={},
            mco_client=client,
            mco_addr_options=_mco_client_addrs(client),
            mco_edit_mode=False,
        )
        await state.set_state(MgrOrderCreate.choosing_product)

        if client:
            bottles_owed = client.get("bottles_owed", 0)
            pending = client.get("pending_return", 0)
            available = client.get("available_bottles", bottles_owed)
            if bottles_owed > 0:
                if pending > 0:
                    bottle_line = (
                        f"\n🫙 Долг: {bottles_owed} бут. | В процессе: {pending} | Доступно: {available}"
                    )
                else:
                    bottle_line = f"\n🫙 Долг по бутылкам: {bottles_owed} шт."
            else:
                bottle_line = ""
            _cn = client.get('name') or (client.get('order_addresses') or [{}])[0].get('address', '—')
            info = f"✅ Клиент найден: {_cn} | {client.get('phone', phone)}{bottle_line}"
        else:
            info = "ℹ️ Клиент не найден — заказ создастся по номеру телефона"

        await message.answer(
            f"{info}\n\n{_mco_grid_text({}, products)}",
            reply_markup=_mco_grid_kb(products, {}),
            parse_mode="HTML",
        )


# ─── Products (grid catalog) ──────────────────────────────────────────────────

@router.callback_query(MgrOrderCreate.choosing_product, F.data == "mco:noop")
async def mgr_co_catalog_noop(call: CallbackQuery):
    await call.answer()


@router.callback_query(MgrOrderCreate.choosing_product, F.data.startswith("mco:cp:"))
async def mgr_co_pick_product(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":", 2)[2]
    data = await state.get_data()
    products = data.get("mco_products", [])
    items = data.get("mco_items", {})
    qty = items.get(pid, 0)
    await call.message.edit_text(
        _mco_qty_text(pid, products, items),
        reply_markup=_mco_qty_kb(pid, qty),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(MgrOrderCreate.choosing_product, F.data.startswith("mco:qd:"))
async def mgr_co_qty_delta(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    pid = parts[2]
    delta = int(parts[3])
    data = await state.get_data()
    items = dict(data.get("mco_items", {}))
    new_qty = max(0, items.get(pid, 0) + delta)
    if new_qty == 0:
        items.pop(pid, None)
    else:
        items[pid] = new_qty
    await state.update_data(mco_items=items)
    products = data.get("mco_products", [])
    await call.message.edit_text(
        _mco_qty_text(pid, products, items),
        reply_markup=_mco_qty_kb(pid, new_qty),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(MgrOrderCreate.choosing_product, F.data.startswith("mco:qs:"))
async def mgr_co_qty_set(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    pid = parts[2]
    qty = int(parts[3])
    data = await state.get_data()
    items = dict(data.get("mco_items", {}))
    if qty == 0:
        items.pop(pid, None)
    else:
        items[pid] = qty
    await state.update_data(mco_items=items)
    products = data.get("mco_products", [])
    await call.message.edit_text(
        _mco_qty_text(pid, products, items),
        reply_markup=_mco_qty_kb(pid, qty),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(MgrOrderCreate.choosing_product, F.data.startswith("mco:qremove:"))
async def mgr_co_qty_remove(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":", 2)[2]
    data = await state.get_data()
    items = dict(data.get("mco_items", {}))
    items.pop(pid, None)
    await state.update_data(mco_items=items)
    products = data.get("mco_products", [])
    await call.message.edit_text(
        _mco_grid_text(items, products),
        reply_markup=_mco_grid_kb(products, items),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(MgrOrderCreate.choosing_product, F.data == "mco:back_catalog")
async def mgr_co_back_catalog(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    products = data.get("mco_products", [])
    items = data.get("mco_items", {})
    await call.message.edit_text(
        _mco_grid_text(items, products),
        reply_markup=_mco_grid_kb(products, items),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(MgrOrderCreate.choosing_product, F.data == "mco:done")
async def mgr_co_items_done(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if not data.get("mco_items"):
        await call.answer("Добавьте хотя бы один товар!")
        return
    items = data.get("mco_items", {})
    products = data.get("mco_products", [])
    prod_map = {str(p["id"]): p for p in products}
    has_deposit = any(prod_map.get(pid, {}).get("has_bottle_deposit") for pid in items)

    if data.get("mco_edit_mode"):
        await call.answer()
        await _mco_show_confirm(call, state)
        return

    if has_deposit:
        await state.set_state(MgrOrderCreate.waiting_bottles)
        await call.message.edit_text(
            "🪣 Сколько пустых бутылей вернёт клиент?\nВведите число (0 — если не возвращает):",
            reply_markup=_mco_bottles_step_kb(),
        )
    else:
        await state.update_data(mco_return_bottles=0)
        await _mco_show_addr(call, state)
    await call.answer()


# ─── Bottles ──────────────────────────────────────────────────────────────────

@router.message(MgrOrderCreate.waiting_bottles)
async def mgr_co_bottles(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    try:
        count = max(0, int(message.text.strip()))
    except ValueError:
        await message.answer("Введите число, например: 0, 1, 2")
        return
    await state.update_data(mco_return_bottles=count)
    data = await state.get_data()
    if data.get("mco_edit_mode"):
        await _mco_show_confirm(message, state)
    else:
        await _mco_show_addr(message, state)


@router.callback_query(MgrOrderCreate.waiting_bottles, F.data == "mco:lent_bottles")
async def mgr_co_lent_tap(call: CallbackQuery, state: FSMContext):
    await call.answer()
    await state.set_state(MgrOrderCreate.waiting_lent_bottles)
    await call.message.edit_text("🔄 Сколько бутылок одолжить клиенту?\nВведите число:")


@router.message(MgrOrderCreate.waiting_lent_bottles)
async def mgr_co_lent_bottles(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    try:
        count = max(0, int(message.text.strip()))
    except ValueError:
        await message.answer("Введите число, например: 1, 2, 3")
        return
    await state.update_data(mco_lent_bottles=count)
    data = await state.get_data()
    if data.get("mco_edit_mode"):
        await _mco_show_confirm(message, state)
    else:
        await _mco_show_addr(message, state)


# ─── Address selection ────────────────────────────────────────────────────────

@router.callback_query(MgrOrderCreate.choosing_address, F.data.startswith("mco:adr:"))
async def mgr_co_select_addr(call: CallbackQuery, state: FSMContext):
    idx_str = call.data.split(":", 2)[2]
    if idx_str == "custom":
        await state.set_state(MgrOrderCreate.waiting_address)
        await call.message.edit_text("📍 Введите адрес доставки:")
        await call.answer()
        return

    data = await state.get_data()
    options = data.get("mco_addr_options", [])
    try:
        addr = options[int(idx_str)]
    except (ValueError, IndexError):
        await call.answer("Ошибка выбора")
        return

    await state.update_data(mco_address=addr)
    await call.answer()
    await _mco_show_confirm(call, state)


@router.message(MgrOrderCreate.waiting_address)
async def mgr_co_address(message: Message, state: FSMContext):
    if not await is_manager(message.from_user.id):
        return
    await state.update_data(mco_address=message.text.strip())
    await _mco_show_confirm(message, state)


# ─── Edit from confirmation ───────────────────────────────────────────────────

@router.callback_query(MgrOrderCreate.confirming, F.data == "mco:edit:items")
async def mgr_co_edit_items(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    products = data.get("mco_products", [])
    items = data.get("mco_items", {})
    await state.update_data(mco_edit_mode=True)
    await state.set_state(MgrOrderCreate.choosing_product)
    await call.message.edit_text(
        _mco_grid_text(items, products),
        reply_markup=_mco_grid_kb(products, items),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(MgrOrderCreate.confirming, F.data == "mco:edit:bottles")
async def mgr_co_edit_bottles(call: CallbackQuery, state: FSMContext):
    await state.update_data(mco_edit_mode=True)
    await state.set_state(MgrOrderCreate.waiting_bottles)
    await call.message.edit_text(
        "🪣 Сколько пустых бутылей вернёт клиент?\nВведите число (0 — если не возвращает):",
        reply_markup=_mco_bottles_step_kb(),
    )
    await call.answer()


@router.callback_query(MgrOrderCreate.confirming, F.data == "mco:edit:address")
async def mgr_co_edit_address(call: CallbackQuery, state: FSMContext):
    await state.update_data(mco_edit_mode=True)
    await call.answer()
    await _mco_show_addr(call, state)


# ─── Confirm / Cancel ─────────────────────────────────────────────────────────

@router.callback_query(MgrOrderCreate.confirming, F.data == "mco:confirm")
async def mgr_co_confirm(call: CallbackQuery, state: FSMContext):
    await call.answer()
    if not await is_manager(call.from_user.id):
        return
    data = await state.get_data()
    items_list = [{"product_id": int(pid), "quantity": qty} for pid, qty in data["mco_items"].items()]
    products = data.get("mco_products", [])
    return_bottles = data.get("mco_return_bottles", 0)
    lent_bottles = data.get("mco_lent_bottles", 0)
    surcharge = _mco_calc_surcharge(data["mco_items"], products, return_bottles, lent_bottles)
    mgr = await api.get_manager_by_telegram(call.from_user.id)
    try:
        result = await api.courier_create_order({
            "phone": data["mco_phone"],
            "address": data["mco_address"],
            "items": items_list,
            "payment_method": "cash",
            "return_bottles_count": return_bottles,
            "bottles_lent": lent_bottles,
            "bottle_surcharge": surcharge,
            "creator_role": "manager",
            "creator_name": (mgr or {}).get("name"),
            "manager_name": (mgr or {}).get("name"),
            "manager_phone": (mgr or {}).get("phone"),
        })
        oid = result.get("order_id") or result.get("id", "?")
    except Exception:
        await call.message.edit_text("❌ Ошибка при создании заказа. Попробуйте ещё раз.")
        await state.clear()
        return

    await state.clear()
    sent = await call.message.edit_text(f"✅ Заказ #{oid} создан!")
    await call.message.answer(
        "Панель менеджера:",
        reply_markup=manager_menu_kb(
            subs_enabled=await api.is_subscriptions_enabled(),
            support_enabled=await api.is_support_chat_enabled(),
        ),
    )
    await asyncio.sleep(2)
    try:
        await sent.delete()
    except Exception:
        pass


@router.callback_query(MgrOrderCreate.confirming, F.data == "mco:cancel")
async def mgr_co_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text("Заказ отменён.")
    await call.message.answer(
        "Панель менеджера:",
        reply_markup=manager_menu_kb(
            subs_enabled=await api.is_subscriptions_enabled(),
            support_enabled=await api.is_support_chat_enabled(),
        ),
    )
    await call.answer()
