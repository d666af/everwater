import asyncio
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, ReplyKeyboardRemove
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.admin import (
    admin_menu_kb, order_confirm_kb, courier_select_kb,
    stats_period_kb, admin_user_kb, broadcast_target_kb,
    product_list_kb, product_edit_kb, subs_menu_kb, subs_list_kb,
)
from keyboards.courier import courier_assignment_text, courier_assignment_kb, _is_phone
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from config import settings
from services.roles import get_all_admin_ids, add_secondary_admin, remove_secondary_admin

router = Router()
router.message.filter(lambda msg: is_admin(msg.from_user.id))

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


def fmt(v):
    return f"{int(v):,}".replace(",", " ") + " сум"


def is_admin(uid: int) -> bool:
    return uid in get_all_admin_ids()


# ─── FSM ──────────────────────────────────────────────────────────────────────

class AdminReject(StatesGroup):
    waiting_reason = State()

class AdminTopup(StatesGroup):
    waiting_user_id = State()
    waiting_amount = State()

class AdminManagerCreate(StatesGroup):
    waiting_tg_id = State()
    waiting_name = State()
    waiting_phone = State()

class AdminCourierCreate(StatesGroup):
    waiting_tg_id = State()
    waiting_name = State()
    waiting_phone = State()

class AdminSettings(StatesGroup):
    choosing_key = State()
    waiting_value = State()

class AdminBroadcast(StatesGroup):
    waiting_text = State()
    waiting_target = State()

class AdminMsgUser(StatesGroup):
    waiting_text = State()

class AdminWarehouseStaff(StatesGroup):
    waiting_tg_id = State()
    waiting_name  = State()

class AdminWarehouseProd(StatesGroup):
    choosing_product = State()
    waiting_quantity = State()
    waiting_note     = State()

class AdminProductCreate(StatesGroup):
    waiting_name   = State()
    waiting_volume = State()
    waiting_price  = State()
    waiting_type   = State()
    waiting_photo  = State()

class AdminProductEdit(StatesGroup):
    waiting_value = State()
    waiting_photo = State()


# ─── Entry ────────────────────────────────────────────────────────────────────

@router.message(Command("admin"))
async def admin_panel(message: Message):
    if not is_admin(message.from_user.id):
        return
    subs_on = await api.is_subscriptions_enabled()
    await message.answer("🔧 Панель администратора:", reply_markup=admin_menu_kb(subs_enabled=subs_on))


# ─── ReplyKeyboard text handlers (admin main menu) ────────────────────────────

def _admin_order_text(o: dict) -> str:
    st = STATUS_RU.get(o["status"], o["status"])
    items_text = "\n".join(f"  • {i['product_name']} {i['quantity']} шт." for i in o.get("items", []))
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
        courier_phone = o.get("courier_phone", "")
        phone_part = f"  |  {courier_phone}" if courier_phone else ""
        lines.append(f"Курьер: {o['courier_name']}{phone_part}")
    return "\n".join(lines)


def _admin_order_kb(o: dict):
    oid = o["id"]
    status = o.get("status", "")
    rows = []
    client_tg = o.get("client_telegram_id")
    if status == "awaiting_confirmation":
        rows.append([
            InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"admin:confirm:{oid}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"admin:reject:{oid}"),
        ])
    if status == "confirmed":
        rows.append([InlineKeyboardButton(text="🚴 Назначить курьера", callback_data=f"admin:assign:{oid}")])
    if status in ("confirmed", "assigned_to_courier", "in_delivery"):
        rows.append([InlineKeyboardButton(text="✔️ Отметить доставлен", callback_data=f"admin:delivered:{oid}")])
    if client_tg:
        rows.append([InlineKeyboardButton(text="✉️ Написать клиенту", url=f"tg://user?id={client_tg}")])
    if status not in ("delivered", "rejected"):
        rows.append([InlineKeyboardButton(text="❌ Отменить заказ", callback_data=f"admin:cancel_order:{oid}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


_CREATOR_ROLE_RU = {
    "manager": "Менеджер",
    "admin": "Администратор",
    "courier": "Курьер",
    "agent": "Агент",
}


def _order_detail_lines(o: dict) -> str:
    """Order info block without status badge, shared for notifications."""
    items = o.get("items", [])
    item_lines = [f"  • {i['product_name']} {i['quantity']} шт." for i in items]
    surcharge = o.get("bottle_surcharge") or 0
    if surcharge > 0:
        item_lines.append(f"  • Надбавка за невозврат +{fmt(surcharge)}")
    items_text = "\n".join(item_lines) if item_lines else "—"
    pay = PAY_RU.get(o.get("payment_method", ""), "—")
    lines = [
        f"👤 {o.get('client_name') or '—'}  |  {o.get('recipient_phone') or '—'}",
        f"📍 {o.get('address') or '—'}",
    ]
    if o.get("extra_info"):
        lines.append(f"ℹ️ {o['extra_info']}")
    delivery_fee = o.get('delivery_fee') or 0
    delivery_part = f" (вкл. доставку {fmt(delivery_fee)})" if delivery_fee > 0 else ""
    bonus_used = float(o.get('bonus_used') or 0)
    bonus_part = f"\n💎 Бонусная скидка: −{fmt(int(bonus_used))}" if bonus_used > 0 else ""
    return_count = o.get("return_bottles_count") or 0
    return_line = f"\n♻️ Возврат бутылок: {return_count} шт." if return_count > 0 else ""
    lent_count = o.get("bottles_lent") or 0
    lent_line = f"\n🔄 Одолжено: {lent_count} шт." if lent_count > 0 else ""
    lines += [f"\nТовары:\n{items_text}", f"💰 {fmt(o.get('total') or 0)}{delivery_part}  |  {pay}{bonus_part}{return_line}{lent_line}"]
    creator_role = o.get("creator_role")
    creator_name = o.get("creator_name")
    if creator_role:
        role_label = _CREATOR_ROLE_RU.get(creator_role, creator_role.capitalize())
        creator_line = f"✍️ {role_label}: {creator_name}" if creator_name else f"✍️ {role_label}"
    else:
        client_label = o.get("client_name") or "Клиент"
        creator_line = f"✍️ Клиент: {client_label}"
    lines.append(creator_line)
    if o.get("courier_name"):
        cp = o.get("courier_phone", "")
        lines.append(f"🚴 {o['courier_name']}{f'  |  {cp}' if cp else ''}")
    return "\n".join(lines)


async def _notify_order_staff(bot, caller_id: int, text: str, assigner_label: str | None = None):
    """Notify all admins+managers about an order action, skipping the caller to avoid duplicate."""
    notify_text = (text + f"\n\n👤 Назначил: {assigner_label}") if assigner_label else text
    recipients: set[int] = get_all_admin_ids()
    try:
        managers = await api.get_managers()
        for m in managers:
            if m.get("is_active") and m.get("telegram_id"):
                recipients.add(int(m["telegram_id"]))
    except Exception:
        pass
    recipients.discard(caller_id)
    for uid in recipients:
        try:
            await bot.send_message(uid, notify_text, parse_mode="HTML")
        except Exception:
            pass


# ─── Role switch from inline admin menu ───────────────────────────────────────

@router.callback_query(F.data == "role:switch")
async def role_switch_from_admin(call: CallbackQuery):
    from services.roles import get_user_roles, ROLE_LABELS
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    roles = await get_user_roles(call.from_user.id)
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=ROLE_LABELS[r], callback_data=f"role:select:{r}")]
        for r in roles
    ])
    await call.message.answer("Выберите режим:", reply_markup=kb)
    await call.answer()


# ─── Orders ───────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "admin:orders:all")
async def admin_all_orders(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    orders = await api.get_all_orders()
    if not orders:
        await call.message.answer("Заказов нет.")
        await call.answer()
        return
    lines = ["📋 <b>Все заказы (последние 20):</b>\n"]
    for o in orders[:20]:
        st = STATUS_RU.get(o["status"], o["status"])
        lines.append(f"{st} — {fmt(o['total'])} — {o['address'][:25]}")
    await call.message.answer("\n".join(lines), parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("admin:in_delivery:"))
async def admin_mark_in_delivery(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await api.start_delivery(order_id, from_bot=True)
    order = await api.get_order(order_id)
    await call.message.edit_text(_admin_order_text(order), reply_markup=_admin_order_kb(order), parse_mode="HTML")
    await call.answer("✅ Статус обновлён")


@router.callback_query(F.data.startswith("admin:delivered:"))
async def admin_mark_delivered(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await api.mark_delivered(order_id, from_bot=True)
    order = await api.get_order(order_id)
    await call.message.edit_text(_admin_order_text(order), reply_markup=_admin_order_kb(order), parse_mode="HTML")
    await call.answer("✅ Доставлен")


@router.callback_query(F.data.startswith("order:cancel:"))
async def order_cancel_unified(call: CallbackQuery):
    """Unified cancel handler for courier-order notifications sent to both admins and managers."""
    from handlers.manager import is_manager as _is_manager
    _is_adm = is_admin(call.from_user.id)
    _is_mgr = (await _is_manager(call.from_user.id)) if not _is_adm else False
    if not _is_adm and not _is_mgr:
        await call.answer("Нет прав.", show_alert=True)
        return
    order_id = int(call.data.split(":")[2])
    reason = "Отменён администратором" if _is_adm else "Отменён менеджером"
    role = "admin" if _is_adm else "manager"
    try:
        await api.reject_order(order_id, reason, from_bot=True,
                               rejected_by_name=call.from_user.full_name, rejected_by_role=role)
    except Exception as e:
        if "409" in str(e):
            await call.answer("⚠️ Заказ уже обработан.", show_alert=True)
        else:
            await call.answer("❌ Ошибка. Попробуйте ещё раз.", show_alert=True)
        return
    await call.answer("❌ Заказ отменён")


@router.callback_query(F.data.startswith("admin:cancel_order:"))
async def admin_cancel_order_cb(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    try:
        await api.reject_order(order_id, "Отменён администратором", from_bot=True,
                               rejected_by_name=call.from_user.full_name, rejected_by_role="admin")
    except Exception as e:
        if "409" in str(e):
            await call.answer("⚠️ Заказ уже обработан.", show_alert=True)
        else:
            await call.answer("❌ Ошибка. Попробуйте ещё раз.", show_alert=True)
        return
    order = await api.get_order(order_id)
    try:
        await call.message.edit_text(_admin_order_text(order), reply_markup=_admin_order_kb(order), parse_mode="HTML")
    except Exception:
        pass
    await call.answer("❌ Заказ отменён")


@router.callback_query(F.data == "admin:orders:awaiting_confirmation")
async def admin_pending_orders(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    orders = await api.get_all_orders(status="awaiting_confirmation")
    if not orders:
        await call.message.answer("Нет заказов, ожидающих подтверждения.")
        await call.answer()
        return
    for o in orders[:5]:
        items_text = "\n".join(f"  • {i['product_name']} {i['quantity']} шт." for i in o.get("items", []))
        text = (
            f"📦 <b>Новый заказ</b>\n"
            f"Клиент: {o.get('client_name', '—')}\n"
            f"Телефон: {o.get('recipient_phone', '—')}\n"
            f"Адрес: {o['address']}\n"
            f"Время: {o.get('delivery_time') or '—'}\n"
            f"Товары:\n{items_text}\n"
            f"Сумма: {fmt(o['total'])}\n"
            f"Оплата: {PAY_RU.get(o.get('payment_method', ''), '—')}\n"
            f"Возврат бутылок: {o.get('return_bottles_count', 0)} шт."
            + (f"\nОдолжено: {o.get('bottles_lent')} шт." if (o.get('bottles_lent') or 0) > 0 else "")
        )
        await call.message.answer(text, reply_markup=order_confirm_kb(o["id"]), parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("admin:confirm:"))
async def admin_confirm(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    try:
        await api.confirm_order(order_id, from_bot=True)
    except Exception as e:
        msg = str(e)
        if "409" in msg:
            await call.answer("Заказ уже обработан другим администратором", show_alert=True)
        else:
            await call.answer("❌ Ошибка подтверждения. Попробуйте ещё раз.", show_alert=True)
        return
    order = await api.get_order(order_id)
    couriers = await api.get_couriers()
    kb = courier_select_kb(couriers, order_id)
    body = _order_detail_lines(order)
    confirm_text = f"✅ <b>Заказ подтверждён</b>\n\n{body}\n\nВыберите курьера:"
    try:
        await call.message.edit_text(confirm_text, reply_markup=kb, parse_mode="HTML")
    except Exception:
        await call.message.answer(confirm_text, reply_markup=kb, parse_mode="HTML")
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
    reason = message.text.strip()
    try:
        await api.reject_order(order_id, reason, from_bot=True,
                               rejected_by_name=message.from_user.full_name, rejected_by_role="admin")
    except Exception as e:
        await state.clear()
        if "409" in str(e):
            await message.answer("Заказ уже обработан другим администратором.")
        else:
            await message.answer("❌ Ошибка при отклонении заказа.")
        return
    await state.clear()
    await message.answer(f"❌ Заказ #{order_id} отменён. Причина: {reason}")


@router.callback_query(F.data.startswith("admin:set_courier:"))
async def admin_set_courier(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    await call.answer()  # acknowledge immediately — all work below can exceed 10s
    parts = call.data.split(":")
    order_id, courier_id = int(parts[2]), int(parts[3])
    try:
        await api.assign_courier(order_id, courier_id, from_bot=True, manager_telegram_id=call.from_user.id)
    except Exception:
        await call.answer("❌ Не удалось назначить курьера. Попробуйте ещё раз.", show_alert=True)
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

    courier_name = courier["name"] if courier else "?"
    body = _order_detail_lines(order)
    result_text = f"✅ <b>Курьер {courier_name} назначен</b>\n\n{body}"
    try:
        await call.message.edit_text(result_text, parse_mode="HTML")
    except Exception:
        await call.message.answer(result_text, parse_mode="HTML")


@router.callback_query(F.data.startswith("admin:assign:"))
async def admin_assign(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        await call.answer()
        return
    order_id = int(call.data.split(":")[2])
    try:
        couriers = await api.get_couriers()
        kb = courier_select_kb(couriers, order_id)
        text = f"Выберите курьера для заказа #{order_id}:"
        try:
            await call.message.edit_text(text, reply_markup=kb)
        except Exception:
            await call.message.answer(text, reply_markup=kb)
    except Exception as e:
        await call.message.answer(f"❌ Ошибка загрузки курьеров: {e}")
    await call.answer()


@router.callback_query(F.data.startswith("admin:contact:"))
async def admin_contact_client(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    order = await api.get_order(order_id)
    tg_id = order.get("client_telegram_id")
    if not tg_id:
        await call.answer("Нет Telegram ID клиента", show_alert=True)
        return
    await state.update_data(msg_client_tg=tg_id)
    await state.set_state(AdminMsgUser.waiting_text)
    await call.message.answer(f"Введите сообщение клиенту (заказ #{order_id}):")
    await call.answer()


@router.message(AdminMsgUser.waiting_text)
async def admin_msg_user_send(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    data = await state.get_data()
    tg_id = data.get("msg_client_tg")
    await state.clear()
    if not tg_id:
        await message.answer("Не найден получатель.")
        return
    try:
        await message.bot.send_message(tg_id, f"📩 Сообщение от администратора:\n\n{message.text}")
        await message.answer("✅ Сообщение отправлено.")
    except Exception:
        await message.answer("❌ Не удалось отправить.")


# ─── Stats ────────────────────────────────────────────────────────────────────

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


# ─── Couriers ─────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "admin:couriers")
async def admin_couriers(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    couriers = await api.get_couriers()
    if not couriers:
        await call.message.answer("Нет курьеров.")
        await call.answer()
        return
    lines = ["🚴 <b>Курьеры:</b>\n"]
    for c in couriers:
        active = "✅" if c.get("is_active") else "❌"
        lines.append(f"{active} {c['name']} | tg: {c['telegram_id']} | {c['total_deliveries']} доставок")
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Добавить курьера", callback_data="admin:courier_create")],
        [InlineKeyboardButton(text="← Назад", callback_data="admin:back")],
    ])
    await call.message.edit_text("\n".join(lines), reply_markup=kb, parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data == "admin:courier_create")
async def admin_courier_create_start(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    await state.set_state(AdminCourierCreate.waiting_tg_id)
    await call.message.answer("Введите Telegram ID нового курьера:")
    await call.answer()


@router.message(AdminCourierCreate.waiting_tg_id)
async def admin_courier_tg(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if not message.text.strip().lstrip("-").isdigit():
        await message.answer("Введите числовой Telegram ID.")
        return
    tg_id = int(message.text.strip())
    await state.update_data(new_courier_tg=tg_id)
    user = await api.get_user(tg_id)
    if user and user.get("name"):
        name = user["name"]
        phone = user.get("phone") or ""
        await state.update_data(new_courier_name=name)
        if phone:
            await state.clear()
            result = await api.create_courier_api(tg_id, name, phone)
            await message.answer(
                f"✅ Курьер создан (данные из аккаунта)!\n"
                f"Имя: {result.get('name')}\nТелефон: {phone}\nTelegram ID: {tg_id}"
            )
            try:
                await message.bot.send_message(tg_id, "🚴 Вы добавлены как курьер Ever Water!\nИспользуйте /courier для доступа.")
            except Exception:
                pass
            return
        await state.set_state(AdminCourierCreate.waiting_phone)
        await message.answer(
            f"📋 Имя подтянуто из аккаунта: <b>{name}</b>\n"
            "Введите телефон курьера (или «-» чтобы пропустить):",
            parse_mode="HTML",
        )
    else:
        await state.set_state(AdminCourierCreate.waiting_name)
        await message.answer("Введите имя курьера:")


@router.message(AdminCourierCreate.waiting_name)
async def admin_courier_name(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.update_data(new_courier_name=message.text.strip())
    await state.set_state(AdminCourierCreate.waiting_phone)
    await message.answer("Введите телефон курьера (или «-» чтобы пропустить):")


@router.message(AdminCourierCreate.waiting_phone)
async def admin_courier_phone(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    phone = "" if message.text.strip() == "-" else message.text.strip()
    data = await state.get_data()
    await state.clear()
    result = await api.create_courier_api(data["new_courier_tg"], data["new_courier_name"], phone)
    await message.answer(
        f"✅ Курьер создан!\nИмя: {result.get('name')}\nTelegram ID: {result.get('telegram_id')}"
    )
    try:
        await message.bot.send_message(
            data["new_courier_tg"],
            "🚴 Вы добавлены в систему как курьер Ever Water!\n"
            "Используйте /courier для доступа к панели курьера."
        )
    except Exception:
        pass


# ─── Users ────────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "admin:users")
async def admin_users(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    users = await api.get_all_users()
    registered = [u for u in users if u.get("is_registered")]
    lines = [f"👥 <b>Клиенты: {len(registered)} зарегистрировано</b>\n"]
    for u in registered[:15]:
        lines.append(f"• {u.get('name', '—')} | {u.get('phone', '—')}")
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="← Назад", callback_data="admin:back")],
    ])
    await call.message.edit_text("\n".join(lines), reply_markup=kb, parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("admin_sub_confirm:"))
async def admin_sub_confirm(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.answer("Подписки отключены администратором", show_alert=True)
        return
    sub_id = int(call.data.split(":")[1])
    try:
        await api.confirm_subscription(sub_id)
        await call.message.edit_text(f"✅ Подписка #{sub_id} подтверждена!")
    except Exception as e:
        if "409" in str(e):
            await call.answer("Подписка уже обработана другим администратором", show_alert=True)
        else:
            await call.answer("❌ Ошибка. Попробуйте ещё раз.", show_alert=True)
    await call.answer()


@router.callback_query(F.data.startswith("admin_sub_reject:"))
async def admin_sub_reject(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.answer("Подписки отключены администратором", show_alert=True)
        return
    sub_id = int(call.data.split(":")[1])
    try:
        await api.reject_subscription(sub_id)
        await call.message.edit_text(f"❌ Подписка #{sub_id} отклонена.")
    except Exception as e:
        if "409" in str(e):
            await call.answer("Подписка уже обработана другим администратором", show_alert=True)
        else:
            await call.answer("❌ Ошибка. Попробуйте ещё раз.", show_alert=True)
    await call.answer()


# ─── Managers ─────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "admin:managers")
async def admin_managers(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    managers = await api.get_managers()
    lines = ["🧑‍💼 <b>Менеджеры:</b>\n"]
    for m in managers:
        active = "✅" if m.get("is_active") else "❌"
        lines.append(f"{active} {m['name']} | tg: {m['telegram_id']} | {m.get('phone', '—')}")
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Добавить менеджера", callback_data="admin:mgr_create")],
        [InlineKeyboardButton(text="← Назад", callback_data="admin:back")],
    ])
    await call.message.edit_text("\n".join(lines) if managers else "Менеджеров нет.",
                                  reply_markup=kb, parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data == "admin:mgr_create")
async def admin_mgr_create_start(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    await state.set_state(AdminManagerCreate.waiting_tg_id)
    await call.message.answer("Введите Telegram ID нового менеджера:")
    await call.answer()


@router.message(AdminManagerCreate.waiting_tg_id)
async def admin_mgr_tg(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    if not message.text.strip().lstrip("-").isdigit():
        await message.answer("Введите числовой Telegram ID.")
        return
    tg_id = int(message.text.strip())
    await state.update_data(new_mgr_tg=tg_id)
    user = await api.get_user(tg_id)
    if user and user.get("name"):
        name = user["name"]
        phone = user.get("phone") or ""
        await state.update_data(new_mgr_name=name)
        if phone:
            await state.clear()
            result = await api.create_manager_api(tg_id, name, phone)
            await message.answer(
                f"✅ Менеджер создан (данные из аккаунта)!\n"
                f"Имя: {result.get('name')}\nТелефон: {phone}\nTelegram ID: {tg_id}"
            )
            try:
                await message.bot.send_message(tg_id, "🧑‍💼 Вы добавлены как менеджер Ever Water!\nИспользуйте /manager для доступа.")
            except Exception:
                pass
            return
        await state.set_state(AdminManagerCreate.waiting_phone)
        await message.answer(
            f"📋 Имя подтянуто из аккаунта: <b>{name}</b>\n"
            "Введите телефон менеджера (или «-» чтобы пропустить):",
            parse_mode="HTML",
        )
    else:
        await state.set_state(AdminManagerCreate.waiting_name)
        await message.answer("Введите имя менеджера:")


@router.message(AdminManagerCreate.waiting_name)
async def admin_mgr_name(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.update_data(new_mgr_name=message.text.strip())
    await state.set_state(AdminManagerCreate.waiting_phone)
    await message.answer("Введите телефон менеджера (или «-» чтобы пропустить):")


@router.message(AdminManagerCreate.waiting_phone)
async def admin_mgr_phone(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    phone = "" if message.text.strip() == "-" else message.text.strip()
    data = await state.get_data()
    await state.clear()
    result = await api.create_manager_api(data["new_mgr_tg"], data["new_mgr_name"], phone)
    await message.answer(
        f"✅ Менеджер создан!\nИмя: {result.get('name')}\nTelegram ID: {result.get('telegram_id')}"
    )
    try:
        await message.bot.send_message(
            data["new_mgr_tg"],
            "🧑‍💼 Вы добавлены в систему как менеджер Ever Water!\n"
            "Используйте /manager для доступа к панели менеджера."
        )
    except Exception:
        pass


# ─── Warehouse overview ───────────────────────────────────────────────────────

@router.callback_query(F.data == "admin:warehouse")
async def admin_warehouse(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    stock = await api.get_warehouse_stock()
    lines = ["📦 <b>Склад:</b>\n"]
    if stock:
        for item in stock:
            qty = item.get("quantity", 0)
            warn = " ⚠️" if qty < 10 else ""
            lines.append(f"• {item['product_name']} ({item.get('volume','')}л) — <b>{qty}</b> шт.{warn}")
    else:
        lines.append("Нет данных.")
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Записать производство", callback_data="admin:wh:prod")],
        [InlineKeyboardButton(text="👤 Добавить завсклада", callback_data="admin:wh:add_staff")],
        [InlineKeyboardButton(text="👥 Список завсклада", callback_data="admin:wh:list_staff")],
        [InlineKeyboardButton(text="🌐 Склад на сайте", url=_site("/admin/warehouse"))],
        [InlineKeyboardButton(text="← Назад", callback_data="admin:back")],
    ])
    await call.message.edit_text("\n".join(lines), reply_markup=kb, parse_mode="HTML")
    await call.answer()


def _site(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path


# ─── Warehouse staff management ───────────────────────────────────────────────

@router.callback_query(F.data == "admin:wh:add_staff")
async def admin_wh_add_staff_start(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    await state.set_state(AdminWarehouseStaff.waiting_tg_id)
    await call.message.answer("Введите Telegram ID нового завсклада:")
    await call.answer()


@router.message(AdminWarehouseStaff.waiting_tg_id)
async def admin_wh_staff_tg(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    text = message.text.strip().lstrip("-")
    if not text.isdigit():
        await message.answer("Введите числовой Telegram ID.")
        return
    tg_id = int(message.text.strip())
    await state.update_data(wh_staff_tg=tg_id)
    user = await api.get_user(tg_id)
    if user and user.get("name"):
        name = user["name"]
        await state.clear()
        from services.roles import add_warehouse_staff
        add_warehouse_staff(tg_id)
        await api.add_warehouse_staff_db(tg_id, name)
        await message.answer(
            f"✅ Завсклада добавлен!\nИмя: {name}\nTelegram ID: {tg_id}"
        )
        try:
            await message.bot.send_message(tg_id, "🏭 Вы добавлены как завсклада Ever Water!\nИспользуйте /warehouse для доступа к боту или откройте мини-приложение.")
        except Exception:
            pass
    else:
        await state.set_state(AdminWarehouseStaff.waiting_name)
        await message.answer("Введите имя завсклада:")


@router.message(AdminWarehouseStaff.waiting_name)
async def admin_wh_staff_name(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    data = await state.get_data()
    tg_id = data["wh_staff_tg"]
    name = message.text.strip()
    await state.clear()
    from services.roles import add_warehouse_staff
    add_warehouse_staff(tg_id)
    await api.add_warehouse_staff_db(tg_id, name)
    await message.answer(f"✅ Завсклада добавлен!\nИмя: {name}\nTelegram ID: {tg_id}")
    try:
        await message.bot.send_message(
            tg_id,
            "🏭 Вы добавлены как завсклада Ever Water!\n"
            "Используйте /warehouse для доступа к панели склада или откройте мини-приложение."
        )
    except Exception:
        pass


@router.callback_query(F.data == "admin:wh:list_staff")
async def admin_wh_list_staff(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    staff = await api.get_warehouse_staff_db()
    if not staff:
        await call.answer("Список завсклада пуст.", show_alert=True)
        return
    lines = ["🏭 <b>Завсклада:</b>\n"]
    for s in staff:
        name = s.get("name") or "—"
        tid = s.get("telegram_id")
        lines.append(f"• {name} (ID: {tid})")
    await call.message.answer("\n".join(lines), parse_mode="HTML")
    await call.answer()


# ─── Warehouse production from admin ─────────────────────────────────────────

@router.callback_query(F.data == "admin:wh:prod")
async def admin_wh_prod_start(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    stock = await api.get_warehouse_stock()
    if not stock:
        await call.answer("Нет продуктов на складе.", show_alert=True)
        return
    await state.update_data(wh_products=stock)
    await state.set_state(AdminWarehouseProd.choosing_product)
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text=f"{p['product_name']} ({p.get('volume','')}л) — {p.get('quantity',0)} шт.",
            callback_data=f"awh:prod:{p['product_id']}"
        )] for p in stock
    ])
    await call.message.answer("Выберите продукт для записи производства:", reply_markup=kb)
    await call.answer()


@router.callback_query(AdminWarehouseProd.choosing_product, F.data.startswith("awh:prod:"))
async def admin_wh_prod_product(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    product_id = int(call.data.split(":")[2])
    await state.update_data(awh_product_id=product_id)
    await state.set_state(AdminWarehouseProd.waiting_quantity)
    await call.message.edit_text("Введите количество произведённых бутылок:")
    await call.answer()


@router.message(AdminWarehouseProd.waiting_quantity)
async def admin_wh_prod_quantity(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    text = message.text.strip()
    if not text.isdigit() or int(text) <= 0:
        await message.answer("Введите корректное число.")
        return
    await state.update_data(awh_quantity=int(text))
    await state.set_state(AdminWarehouseProd.waiting_note)
    await message.answer("Заметка (или «-» чтобы пропустить):")


@router.message(AdminWarehouseProd.waiting_note)
async def admin_wh_prod_note(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    note = None if message.text.strip() == "-" else message.text.strip()
    data = await state.get_data()
    await state.clear()
    result = await api.warehouse_production(data["awh_product_id"], data["awh_quantity"], note)
    products = data.get("wh_products", [])
    prod = next((p for p in products if p["product_id"] == data["awh_product_id"]), {})
    await message.answer(
        f"✅ Производство записано!\n"
        f"Продукт: {prod.get('product_name', data['awh_product_id'])}\n"
        f"Количество: +{data['awh_quantity']} шт.\n"
        f"Новый остаток: {result.get('new_stock', '—')} шт."
    )


# ─── Settings ─────────────────────────────────────────────────────────────────

SETTINGS_LABELS = {
    "payment_card": "Номер карты для оплаты",
    "payment_holder": "Получатель платежа",
    "cashback_percent": "Кэшбек с заказа (значение)",
    "bonus_expiry_days": "Срок действия бонусов (дней)",
    "bottle_discount_value": "Бонус за бутылку (значение)",
}


def _is_setting_on(cfg: dict, key: str, default: bool = True) -> bool:
    v = cfg.get(key)
    if v is None:
        return default
    return str(v).lower() not in ("false", "0", "нет", "off", "no")


def _settings_display(cfg: dict):
    bonus_on = _is_setting_on(cfg, "bonus_program_enabled")
    bonus_type = cfg.get("bonus_program_type", "percent")
    bonus_val = cfg.get("cashback_percent", "—")
    expiry = cfg.get("bonus_expiry_days", "—")
    bottle_on = _is_setting_on(cfg, "bottle_bonus_enabled")
    bottle_type = cfg.get("bottle_discount_type", "fixed")
    bottle_val = cfg.get("bottle_discount_value", "—")
    card = cfg.get("payment_card", "—")
    holder = cfg.get("payment_holder", "—")

    b_icon = "✅" if bonus_on else "❌"
    bo_icon = "✅" if bottle_on else "❌"
    b_type_label = "фикс." if bonus_type == "fixed" else "%"
    bo_type_label = "фикс." if bottle_type == "fixed" else "%"
    bonus_val_sfx = " сум" if bonus_type == "fixed" else "%"
    bottle_val_sfx = " сум" if bottle_type == "fixed" else "%"
    bv = f"{bonus_val}{bonus_val_sfx}" if str(bonus_val) != "—" else "—"
    bov = f"{bottle_val}{bottle_val_sfx}" if str(bottle_val) != "—" else "—"
    expiry_str = f"{expiry} дн." if str(expiry) != "—" else "—"

    lines = [
        "⚙️ <b>Настройки</b>\n",
        "💳 <b>Оплата</b>",
        f"  Карта: {card}",
        f"  Получатель: {holder}",
        "",
        "🎁 <b>Бонусы</b>",
        f"  Кэшбек с заказа: {b_icon}  ({b_type_label}, {bv})",
        f"  Срок действия бонусов: {expiry_str}",
        f"  Бонус за бутылку: {bo_icon}  ({bo_type_label}, {bov})",
    ]

    b_tog = "Кэшбек: выкл" if bonus_on else "Кэшбек: вкл"
    bo_tog = "Бутылка: выкл" if bottle_on else "Бутылка: вкл"
    bf = "✅ Фикс" if bonus_type == "fixed" else "Фикс"
    bp = "✅ %" if bonus_type == "percent" else "%"
    bof = "✅ Фикс" if bottle_type == "fixed" else "Фикс"
    bop = "✅ %" if bottle_type == "percent" else "%"

    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💳 Карта", callback_data="admin:set:payment_card"),
         InlineKeyboardButton(text="👤 Получатель", callback_data="admin:set:payment_holder")],
        [InlineKeyboardButton(text=b_tog, callback_data="admin:tog:bonus_program"),
         InlineKeyboardButton(text=bf, callback_data="admin:set_type:bonus:fixed"),
         InlineKeyboardButton(text=bp, callback_data="admin:set_type:bonus:percent"),
         InlineKeyboardButton(text="✏️ Значение", callback_data="admin:set:cashback_percent")],
        [InlineKeyboardButton(text="⏳ Срок бонусов (дни)", callback_data="admin:set:bonus_expiry_days")],
        [InlineKeyboardButton(text=bo_tog, callback_data="admin:tog:bottle_bonus"),
         InlineKeyboardButton(text=bof, callback_data="admin:set_type:bottle:fixed"),
         InlineKeyboardButton(text=bop, callback_data="admin:set_type:bottle:percent"),
         InlineKeyboardButton(text="✏️ Размер", callback_data="admin:set:bottle_discount_value")],
        [InlineKeyboardButton(text="← Назад", callback_data="admin:back")],
    ])
    return "\n".join(lines), kb


@router.message(F.text == "⚙️ Настройки")
async def admin_text_settings(message: Message):
    if not is_admin(message.from_user.id):
        return
    cfg = await api.get_settings()
    text, kb = _settings_display(cfg)
    await message.answer(text, reply_markup=kb, parse_mode="HTML")


@router.callback_query(F.data == "admin:settings")
async def admin_settings(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    cfg = await api.get_settings()
    text, kb = _settings_display(cfg)
    try:
        await call.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    except Exception:
        await call.message.answer(text, reply_markup=kb, parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("admin:set:"))
async def admin_set_key(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    key = call.data.split(":", 2)[2]
    if key not in SETTINGS_LABELS:
        await call.answer("Неизвестная настройка", show_alert=True)
        return
    await state.update_data(settings_key=key)
    await state.set_state(AdminSettings.waiting_value)
    label = SETTINGS_LABELS.get(key, key)
    await call.message.answer(f"Введите новое значение для «{label}»:")
    await call.answer()


@router.message(AdminSettings.waiting_value)
async def admin_set_value(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    data = await state.get_data()
    key = data["settings_key"]
    value = message.text.strip()
    await api.update_settings({key: value})
    await state.clear()
    cfg = await api.get_settings()
    text, kb = _settings_display(cfg)
    await message.answer(f"✅ Сохранено\n\n{text}", reply_markup=kb, parse_mode="HTML")


@router.callback_query(F.data == "admin:tog:bonus_program")
async def admin_toggle_bonus(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    cfg = await api.get_settings()
    current = _is_setting_on(cfg, "bonus_program_enabled")
    await api.update_settings({"bonus_program_enabled": "false" if current else "true"})
    cfg = await api.get_settings()
    text, kb = _settings_display(cfg)
    await call.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    await call.answer("❌ Выключено" if current else "✅ Включено")


@router.callback_query(F.data == "admin:tog:bottle_bonus")
async def admin_toggle_bottle_bonus(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    cfg = await api.get_settings()
    current = _is_setting_on(cfg, "bottle_bonus_enabled")
    await api.update_settings({"bottle_bonus_enabled": "false" if current else "true"})
    cfg = await api.get_settings()
    text, kb = _settings_display(cfg)
    await call.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    await call.answer("❌ Выключено" if current else "✅ Включено")


@router.callback_query(F.data.startswith("admin:set_type:bonus:"))
async def admin_set_bonus_type(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    btype = call.data.split(":")[-1]
    await api.update_settings({"bonus_program_type": btype})
    cfg = await api.get_settings()
    text, kb = _settings_display(cfg)
    await call.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("admin:set_type:bottle:"))
async def admin_set_bottle_type(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    btype = call.data.split(":")[-1]
    await api.update_settings({"bottle_discount_type": btype})
    cfg = await api.get_settings()
    text, kb = _settings_display(cfg)
    await call.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    await call.answer()


# ─── Broadcast ────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "admin:broadcast")
async def admin_broadcast_start(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    await state.set_state(AdminBroadcast.waiting_text)
    await call.message.answer("Введите текст рассылки:")
    await call.answer()


@router.message(AdminBroadcast.waiting_text)
async def admin_broadcast_text(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.update_data(bc_text=message.text)
    await state.set_state(AdminBroadcast.waiting_target)
    await message.answer("Выберите получателей:", reply_markup=broadcast_target_kb())


@router.callback_query(F.data.startswith("admin:bc:"))
async def admin_broadcast_send(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    target_map = {"clients": "clients", "couriers": "couriers", "managers": "managers", "all": "all"}
    target = target_map.get(call.data.split(":")[2], "all")
    data = await state.get_data()
    text = data.get("bc_text", "")
    await state.clear()
    result = await api.broadcast(text, target)
    await call.message.edit_text(
        f"📣 Рассылка выполнена!\nОтправлено: {result.get('sent', 0)}\nОшибок: {result.get('failed', 0)}"
    )
    await call.answer()


# ─── Products ─────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "admin:products")
async def admin_products(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    products = await api.get_products()
    if not products:
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="➕ Добавить товар", callback_data="ap:new")],
            [InlineKeyboardButton(text="← Назад", callback_data="admin:back")],
        ])
        await call.message.edit_text("Товаров нет.", reply_markup=kb)
        await call.answer()
        return
    await call.message.edit_text("📦 <b>Товары:</b>", reply_markup=product_list_kb(products), parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("ap:edit:"))
async def admin_product_edit_menu(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    pid = int(call.data.split(":")[2])
    products = await api.get_products()
    p = next((x for x in products if x["id"] == pid), None)
    if not p:
        await call.answer("Товар не найден")
        return
    active = "✅ Активен" if p.get("is_active", True) else "❌ Неактивен"
    await call.message.edit_text(
        f"<b>{p.get('name', '—')}</b>\n"
        f"Объём: {p.get('volume', '—')} л | Цена: {fmt(p.get('price', 0))}\n"
        f"Тип: {p.get('type', '—')} | {active}",
        reply_markup=product_edit_kb(pid, has_deposit=p.get("has_bottle_deposit", False), deposit_price=p.get("deposit_price")),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(F.data.startswith("ap:del:"))
async def admin_product_toggle(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    pid = int(call.data.split(":")[2])
    products = await api.get_products()
    p = next((x for x in products if x["id"] == pid), None)
    if not p:
        await call.answer("Товар не найден")
        return
    new_active = not p.get("is_active", True)
    await api.update_product(pid, {"is_active": new_active})
    action = "деактивирован" if not new_active else "активирован"
    await call.answer(f"Товар {action}")
    products = await api.get_products()
    await call.message.edit_text("📦 <b>Товары:</b>", reply_markup=product_list_kb(products), parse_mode="HTML")


@router.callback_query(F.data == "ap:new")
async def admin_product_new(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    await state.set_state(AdminProductCreate.waiting_name)
    await call.message.answer("Введите название нового товара:")
    await call.answer()


@router.message(AdminProductCreate.waiting_name)
async def admin_product_name(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.update_data(new_prod_name=message.text.strip())
    await state.set_state(AdminProductCreate.waiting_volume)
    await message.answer("Введите объём (в литрах, например: 19 или 1.5):")


@router.message(AdminProductCreate.waiting_volume)
async def admin_product_volume(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    try:
        vol = float(message.text.strip().replace(",", "."))
    except ValueError:
        await message.answer("Введите число (например: 19 или 1.5).")
        return
    await state.update_data(new_prod_volume=vol)
    await state.set_state(AdminProductCreate.waiting_price)
    await message.answer("Введите цену (в сум):")


@router.message(AdminProductCreate.waiting_price)
async def admin_product_price(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    text = message.text.strip().replace(" ", "")
    if not text.isdigit():
        await message.answer("Введите числовую цену.")
        return
    await state.update_data(new_prod_price=int(text))
    await state.set_state(AdminProductCreate.waiting_type)
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💧 Без газа", callback_data="apc:still"),
         InlineKeyboardButton(text="🫧 Газированная", callback_data="apc:carbonated")],
    ])
    await message.answer("Выберите тип воды:", reply_markup=kb)


@router.callback_query(AdminProductCreate.waiting_type, F.data.startswith("apc:"))
async def admin_product_type(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    wtype = call.data.split(":")[1]
    type_label = "💧 Без газа" if wtype == "still" else "🫧 Газированная"
    await state.update_data(new_prod_type=wtype)
    await state.set_state(AdminProductCreate.waiting_photo)
    skip_kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="⏭ Пропустить", callback_data="apc:skip_photo")]
    ])
    # Edit the type-selection message in-place — replaces type buttons with photo prompt
    msg = await call.message.edit_text(
        f"Тип воды: {type_label}\n\nОтправьте фото товара или нажмите «Пропустить»:",
        reply_markup=skip_kb,
    )
    await state.update_data(photo_prompt_msg_id=msg.message_id if msg else None)
    await call.answer()


async def _download_and_upload_photo(message: Message) -> str | None:
    try:
        from io import BytesIO
        bio = BytesIO()
        await message.bot.download(message.photo[-1].file_id, destination=bio)
        return await api.upload_product_photo(bio.getvalue(), "product.jpg")
    except Exception:
        return None


async def _finish_product_create(bot_message, state: FSMContext, photo_url: str | None,
                                  prompt_text: str = ""):
    data = await state.get_data()
    await state.clear()
    payload = {
        "name": data["new_prod_name"],
        "volume": data["new_prod_volume"],
        "price": data["new_prod_price"],
        "type": data.get("new_prod_type", "still"),
        "is_active": True,
    }
    if photo_url:
        payload["photo_url"] = photo_url
    result = await api.create_product(payload)
    result_text = (
        f"✅ Товар создан!\n"
        f"Название: {result.get('name')}\n"
        f"Объём: {result.get('volume')} л | Цена: {fmt(result.get('price', 0))}"
    )
    # Edit the prompt message to show the final result (removes all buttons)
    try:
        await bot_message.edit_text(f"{prompt_text}{result_text}" if prompt_text else result_text)
    except Exception:
        await bot_message.answer(result_text)


@router.message(AdminProductCreate.waiting_photo, F.photo)
async def admin_product_photo_msg(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    photo_url = await _download_and_upload_photo(message)
    # Retrieve the bot's prompt message id to edit it
    data = await state.get_data()
    prompt_msg_id = data.get("photo_prompt_msg_id")
    if prompt_msg_id:
        try:
            from aiogram.types import InaccessibleMessage
            await message.bot.edit_message_text(
                chat_id=message.chat.id,
                message_id=prompt_msg_id,
                text="📷 Фото получено!",
            )
        except Exception:
            pass
    await state.update_data(photo_prompt_msg_id=None)
    # Build and send result
    data2 = await state.get_data()
    await state.clear()
    payload = {
        "name": data2["new_prod_name"],
        "volume": data2["new_prod_volume"],
        "price": data2["new_prod_price"],
        "type": data2.get("new_prod_type", "still"),
        "is_active": True,
    }
    if photo_url:
        payload["photo_url"] = photo_url
    result = await api.create_product(payload)
    await message.answer(
        f"✅ Товар создан!\n"
        f"Название: {result.get('name')}\n"
        f"Объём: {result.get('volume')} л | Цена: {fmt(result.get('price', 0))}"
    )


@router.callback_query(AdminProductCreate.waiting_photo, F.data == "apc:skip_photo")
async def admin_product_skip_photo(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    await _finish_product_create(call.message, state, None)
    await call.answer()


@router.callback_query(F.data.startswith("ape:"))
async def admin_product_edit_field(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    parts = call.data.split(":")
    field, pid = parts[1], int(parts[2])
    if field == "toggle":
        products = await api.get_products()
        p = next((x for x in products if x["id"] == pid), None)
        if p:
            new_val = not p.get("is_active", True)
            await api.update_product(pid, {"is_active": new_val})
            action = "активирован" if new_val else "деактивирован"
            await call.answer(f"Товар {action}")
            await call.message.edit_text(
                f"Товар {'активен ✅' if new_val else 'неактивен ❌'}",
                reply_markup=product_edit_kb(pid, has_deposit=p.get("has_bottle_deposit", False), deposit_price=p.get("deposit_price")),
            )
        return
    if field == "deposit":
        products = await api.get_products()
        p = next((x for x in products if x["id"] == pid), None)
        if p:
            new_val = not p.get("has_bottle_deposit", False)
            await api.update_product(pid, {"has_bottle_deposit": new_val})
            label = "включена ✅" if new_val else "выключена ❌"
            await call.answer(f"Залоговая цена {label}")
            await call.message.edit_text(
                f"Залоговая цена {'активна ✅' if new_val else 'неактивна ❌'}",
                reply_markup=product_edit_kb(pid, has_deposit=new_val, deposit_price=p.get("deposit_price")),
            )
        return
    if field == "deposit_price":
        await state.update_data(edit_product_id=pid, edit_product_field="deposit_price")
        await state.set_state(AdminProductEdit.waiting_value)
        await call.message.answer("Введите цену со сдачей бутылки (сум), например: 18000")
        await call.answer()
        return
    if field == "photo":
        await state.update_data(edit_product_id=pid)
        await state.set_state(AdminProductEdit.waiting_photo)
        await call.message.answer("Отправьте новое фото товара:")
        await call.answer()
        return
    prompts = {"name": "Введите новое название:", "volume": "Введите новый объём (литры):",
               "price": "Введите новую цену (сум):"}
    await state.update_data(edit_product_id=pid, edit_product_field=field)
    await state.set_state(AdminProductEdit.waiting_value)
    await call.message.answer(prompts.get(field, "Введите значение:"))
    await call.answer()


@router.message(AdminProductEdit.waiting_value)
async def admin_product_edit_value(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    data = await state.get_data()
    pid = data["edit_product_id"]
    field = data["edit_product_field"]
    raw = message.text.strip()
    if field in ("price", "deposit_price"):
        val = int(raw.replace(" ", ""))
    elif field == "volume":
        val = float(raw.replace(",", "."))
    else:
        val = raw
    await api.update_product(pid, {field: val})
    await state.clear()
    await message.answer(f"✅ Товар обновлён: {field} = {val}")


@router.message(AdminProductEdit.waiting_photo, F.photo)
async def admin_product_edit_photo(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    data = await state.get_data()
    pid = data["edit_product_id"]
    photo_url = await _download_and_upload_photo(message)
    await state.clear()
    if photo_url:
        await api.update_product(pid, {"photo_url": photo_url})
        await message.answer("✅ Фото товара обновлено!")
    else:
        await message.answer("❌ Не удалось загрузить фото. Попробуйте ещё раз.")


# ─── Back ─────────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "admin:back")
async def admin_back(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    try:
        await call.message.delete()
    except Exception:
        pass
    await call.answer()


# ─── Subscriptions management ─────────────────────────────────────────────────

import re as _re
from datetime import datetime as _dt


def _format_subs(subs: list, period: str) -> str:
    """Legacy helper kept for imports from manager/warehouse handlers."""
    DAYS_ORDER = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]
    label = "этой неделе" if period == "week" else "этому месяцу"
    if not subs:
        return f"📅 <b>Подписки по {label}:</b>\n\nНет активных подписок."
    by_day: dict[str, list] = {}
    for s in subs:
        day = s.get("day") or "Не указан"
        by_day.setdefault(day, []).append(s)
    lines = [f"📅 <b>Подписки на {label}:</b>\n"]
    sorted_days = sorted(by_day.keys(), key=lambda d: DAYS_ORDER.index(d) if d in DAYS_ORDER else 99)
    total = 0
    for day in sorted_days:
        day_subs = by_day[day]
        total += len(day_subs)
        lines.append(f"\n<b>{day}</b> — {len(day_subs)} подп.:")
        water_totals: dict[str, int] = {}
        for s in day_subs:
            for part in s.get("water_summary", "").split(","):
                part = part.strip()
                if not part:
                    continue
                m = _re.match(r"(.+?)\s*[x×]\s*(\d+)", part)
                name, qty = (m.group(1).strip(), int(m.group(2))) if m else (part, 1)
                water_totals[name] = water_totals.get(name, 0) + qty
        for name, qty in sorted(water_totals.items()):
            lines.append(f"  • {name} × {qty} шт.")
    lines.append(f"\n<b>Всего:</b> {total} активных подписок")
    return "\n".join(lines)


def _subs_summary_text(weekly: list, monthly: list) -> str:
    today_ru = ["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"][_dt.now().weekday()]
    due_today = [s for s in weekly if s.get("day") == today_ru]
    overdue = [s for s in weekly + monthly if s.get("overdue")]
    lines = [
        "📅 <b>Подписки на доставку</b>\n",
        f"Еженедельных: <b>{len(weekly)}</b> активных",
        f"  ⚡ Сегодня ({today_ru}): <b>{len(due_today)}</b>",
        f"\nЕжемесячных: <b>{len(monthly)}</b> активных",
    ]
    if overdue:
        lines.append(f"\n🔴 Просрочено: <b>{len(overdue)}</b> — нужна доставка!")
    return "\n".join(lines)


def _sub_card_text(s: dict) -> str:
    ndd = s.get("next_delivery_date")
    if ndd:
        try:
            d = _dt.fromisoformat(ndd)
            today = _dt.now().date()
            if d.date() < today:
                date_label = f"🔴 Просрочена ({d.strftime('%d.%m')})"
            elif d.date() == today:
                date_label = f"⚡ Сегодня ({d.strftime('%d.%m')})"
            else:
                date_label = f"📅 {d.strftime('%d.%m.%Y')}"
        except Exception:
            date_label = ndd[:10]
    else:
        date_label = "—"

    plan_label = "📅 Еженедельно" if s.get("plan") == "weekly" else "🗓 Ежемесячно"
    return (
        f"<b>{s.get('client_name', '—')}</b>\n"
        f"{plan_label} | {s.get('day', '—')}\n"
        f"💧 {s.get('water_summary', '—')}\n"
        f"📍 {s.get('address', '—')[:50]}\n"
        f"📞 {s.get('phone', '—')}\n"
        f"Следующая: {date_label}"
    )


async def _admin_subs_menu(message_or_call, is_call: bool = False):
    weekly = await api.get_admin_subscriptions(plan="weekly", status="active")
    monthly = await api.get_admin_subscriptions(plan="monthly", status="active")
    text = _subs_summary_text(weekly, monthly)
    kb = subs_menu_kb("admin", len(weekly), len(monthly))
    if is_call:
        try:
            await message_or_call.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
        except Exception:
            await message_or_call.message.answer(text, parse_mode="HTML", reply_markup=kb)
        await message_or_call.answer()
    else:
        await message_or_call.answer(text, parse_mode="HTML", reply_markup=kb)


@router.message(F.text == "📅 Подписки")
async def admin_subs_overview(message: Message):
    if not is_admin(message.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await message.answer("📅 Модуль подписок отключён в настройках администратора.")
        return
    await _admin_subs_menu(message, is_call=False)


@router.callback_query(F.data == "admin:subs:menu")
async def admin_subs_menu_cb(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.answer("Подписки отключены", show_alert=True)
        return
    await _admin_subs_menu(call, is_call=True)


@router.callback_query(F.data.startswith("admin:subs:weekly:") | F.data.startswith("admin:subs:monthly:"))
async def admin_subs_list(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.answer("Подписки отключены", show_alert=True)
        return
    parts = call.data.split(":")
    plan = parts[2]   # weekly | monthly
    page = int(parts[3])
    subs = await api.get_admin_subscriptions(plan=plan, status="active")

    # Sort: overdue first, then due today, then by next_delivery_date
    def _sort_key(s):
        if s.get("overdue"):
            return 0
        if s.get("due_today"):
            return 1
        return 2

    subs.sort(key=_sort_key)
    plan_label = "Еженедельные" if plan == "weekly" else "Ежемесячные"
    header = f"📋 <b>{plan_label} подписки ({len(subs)}):</b>\n\n"

    from keyboards.admin import subs_list_kb
    PAGE_SIZE = 5
    start = page * PAGE_SIZE
    chunk = subs[start:start + PAGE_SIZE]
    detail_lines = [f"{i + 1}. {_sub_card_text(s)}" for i, s in enumerate(chunk, start=start)]
    text = header + "\n\n".join(detail_lines) if chunk else header + "Нет активных подписок."

    kb = subs_list_kb("admin", subs, plan, page, can_create_order=True)
    try:
        await call.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
    except Exception:
        await call.message.answer(text, parse_mode="HTML", reply_markup=kb)
    await call.answer()


@router.callback_query(F.data.startswith("admin:sub_detail:"))
async def admin_sub_detail(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    sub_id = int(call.data.split(":")[2])
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🛒 Создать заказ", callback_data=f"admin:sub_order:{sub_id}")],
        [InlineKeyboardButton(text="↩️ Назад", callback_data="admin:subs:menu")],
    ])
    await call.answer()


@router.callback_query(F.data.startswith("admin:sub_order:"))
async def admin_sub_create_order(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    if not await api.is_subscriptions_enabled():
        await call.answer("Подписки отключены", show_alert=True)
        return
    sub_id = int(call.data.split(":")[2])
    try:
        result = await api.create_order_from_subscription(sub_id)
    except Exception as e:
        await call.answer(f"❌ Ошибка: {e}", show_alert=True)
        return

    order_id = result["order_id"]
    couriers = await api.get_couriers()
    kb = courier_select_kb(couriers, order_id)
    text = (
        f"✅ Заказ #{order_id} создан из подписки!\n\n"
        f"Клиент: {result.get('client_name', '—')}\n"
        f"Адрес: {result.get('address', '—')}\n"
        f"Товары: {result.get('items_text', '—')}\n"
        f"Сумма: {fmt(result.get('total', 0))}\n\n"
        f"Выберите курьера для назначения:"
    )
    try:
        await call.message.edit_text(text, parse_mode="HTML", reply_markup=kb)
    except Exception:
        await call.message.answer(text, parse_mode="HTML", reply_markup=kb)
    await call.answer()


# ─── Admin manual order creation ──────────────────────────────────────────────

class AdminOrderCreate(StatesGroup):
    waiting_input = State()
    choosing_product = State()
    waiting_bottles = State()
    waiting_lent_bottles = State()
    choosing_address = State()
    waiting_address = State()
    confirming = State()


def _aco_exch_price(p: dict) -> float:
    if p.get("has_bottle_deposit") and p.get("deposit_price"):
        return float(p["deposit_price"])
    return float(p.get("effective_price") or p.get("price") or 0)


def _aco_full_price(p: dict) -> float:
    return float(p.get("price") or 0)


def _aco_spc(products: list) -> float:
    for p in products:
        if p.get("has_bottle_deposit") and p.get("bottle_surcharge"):
            return float(p["bottle_surcharge"])
    for p in products:
        if p.get("has_bottle_deposit"):
            diff = _aco_full_price(p) - _aco_exch_price(p)
            if diff > 0:
                return diff
    return 0.0


def _aco_qty19(items: dict, products: list) -> int:
    prod_map = {str(p["id"]): p for p in products}
    return sum(qty for pid, qty in items.items() if prod_map.get(pid, {}).get("has_bottle_deposit"))


def _aco_calc_surcharge(items: dict, products: list, return_bottles: int, bottles_lent: int = 0) -> float:
    missing = max(0, _aco_qty19(items, products) - return_bottles - bottles_lent)
    return missing * _aco_spc(products)


def _aco_bottles_step_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🔄 Одолжить бутылки", callback_data="aco:lent_bottles")]
    ])


def _aco_client_addrs(client: dict | None) -> list:
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


def _aco_grid_kb(products: list, items: dict) -> InlineKeyboardMarkup:
    rows = []
    pair = []
    for p in products:
        if not p.get("is_active", True):
            continue
        pid = str(p["id"])
        qty = items.get(pid, 0)
        name = p.get("name", "?")
        label = f"✅ {name} ×{qty}" if qty > 0 else f"➕ {name}"
        pair.append(InlineKeyboardButton(text=label, callback_data=f"aco:cp:{pid}"))
        if len(pair) == 2:
            rows.append(pair)
            pair = []
    if pair:
        rows.append(pair)
    if items:
        total_qty = sum(items.values())
        prod_map = {str(p["id"]): p for p in products}
        total_price = sum(_aco_exch_price(prod_map[pid]) * qty for pid, qty in items.items() if pid in prod_map)
        rows.append([InlineKeyboardButton(
            text=f"▶ Далее  {total_qty} шт. · {fmt(total_price)}",
            callback_data="aco:done",
        )])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _aco_grid_text(items: dict, products: list) -> str:
    if not items:
        return "🛒 <b>Состав заказа</b>\n\nВыберите товары:"
    prod_map = {str(p["id"]): p for p in products}
    lines = ["🛒 <b>Состав заказа</b>", ""]
    total = 0
    for pid, qty in items.items():
        p = prod_map.get(pid, {})
        ep = _aco_exch_price(p)
        fp = _aco_full_price(p)
        s = ep * qty
        total += s
        dep = " ♻" if p.get("has_bottle_deposit") and ep < fp else ""
        lines.append(f"  • {p.get('name', pid)} {qty} шт. — {fmt(s)}{dep}")
    lines.append(f"\n<b>Итого: {fmt(total)}</b>")
    return "\n".join(lines)


def _aco_qty_kb(pid: str, qty: int) -> InlineKeyboardMarkup:
    rows = [
        [
            InlineKeyboardButton(text="➖", callback_data=f"aco:qd:{pid}:-1"),
            InlineKeyboardButton(text=f"{qty} шт.", callback_data="aco:noop"),
            InlineKeyboardButton(text="➕", callback_data=f"aco:qd:{pid}:1"),
        ],
        [
            InlineKeyboardButton(text="1", callback_data=f"aco:qs:{pid}:1"),
            InlineKeyboardButton(text="2", callback_data=f"aco:qs:{pid}:2"),
            InlineKeyboardButton(text="3", callback_data=f"aco:qs:{pid}:3"),
        ],
        [
            InlineKeyboardButton(text="5", callback_data=f"aco:qs:{pid}:5"),
            InlineKeyboardButton(text="10", callback_data=f"aco:qs:{pid}:10"),
            InlineKeyboardButton(text="20", callback_data=f"aco:qs:{pid}:20"),
        ],
    ]
    actions = []
    if qty > 0:
        actions.append(InlineKeyboardButton(text="🗑 Убрать", callback_data=f"aco:qremove:{pid}"))
    actions.append(InlineKeyboardButton(text="◀ Назад", callback_data="aco:back_catalog"))
    rows.append(actions)
    return InlineKeyboardMarkup(inline_keyboard=rows)


def _aco_qty_text(pid: str, products: list, items: dict) -> str:
    p = next((x for x in products if str(x["id"]) == pid), {})
    ep = _aco_exch_price(p)
    fp = _aco_full_price(p)
    qty = items.get(pid, 0)
    vol = p.get("volume", "")
    vol_str = f" {vol}л" if vol else ""
    dep_hint = f"\n<i>♻ Цена с обменом. Без обмена: {fmt(fp)}</i>" if p.get("has_bottle_deposit") and ep < fp else ""
    lines = [f"<b>{p.get('name', '?')}{vol_str}</b>", f"💵 {fmt(ep)} за шт.{dep_hint}"]
    if qty > 0:
        lines.append(f"\n📦 В заказе: {qty} шт. — {fmt(ep * qty)}")
    lines.append("\nВыберите количество:")
    return "\n".join(lines)


def _aco_confirm_text(data: dict, products: list) -> str:
    client = data.get("aco_client")
    phone = data.get("aco_phone", "—")
    address = data.get("aco_address", "—")
    items = data.get("aco_items", {})
    return_bottles = data.get("aco_return_bottles", 0)
    lent_bottles = data.get("aco_lent_bottles", 0)
    prod_map = {str(p["id"]): p for p in products}
    surcharge = _aco_calc_surcharge(items, products, return_bottles, lent_bottles)

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
        ep = _aco_exch_price(p)
        fp = _aco_full_price(p)
        s = ep * qty
        total += s
        dep = " ♻" if p.get("has_bottle_deposit") and ep < fp else ""
        lines.append(f"  • {p.get('name', pid)} {qty} шт. — {fmt(s)}{dep}")

    if return_bottles > 0:
        lines.append(f"\n♻️ Возврат: {return_bottles} шт.")
    if lent_bottles > 0:
        lines.append(f"🔄 Одолжено: {lent_bottles} шт.")
    if surcharge > 0:
        missing = max(0, _aco_qty19(items, products) - return_bottles - lent_bottles)
        lines.append(f"🫙 Надбавка за невозврат {missing} бут.: +{fmt(surcharge)}")
        total += surcharge

    lines.append(f"\n<b>Итого: {fmt(total)}</b>")
    return "\n".join(lines)


def _aco_confirm_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✏️ Состав", callback_data="aco:edit:items"),
            InlineKeyboardButton(text="♻️ Возврат", callback_data="aco:edit:bottles"),
            InlineKeyboardButton(text="📍 Адрес", callback_data="aco:edit:address"),
        ],
        [InlineKeyboardButton(text="✅ Создать заказ", callback_data="aco:confirm")],
        [InlineKeyboardButton(text="❌ Отмена", callback_data="aco:cancel")],
    ])


def _aco_addr_kb(options: list) -> InlineKeyboardMarkup:
    rows = [
        [InlineKeyboardButton(text=f"📍 {addr[:45]}", callback_data=f"aco:adr:{i}")]
        for i, addr in enumerate(options)
    ]
    rows.append([InlineKeyboardButton(text="✏️ Другой адрес", callback_data="aco:adr:custom")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


async def _aco_show_addr(target, state: FSMContext):
    data = await state.get_data()
    options = data.get("aco_addr_options", [])
    if options:
        await state.set_state(AdminOrderCreate.choosing_address)
        text = "📍 Выберите адрес доставки:"
        if isinstance(target, CallbackQuery):
            await target.message.edit_text(text, reply_markup=_aco_addr_kb(options))
        else:
            await target.answer(text, reply_markup=_aco_addr_kb(options))
    else:
        await state.set_state(AdminOrderCreate.waiting_address)
        text = "📍 Введите адрес доставки:"
        if isinstance(target, CallbackQuery):
            await target.message.edit_text(text)
        else:
            await target.answer(text)


async def _aco_show_confirm(target, state: FSMContext):
    data = await state.get_data()
    products = data.get("aco_products", [])
    text = _aco_confirm_text(data, products)
    kb = _aco_confirm_kb()
    await state.set_state(AdminOrderCreate.confirming)
    if isinstance(target, CallbackQuery):
        await target.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
    else:
        await target.answer(text, reply_markup=kb, parse_mode="HTML")


@router.message(F.text == "📝 Создать заказ")
async def admin_create_order_start(message: Message, state: FSMContext):
    await state.update_data(aco_items={})
    await state.set_state(AdminOrderCreate.waiting_input)
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


@router.message(AdminOrderCreate.waiting_input)
async def admin_co_input(message: Message, state: FSMContext):
    text = message.text.strip()
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    products = await api.get_products()
    products = [p for p in products if p.get("is_active", True)]

    if len(lines) >= 3:
        try:
            qty = int(lines[0])
        except ValueError:
            await message.answer("❌ Первая строка должна быть числом (количество бутылей).\nПопробуйте ещё раз.")
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
        for a in _aco_client_addrs(client):
            if a not in addr_options:
                addr_options.append(a)

        await state.update_data(
            aco_phone=phone,
            aco_products=products,
            aco_items=items,
            aco_client=client,
            aco_return_bottles=return_bottles,
            aco_addr_options=addr_options,
            aco_edit_mode=False,
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
        await _aco_show_addr(message, state)

    else:
        phone = text
        if sum(1 for c in phone if c.isdigit()) < 9:
            await message.answer("❌ Неверный номер телефона — введите минимум 9 цифр.\nПопробуйте ещё раз.")
            return
        client = await api.lookup_user_by_phone(phone)

        await state.update_data(
            aco_phone=phone,
            aco_products=products,
            aco_items={},
            aco_client=client,
            aco_addr_options=_aco_client_addrs(client),
            aco_edit_mode=False,
        )
        await state.set_state(AdminOrderCreate.choosing_product)

        if client:
            bottles_owed = client.get("bottles_owed", 0)
            pending = client.get("pending_return", 0)
            available = client.get("available_bottles", bottles_owed)
            if bottles_owed > 0:
                if pending > 0:
                    bottle_line = f"\n🫙 Долг: {bottles_owed} бут. | В процессе: {pending} | Доступно: {available}"
                else:
                    bottle_line = f"\n🫙 Долг по бутылкам: {bottles_owed} шт."
            else:
                bottle_line = ""
            _cn = client.get('name') or (client.get('order_addresses') or [{}])[0].get('address', '—')
            info = f"✅ Клиент найден: {_cn} | {client.get('phone', phone)}{bottle_line}"
        else:
            info = "ℹ️ Клиент не найден — заказ создастся по номеру телефона"

        await message.answer(
            f"{info}\n\n{_aco_grid_text({}, products)}",
            reply_markup=_aco_grid_kb(products, {}),
            parse_mode="HTML",
        )


@router.callback_query(AdminOrderCreate.choosing_product, F.data == "aco:noop")
async def admin_co_catalog_noop(call: CallbackQuery):
    await call.answer()


@router.callback_query(AdminOrderCreate.choosing_product, F.data.startswith("aco:cp:"))
async def admin_co_pick_product(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":", 2)[2]
    data = await state.get_data()
    products = data.get("aco_products", [])
    items = data.get("aco_items", {})
    await call.message.edit_text(
        _aco_qty_text(pid, products, items),
        reply_markup=_aco_qty_kb(pid, items.get(pid, 0)),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(AdminOrderCreate.choosing_product, F.data.startswith("aco:qd:"))
async def admin_co_qty_delta(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    pid, delta = parts[2], int(parts[3])
    data = await state.get_data()
    items = dict(data.get("aco_items", {}))
    new_qty = max(0, items.get(pid, 0) + delta)
    if new_qty == 0:
        items.pop(pid, None)
    else:
        items[pid] = new_qty
    await state.update_data(aco_items=items)
    products = data.get("aco_products", [])
    await call.message.edit_text(
        _aco_qty_text(pid, products, items),
        reply_markup=_aco_qty_kb(pid, new_qty),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(AdminOrderCreate.choosing_product, F.data.startswith("aco:qs:"))
async def admin_co_qty_set(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    pid, qty = parts[2], int(parts[3])
    data = await state.get_data()
    items = dict(data.get("aco_items", {}))
    if qty == 0:
        items.pop(pid, None)
    else:
        items[pid] = qty
    await state.update_data(aco_items=items)
    products = data.get("aco_products", [])
    await call.message.edit_text(
        _aco_qty_text(pid, products, items),
        reply_markup=_aco_qty_kb(pid, qty),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(AdminOrderCreate.choosing_product, F.data.startswith("aco:qremove:"))
async def admin_co_qty_remove(call: CallbackQuery, state: FSMContext):
    pid = call.data.split(":", 2)[2]
    data = await state.get_data()
    items = dict(data.get("aco_items", {}))
    items.pop(pid, None)
    await state.update_data(aco_items=items)
    products = data.get("aco_products", [])
    await call.message.edit_text(
        _aco_grid_text(items, products),
        reply_markup=_aco_grid_kb(products, items),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(AdminOrderCreate.choosing_product, F.data == "aco:back_catalog")
async def admin_co_back_catalog(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    products = data.get("aco_products", [])
    items = data.get("aco_items", {})
    await call.message.edit_text(
        _aco_grid_text(items, products),
        reply_markup=_aco_grid_kb(products, items),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(AdminOrderCreate.choosing_product, F.data == "aco:done")
async def admin_co_items_done(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    if not data.get("aco_items"):
        await call.answer("Добавьте хотя бы один товар!")
        return
    items = data.get("aco_items", {})
    products = data.get("aco_products", [])
    prod_map = {str(p["id"]): p for p in products}
    has_deposit = any(prod_map.get(pid, {}).get("has_bottle_deposit") for pid in items)

    if data.get("aco_edit_mode"):
        await call.answer()
        await _aco_show_confirm(call, state)
        return

    if has_deposit:
        await state.set_state(AdminOrderCreate.waiting_bottles)
        await call.message.edit_text(
            "🪣 Сколько пустых бутылей вернёт клиент?\nВведите число (0 — если не возвращает):",
            reply_markup=_aco_bottles_step_kb(),
        )
    else:
        await state.update_data(aco_return_bottles=0)
        await _aco_show_addr(call, state)
    await call.answer()


@router.message(AdminOrderCreate.waiting_bottles)
async def admin_co_bottles(message: Message, state: FSMContext):
    try:
        count = max(0, int(message.text.strip()))
    except ValueError:
        await message.answer("Введите число, например: 0, 1, 2")
        return
    await state.update_data(aco_return_bottles=count)
    data = await state.get_data()
    if data.get("aco_edit_mode"):
        await _aco_show_confirm(message, state)
    else:
        await _aco_show_addr(message, state)


@router.callback_query(AdminOrderCreate.waiting_bottles, F.data == "aco:lent_bottles")
async def admin_co_lent_tap(call: CallbackQuery, state: FSMContext):
    await call.answer()
    await state.set_state(AdminOrderCreate.waiting_lent_bottles)
    await call.message.edit_text("🔄 Сколько бутылок одолжить клиенту?\nВведите число:")


@router.message(AdminOrderCreate.waiting_lent_bottles)
async def admin_co_lent_bottles(message: Message, state: FSMContext):
    try:
        count = max(0, int(message.text.strip()))
    except ValueError:
        await message.answer("Введите число, например: 1, 2, 3")
        return
    await state.update_data(aco_lent_bottles=count)
    data = await state.get_data()
    if data.get("aco_edit_mode"):
        await _aco_show_confirm(message, state)
    else:
        await _aco_show_addr(message, state)


@router.callback_query(AdminOrderCreate.choosing_address, F.data.startswith("aco:adr:"))
async def admin_co_select_addr(call: CallbackQuery, state: FSMContext):
    idx_str = call.data.split(":", 2)[2]
    if idx_str == "custom":
        await state.set_state(AdminOrderCreate.waiting_address)
        await call.message.edit_text("📍 Введите адрес доставки:")
        await call.answer()
        return
    data = await state.get_data()
    options = data.get("aco_addr_options", [])
    try:
        addr = options[int(idx_str)]
    except (ValueError, IndexError):
        await call.answer("Ошибка выбора")
        return
    await state.update_data(aco_address=addr)
    await call.answer()
    await _aco_show_confirm(call, state)


@router.message(AdminOrderCreate.waiting_address)
async def admin_co_address(message: Message, state: FSMContext):
    await state.update_data(aco_address=message.text.strip())
    await _aco_show_confirm(message, state)


@router.callback_query(AdminOrderCreate.confirming, F.data == "aco:edit:items")
async def admin_co_edit_items(call: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    products = data.get("aco_products", [])
    items = data.get("aco_items", {})
    await state.update_data(aco_edit_mode=True)
    await state.set_state(AdminOrderCreate.choosing_product)
    await call.message.edit_text(
        _aco_grid_text(items, products),
        reply_markup=_aco_grid_kb(products, items),
        parse_mode="HTML",
    )
    await call.answer()


@router.callback_query(AdminOrderCreate.confirming, F.data == "aco:edit:bottles")
async def admin_co_edit_bottles(call: CallbackQuery, state: FSMContext):
    await state.update_data(aco_edit_mode=True)
    await state.set_state(AdminOrderCreate.waiting_bottles)
    await call.message.edit_text(
        "🪣 Сколько пустых бутылей вернёт клиент?\nВведите число (0 — если не возвращает):",
        reply_markup=_aco_bottles_step_kb(),
    )
    await call.answer()


@router.callback_query(AdminOrderCreate.confirming, F.data == "aco:edit:address")
async def admin_co_edit_address(call: CallbackQuery, state: FSMContext):
    await state.update_data(aco_edit_mode=True)
    await call.answer()
    await _aco_show_addr(call, state)


@router.callback_query(AdminOrderCreate.confirming, F.data == "aco:confirm")
async def admin_co_confirm(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    data = await state.get_data()
    items_list = [{"product_id": int(pid), "quantity": qty} for pid, qty in data["aco_items"].items()]
    products = data.get("aco_products", [])
    return_bottles = data.get("aco_return_bottles", 0)
    lent_bottles = data.get("aco_lent_bottles", 0)
    surcharge = _aco_calc_surcharge(data["aco_items"], products, return_bottles, lent_bottles)
    try:
        result = await api.courier_create_order({
            "phone": data["aco_phone"],
            "address": data["aco_address"],
            "items": items_list,
            "payment_method": "cash",
            "return_bottles_count": return_bottles,
            "bottles_lent": lent_bottles,
            "bottle_surcharge": surcharge,
            "creator_role": "admin",
            "creator_name": call.from_user.full_name or "",
        })
        oid = result.get("order_id") or result.get("id", "?")
    except Exception:
        await call.message.edit_text("❌ Ошибка при создании заказа. Попробуйте ещё раз.")
        await state.clear()
        await call.answer()
        return

    await state.clear()
    await call.answer()
    sent = await call.message.edit_text(f"✅ Заказ #{oid} создан!")
    subs_on = await api.is_subscriptions_enabled()
    await call.message.answer("Панель администратора:", reply_markup=admin_menu_kb(subs_enabled=subs_on))
    await asyncio.sleep(2)
    try:
        await sent.delete()
    except Exception:
        pass


@router.callback_query(AdminOrderCreate.confirming, F.data == "aco:cancel")
async def admin_co_cancel(call: CallbackQuery, state: FSMContext):
    await state.clear()
    await call.message.edit_text("Заказ отменён.")
    subs_on = await api.is_subscriptions_enabled()
    await call.message.answer("Панель администратора:", reply_markup=admin_menu_kb(subs_enabled=subs_on))
    await call.answer()
