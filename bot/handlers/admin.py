from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
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


def fmt(v):
    return f"{int(v):,}".replace(",", " ") + " сум"


def is_admin(uid: int) -> bool:
    return uid in settings.ADMIN_IDS


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
        f"👤 {o.get('client_name', '—')}  |  {o.get('recipient_phone', '—')}",
        f"📍 {o.get('address', '—')}",
    ]
    if o.get("extra_info"):
        lines.append(f"ℹ️ {o['extra_info']}")
    delivery_fee = o.get('delivery_fee') or 0
    delivery_part = f" (вкл. доставку {fmt(delivery_fee)})" if delivery_fee > 0 else ""
    bonus_used = float(o.get('bonus_used') or 0)
    bonus_part = f"\n💎 Бонусная скидка: −{fmt(int(bonus_used))}" if bonus_used > 0 else ""
    return_count = o.get("return_bottles_count") or 0
    return_line = f"\n♻️ Возврат бутылок: {return_count} шт." if return_count > 0 else ""
    lines += [f"\nТовары:\n{items_text}", f"💰 {fmt(o['total'])}{delivery_part}  |  {pay}{bonus_part}{return_line}"]
    if o.get("courier_name"):
        cp = o.get("courier_phone", "")
        lines.append(f"🚴 {o['courier_name']}{f'  |  {cp}' if cp else ''}")
    return "\n".join(lines)


async def _notify_order_staff(bot, caller_id: int, text: str):
    """Notify all admins+managers about an order action, skipping the caller to avoid duplicate."""
    recipients: set[int] = set(settings.ADMIN_IDS)
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
            await bot.send_message(uid, text, parse_mode="HTML")
        except Exception:
            pass


@router.message(F.text == "📋 Заказы")
async def admin_text_orders(message: Message):
    if not is_admin(message.from_user.id):
        return
    orders = await api.get_all_orders()
    active = [o for o in orders if o.get("status") not in ("delivered", "rejected")]

    subs_on = await api.is_subscriptions_enabled()
    if subs_on:
        # Pending subscriptions (awaiting admin confirmation)
        pending_subs = await api.get_admin_subscriptions(status="pending")
        # Active subscriptions due today or overdue (need order creation)
        active_subs = await api.get_admin_subscriptions(status="active")
        due_subs = [s for s in active_subs if s.get("due_today") or s.get("overdue")]
    else:
        pending_subs = []
        due_subs = []

    if not active and not pending_subs and not due_subs:
        msg = "Нет активных заказов и подписок." if subs_on else "Нет активных заказов."
        await message.answer(msg)
        return

    for o in active[:15]:
        try:
            await message.answer(_admin_order_text(o), reply_markup=_admin_order_kb(o), parse_mode="HTML")
        except Exception as e:
            await message.answer(f"Заказ #{o.get('id','?')}: ошибка — {e}")

    for s in pending_subs[:5]:
        try:
            sub_id = s["id"]
            text = (
                f"📅 <b>Подписка #{sub_id} — ожидает подтверждения</b>\n"
                f"Клиент: {s.get('client_name') or '—'}\n"
                f"Адрес: {s.get('address') or '—'}\n"
                f"Тариф: {s.get('plan') or '—'}"
            )
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"admin_sub_confirm:{sub_id}"),
                InlineKeyboardButton(text="❌ Отклонить", callback_data=f"admin_sub_reject:{sub_id}"),
            ]])
            await message.answer(text, reply_markup=kb, parse_mode="HTML")
        except Exception:
            pass

    for s in due_subs[:5]:
        try:
            sub_id = s["id"]
            marker = "🔴 Просрочена" if s.get("overdue") else "📅 Сегодня"
            text = (
                f"📅 <b>Подписка #{sub_id} — {marker}</b>\n"
                f"Клиент: {s.get('client_name') or '—'}\n"
                f"Адрес: {s.get('address') or '—'}\n"
                f"Тариф: {s.get('plan') or '—'}"
            )
            kb = InlineKeyboardMarkup(inline_keyboard=[[
                InlineKeyboardButton(text="🛒 Создать заказ", callback_data=f"admin:sub_order:{sub_id}"),
            ]])
            await message.answer(text, reply_markup=kb, parse_mode="HTML")
        except Exception:
            pass


@router.message(F.text == "⏳ Новые заказы")
async def admin_text_pending(message: Message):
    if not is_admin(message.from_user.id):
        return
    orders = await api.get_all_orders(status="awaiting_confirmation")
    if not orders:
        await message.answer("Нет заказов, ожидающих подтверждения.")
        return
    for o in orders[:5]:
        items_text = "\n".join(f"  • {i['product_name']} {i['quantity']} шт." for i in o.get("items", []))
        text = (
            f"📦 <b>Новый заказ</b>\n"
            f"Клиент: {o.get('client_name', '—')}\n"
            f"Телефон: {o.get('recipient_phone', '—')}\n"
            f"Адрес: {o['address']}\n"
            f"Товары:\n{items_text}\n"
            f"Сумма: {fmt(o['total'])}\n"
            f"Оплата: {PAY_RU.get(o.get('payment_method', ''), '—')}\n"
            f"Возврат бутылок: {o.get('return_bottles_count', 0)} шт."
        )
        await message.answer(text, reply_markup=order_confirm_kb(o["id"]), parse_mode="HTML")


@router.message(F.text == "📊 Статистика", F.from_user.id.in_(settings.ADMIN_IDS))
async def admin_text_stats(message: Message):
    await message.answer("Выберите период:", reply_markup=stats_period_kb())


@router.message(F.text == "🚴 Курьеры")
async def admin_text_couriers(message: Message):
    if not is_admin(message.from_user.id):
        return
    couriers = await api.get_couriers()
    if not couriers:
        await message.answer("Нет курьеров.")
        return
    lines = ["🚴 <b>Курьеры:</b>\n"]
    for c in couriers:
        active = "✅" if c.get("is_active") else "❌"
        lines.append(f"{active} {c['name']} | tg: {c['telegram_id']} | {c.get('total_deliveries', 0)} доставок")
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Добавить курьера", callback_data="admin:courier_create")],
    ])
    await message.answer("\n".join(lines), reply_markup=kb, parse_mode="HTML")


@router.message(F.text == "👥 Клиенты")
async def admin_text_users(message: Message):
    if not is_admin(message.from_user.id):
        return
    users = await api.get_all_users()
    registered = [u for u in users if u.get("is_registered")]
    lines = [f"👥 <b>Клиенты: {len(registered)} зарегистрировано</b>\n"]
    for u in registered[:15]:
        lines.append(f"• {u.get('name', '—')} | {u.get('phone', '—')}")
    await message.answer("\n".join(lines), parse_mode="HTML")


@router.message(F.text == "🏭 Склад")
async def admin_text_warehouse(message: Message):
    if not is_admin(message.from_user.id):
        return
    stock = await api.get_warehouse_stock()
    lines = ["📦 <b>Склад:</b>\n"]
    if stock:
        for item in stock:
            qty = item.get("quantity", 0)
            warn = " ⚠️" if qty < 10 else ""
            lines.append(f"• {item['product_name']} ({item.get('volume', '')}л) — <b>{qty}</b> шт.{warn}")
    else:
        lines.append("Нет данных.")
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Записать производство", callback_data="admin:wh:prod")],
        [InlineKeyboardButton(text="👤 Добавить завсклада", callback_data="admin:wh:add_staff")],
        [InlineKeyboardButton(text="👥 Список завсклада", callback_data="admin:wh:list_staff")],
        [InlineKeyboardButton(text="🌐 Склад на сайте", url=_site("/admin/warehouse"))],
    ])
    await message.answer("\n".join(lines), reply_markup=kb, parse_mode="HTML")


@router.message(F.text == "📦 Товары")
async def admin_text_products(message: Message):
    if not is_admin(message.from_user.id):
        return
    products = await api.get_products()
    if not products:
        from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="➕ Добавить товар", callback_data="ap:new")],
        ])
        await message.answer("Товаров нет.", reply_markup=kb)
        return
    await message.answer("📦 <b>Товары:</b>", reply_markup=product_list_kb(products), parse_mode="HTML")


@router.message(F.text == "🧑‍💼 Менеджеры")
async def admin_text_managers(message: Message):
    if not is_admin(message.from_user.id):
        return
    managers = await api.get_managers()
    lines = ["🧑‍💼 <b>Менеджеры:</b>\n"]
    for m in managers:
        active = "✅" if m.get("is_active") else "❌"
        lines.append(f"{active} {m['name']} | tg: {m['telegram_id']} | {m.get('phone', '—')}")
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Добавить менеджера", callback_data="admin:mgr_create")],
    ])
    await message.answer(
        "\n".join(lines) if managers else "Менеджеров нет.",
        reply_markup=kb, parse_mode="HTML",
    )


@router.message(F.text == "📣 Рассылка")
async def admin_text_broadcast(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.set_state(AdminBroadcast.waiting_text)
    await message.answer("Введите текст рассылки:")


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


@router.callback_query(F.data.startswith("admin:cancel_order:"))
async def admin_cancel_order_cb(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    await api.reject_order(order_id, "Отменён администратором", from_bot=True)
    order = await api.get_order(order_id)
    await call.message.edit_text(_admin_order_text(order), reply_markup=_admin_order_kb(order), parse_mode="HTML")
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
        await api.reject_order(order_id, reason, from_bot=True)
    except Exception as e:
        await state.clear()
        if "409" in str(e):
            await message.answer("Заказ уже обработан другим администратором.")
        else:
            await message.answer("❌ Ошибка при отклонении заказа.")
        return
    order = await api.get_order(order_id)
    await state.clear()
    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            await message.bot.send_message(
                client_tg,
                f"❌ Ваш заказ #{order_id} отклонён.\nПричина: {reason}"
            )
        except Exception:
            pass
    await message.answer(f"❌ Заказ #{order_id} отклонён. Причина: {reason}")


@router.callback_query(F.data.startswith("admin:set_courier:"))
async def admin_set_courier(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    parts = call.data.split(":")
    order_id, courier_id = int(parts[2]), int(parts[3])
    assign_result = {}
    try:
        assign_result = await api.assign_courier(order_id, courier_id, from_bot=True, manager_telegram_id=call.from_user.id) or {}
    except Exception:
        await call.answer("❌ Не удалось назначить курьера. Попробуйте ещё раз.", show_alert=True)
        return
    order = await api.get_order(order_id)
    couriers = await api.get_couriers()
    courier = next((c for c in couriers if c["id"] == courier_id), None)
    courier_notified = False
    client_notified = False
    courier_err = ""
    client_err = ""

    if courier and courier.get("telegram_id"):
        try:
            await call.bot.send_message(
                courier["telegram_id"],
                "🚴 Вам назначен новый заказ!\n\n" + courier_assignment_text(order),
                reply_markup=courier_assignment_kb(order_id, order),
                parse_mode="HTML",
            )
            courier_notified = True
        except Exception as e:
            courier_err = str(e)
    elif not courier:
        courier_err = "курьер не найден"
    elif not courier.get("telegram_id"):
        courier_err = "нет telegram_id у курьера"

    client_tg = order.get("client_telegram_id")
    if client_tg:
        try:
            courier_name = courier["name"] if courier else "Курьер"
            courier_phone = courier.get("phone", "") if courier else ""
            phone_line = f"\nТелефон курьера: {courier_phone}" if _is_phone(courier_phone) else ""
            await call.bot.send_message(
                client_tg,
                f"🚴 Курьер {courier_name} назначен на ваш заказ!\nОжидайте доставку.{phone_line}",
            )
            client_notified = True
        except Exception as e:
            client_err = str(e)
    else:
        client_err = "нет telegram_id у клиента"

    courier_name = courier["name"] if courier else "?"
    courier_phone = courier.get("phone", "") if courier else ""
    phone_line = f"  |  {courier_phone}" if _is_phone(courier_phone) else ""
    body = _order_detail_lines(order)
    result_text = f"✅ <b>Курьер {courier_name} назначен</b>{phone_line}\n\n{body}"
    try:
        await call.message.edit_text(result_text, parse_mode="HTML")
    except Exception:
        await call.message.answer(result_text, parse_mode="HTML")
    await _notify_order_staff(call.bot, call.from_user.id, result_text)
    await call.answer()


@router.callback_query(F.data.startswith("admin:assign:"))
async def admin_assign(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    couriers = await api.get_couriers()
    await call.message.edit_text(
        f"Выберите курьера для заказа #{order_id}:",
        reply_markup=courier_select_kb(couriers, order_id),
    )
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
