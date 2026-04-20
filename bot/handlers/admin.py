from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.admin import (
    admin_menu_kb, order_confirm_kb, courier_select_kb,
    stats_period_kb, admin_user_kb, admin_debt_kb, broadcast_target_kb,
    product_list_kb, product_edit_kb,
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

class AdminManualTopup(StatesGroup):
    waiting_amount = State()

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

class AdminProductEdit(StatesGroup):
    waiting_value = State()


# ─── Entry ────────────────────────────────────────────────────────────────────

@router.message(Command("admin"))
async def admin_panel(message: Message):
    if not is_admin(message.from_user.id):
        return
    await message.answer("🔧 Панель администратора:", reply_markup=admin_menu_kb())


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
        await call.message.edit_text("Заказов нет.", reply_markup=admin_menu_kb())
        await call.answer()
        return
    lines = ["📋 <b>Все заказы (последние 20):</b>\n"]
    for o in orders[:20]:
        st = STATUS_RU.get(o["status"], o["status"])
        lines.append(f"#{o['id']} {st} — {fmt(o['total'])} — {o['address'][:25]}")
    await call.message.edit_text("\n".join(lines), reply_markup=admin_menu_kb(), parse_mode="HTML")
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
        await call.message.answer(text, reply_markup=order_confirm_kb(o["id"]), parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("admin:confirm:"))
async def admin_confirm(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    order_id = int(call.data.split(":")[2])
    try:
        await api.confirm_order(order_id, from_bot=True)
    except Exception:
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
    kb = courier_select_kb(couriers, order_id)
    try:
        await call.message.edit_text(
            f"✅ Заказ #{order_id} подтверждён!\n\nВыберите курьера:",
            reply_markup=kb,
        )
    except Exception:
        await call.message.answer(
            f"✅ Заказ #{order_id} подтверждён!\n\nВыберите курьера:",
            reply_markup=kb,
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
    reason = message.text.strip()
    await api.reject_order(order_id, reason, from_bot=True)
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
    try:
        await api.assign_courier(order_id, courier_id, from_bot=True)
    except Exception:
        await call.answer("❌ Не удалось назначить курьера. Попробуйте ещё раз.", show_alert=True)
        return
    order = await api.get_order(order_id)
    couriers = await api.get_couriers()
    courier = next((c for c in couriers if c["id"] == courier_id), None)
    if courier:
        items_text = "\n".join(f"  • {i['product_name']} ×{i['quantity']}" for i in order.get("items", []))
        if courier.get("telegram_id"):
            try:
                from keyboards.courier import courier_order_kb
                await call.bot.send_message(
                    courier["telegram_id"],
                    f"🚴 Вам назначен заказ #{order_id}!\n\n"
                    f"Адрес: {order.get('address','—')}\nТелефон: {order.get('recipient_phone','—')}\n"
                    f"Товары:\n{items_text}\n"
                    f"Сумма: {fmt(order.get('total',0))}\n"
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
    result_text = f"✅ Курьер {'«' + courier['name'] + '»' if courier else ''} назначен на заказ #{order_id}."
    try:
        await call.message.edit_text(result_text)
    except Exception:
        await call.message.answer(result_text)
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
    await call.message.edit_text(text, reply_markup=admin_menu_kb(), parse_mode="HTML")
    await call.answer()


# ─── Couriers ─────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "admin:couriers")
async def admin_couriers(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    couriers = await api.get_couriers()
    if not couriers:
        await call.message.edit_text("Нет курьеров.", reply_markup=admin_menu_kb())
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
    await state.update_data(new_courier_tg=int(message.text.strip()))
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
        lines.append(f"• {u.get('name', '—')} | {u.get('phone', '—')} | {fmt(u.get('balance', 0))}")
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="← Назад", callback_data="admin:back")],
    ])
    await call.message.edit_text("\n".join(lines), reply_markup=kb, parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("admin:topup_manual:"))
async def admin_topup_manual_start(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    user_id = int(call.data.split(":")[2])
    await state.update_data(topup_uid=user_id)
    await state.set_state(AdminManualTopup.waiting_amount)
    await call.message.answer(f"Введите сумму пополнения для клиента ID {user_id}:")
    await call.answer()


@router.message(AdminManualTopup.waiting_amount)
async def admin_topup_manual_amount(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    text = message.text.strip().replace(" ", "")
    if not text.isdigit() or int(text) <= 0:
        await message.answer("Введите корректную сумму.")
        return
    amount = int(text)
    data = await state.get_data()
    result = await api.topup_user(data["topup_uid"], amount)
    await state.clear()
    await message.answer(f"✅ Баланс пополнен на {fmt(amount)}. Новый: {fmt(result.get('new_balance', 0))}")


@router.callback_query(F.data.startswith("admin_topup_confirm:"))
async def admin_topup_confirm(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    parts = call.data.split(":")
    user_id, amount, tg_id = int(parts[1]), int(parts[2]), int(parts[3]) if len(parts) > 3 else None
    result = await api.topup_user(user_id, amount)
    new_balance = result.get("new_balance", 0)
    await call.message.edit_text(
        f"✅ Баланс пополнен на {fmt(amount)}.\nНовый баланс: {fmt(new_balance)}"
    )
    if tg_id:
        try:
            await call.bot.send_message(
                tg_id,
                f"✅ Ваш баланс пополнен на {fmt(amount)}!\nТекущий баланс: {fmt(new_balance)}"
            )
        except Exception:
            pass
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
    await state.update_data(new_mgr_tg=int(message.text.strip()))
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


# ─── Cash debts ───────────────────────────────────────────────────────────────

@router.callback_query(F.data == "admin:cash_debts")
async def admin_cash_debts(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    debts = await api.get_cash_debts_admin(status="requested")
    if not debts:
        await call.message.edit_text("Нет запросов на погашение долгов.", reply_markup=admin_menu_kb())
        await call.answer()
        return
    couriers = await api.get_couriers()
    courier_map = {c["id"]: c for c in couriers}
    for d in debts[:10]:
        c = courier_map.get(d.get("courier_id"), {})
        courier_name = c.get("name") or f"ID {d.get('courier_id')}"
        text = (
            f"💸 <b>Долг курьера</b>\n"
            f"Курьер: {courier_name}\n"
            f"Сумма: {fmt(d['amount'])}\n"
            f"Заказ: #{d.get('order_id') or '—'}\n"
            f"Заметка: {d.get('note') or '—'}"
        )
        await call.message.answer(text, reply_markup=admin_debt_kb(d["id"]), parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("admin:debt:"))
async def admin_debt_decide(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    parts = call.data.split(":")
    action, debt_id = parts[2], int(parts[3])
    debts_all = await api.get_cash_debts_admin()
    debt = next((d for d in debts_all if d["id"] == debt_id), None)
    await api.decide_cash_debt(debt_id, action)
    label = "✅ Одобрено" if action == "approve" else "❌ Отклонено"
    await call.message.edit_text(f"{label}: долг #{debt_id}")
    # Notify courier
    if debt:
        couriers = await api.get_couriers()
        c = next((x for x in couriers if x["id"] == debt.get("courier_id")), None)
        if c and c.get("telegram_id"):
            msg = (f"✅ Ваш запрос на погашение долга одобрен! Сумма: {fmt(debt['amount'])}"
                   if action == "approve"
                   else f"❌ Ваш запрос на погашение долга отклонён. Сумма: {fmt(debt['amount'])}")
            try:
                await call.bot.send_message(c["telegram_id"], msg)
            except Exception:
                pass
    await call.answer()


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
    await state.update_data(wh_staff_tg=int(message.text.strip()))
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
    await message.answer(
        f"✅ Завсклада добавлен!\nИмя: {name}\nTelegram ID: {tg_id}\n\n"
        "⚠️ Доступ активен до перезапуска бота. Для постоянного доступа добавьте ID в WAREHOUSE_IDS в .env"
    )
    try:
        await message.bot.send_message(
            tg_id,
            "🏭 Вы добавлены как завсклада Ever Water!\n"
            "Используйте /warehouse для доступа к панели склада."
        )
    except Exception:
        pass


@router.callback_query(F.data == "admin:wh:list_staff")
async def admin_wh_list_staff(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    from services.roles import get_all_warehouse_ids
    ids = get_all_warehouse_ids()
    if not ids:
        await call.answer("Список завсклада пуст.", show_alert=True)
        return
    lines = ["🏭 <b>Завсклада:</b>\n"] + [f"• {tid}" for tid in ids]
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
    "bottle_discount_type": "Тип скидки за бутылки (fixed/percent)",
    "bottle_discount_value": "Размер скидки за бутылку",
    "cashback_percent": "Кэшбэк % с заказа",
    "payment_card": "Номер карты для оплаты",
    "payment_holder": "Получатель платежа",
}


@router.callback_query(F.data == "admin:settings")
async def admin_settings(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    cfg = await api.get_settings()
    lines = ["⚙️ <b>Настройки:</b>\n"]
    for key, label in SETTINGS_LABELS.items():
        lines.append(f"• {label}: <b>{cfg.get(key, '—')}</b>")
    from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=f"✏️ {SETTINGS_LABELS[k]}", callback_data=f"admin:set:{k}")]
        for k in SETTINGS_LABELS
    ] + [[InlineKeyboardButton(text="← Назад", callback_data="admin:back")]])
    await call.message.edit_text("\n".join(lines), reply_markup=kb, parse_mode="HTML")
    await call.answer()


@router.callback_query(F.data.startswith("admin:set:"))
async def admin_set_key(call: CallbackQuery, state: FSMContext):
    if not is_admin(call.from_user.id):
        return
    key = call.data.split(":", 2)[2]
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
    await message.answer(f"✅ Настройка обновлена: {SETTINGS_LABELS.get(key, key)} = {value}")


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
        reply_markup=product_edit_kb(pid),
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
    data = await state.get_data()
    await state.clear()
    result = await api.create_product({
        "name": data["new_prod_name"],
        "volume": data["new_prod_volume"],
        "price": data["new_prod_price"],
        "type": wtype,
        "is_active": True,
    })
    await call.message.edit_text(
        f"✅ Товар создан!\n"
        f"Название: {result.get('name')}\n"
        f"Объём: {result.get('volume')} л | Цена: {fmt(result.get('price', 0))}"
    )
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
                reply_markup=product_edit_kb(pid),
            )
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
    if field == "price":
        val = int(raw.replace(" ", ""))
    elif field == "volume":
        val = float(raw.replace(",", "."))
    else:
        val = raw
    await api.update_product(pid, {field: val})
    await state.clear()
    await message.answer(f"✅ Товар обновлён: {field} = {val}")


# ─── Back ─────────────────────────────────────────────────────────────────────

@router.callback_query(F.data == "admin:back")
async def admin_back(call: CallbackQuery):
    if not is_admin(call.from_user.id):
        return
    await call.message.edit_text("🔧 Панель администратора:", reply_markup=admin_menu_kb())
    await call.answer()
