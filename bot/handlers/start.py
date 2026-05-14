import secrets
import string
from datetime import datetime
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardRemove
from aiogram.filters import CommandStart, Command, StateFilter
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from services.roles import get_user_roles, get_primary_role, ROLE_LABELS
from keyboards.user import main_menu_kb, miniapp_inline_kb, request_phone_kb, review_kb, orders_list_kb, orders_repeat_kb, review_order_select_kb, _site
from config import settings

router = Router()


def fmt(amount):
    return f"{int(amount):,}".replace(",", " ") + " сум"


STATUS_MAP = {
    "new": "🆕 Новый",
    "awaiting_confirmation": "⏳ Ожидает подтверждения",
    "confirmed": "✅ Подтверждён",
    "assigned_to_courier": "🚚 Передан курьеру",
    "in_delivery": "🚴 В доставке",
    "delivered": "✔️ Доставлен",
    "rejected": "❌ Отклонён",
    "cancelled": "🚫 Отменён",
    "rejected_by_manager": "❌ Отклонён менеджером",
    "cancellation_requested": "⏳ Ожидает отмены",
}

PAY_MAP = {
    "cash": "💵 Наличные",
    "card": "💳 Карта",
    "balance": "💰 Баланс",
}


class Registration(StatesGroup):
    waiting_name = State()
    waiting_phone = State()


class ReviewState(StatesGroup):
    waiting_comment = State()


# ─── Role picker helpers ──────────────────────────────────────────────────────

def roles_inline_kb(roles: list[str]) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=ROLE_LABELS[r], callback_data=f"role:select:{r}")]
        for r in roles
    ])


async def show_role_menu(target, role: str):
    is_message = isinstance(target, Message)
    send = target.answer if is_message else target.message.answer
    tg_id = target.from_user.id

    roles = await get_user_roles(tg_id)
    switch_kb = None
    if len(roles) > 1:
        switch_kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔄 Сменить роль", callback_data="role:switch")]
        ])

    subs_on = await api.is_subscriptions_enabled()

    if role == "client":
        await send("👤 Режим клиента:", reply_markup=main_menu_kb(show_role_switch=bool(switch_kb), subs_enabled=subs_on))
        try:
            await send("Или откройте сайт:", reply_markup=miniapp_inline_kb("/"))
        except Exception:
            pass

    elif role == "admin":
        from keyboards.admin import admin_menu_kb
        await send("🔧 Панель администратора:", reply_markup=admin_menu_kb(subs_enabled=subs_on))
        if switch_kb:
            await send("Переключить роль:", reply_markup=switch_kb)

    elif role == "manager":
        from keyboards.manager import manager_menu_kb
        await send("🧑‍💼 Панель менеджера:", reply_markup=manager_menu_kb(subs_enabled=subs_on))
        site_rows = [[InlineKeyboardButton(text="🌐 Открыть менеджер на сайте", url=_site("/manager"))]]
        if switch_kb:
            site_rows.append(switch_kb.inline_keyboard[0])
        try:
            await send("Сайт:", reply_markup=InlineKeyboardMarkup(inline_keyboard=site_rows))
        except Exception:
            if switch_kb:
                await send("Переключить роль:", reply_markup=switch_kb)

    elif role == "courier":
        from keyboards.courier import courier_menu_kb
        await send("🚴 Панель курьера:", reply_markup=courier_menu_kb())
        site_rows = [[InlineKeyboardButton(text="🌐 Открыть курьер на сайте", url=_site("/courier"))]]
        if switch_kb:
            site_rows.append(switch_kb.inline_keyboard[0])
        try:
            await send("Сайт:", reply_markup=InlineKeyboardMarkup(inline_keyboard=site_rows))
        except Exception:
            if switch_kb:
                await send("Переключить роль:", reply_markup=switch_kb)

    elif role == "warehouse":
        from keyboards.warehouse import warehouse_menu_kb
        await send("🏭 Панель склада:", reply_markup=warehouse_menu_kb(subs_enabled=subs_on))
        site_rows = [[InlineKeyboardButton(text="🌐 Открыть склад на сайте", url=_site("/warehouse"))]]
        if switch_kb:
            site_rows.append(switch_kb.inline_keyboard[0])
        try:
            await send("Сайт:", reply_markup=InlineKeyboardMarkup(inline_keyboard=site_rows))
        except Exception:
            if switch_kb:
                await send("Переключить роль:", reply_markup=switch_kb)


_ALL_MENU_BUTTONS = frozenset({
    # client
    "🛒 Заказать", "🔁 Повторить заказ", "🎁 Бонусы", "💬 Поддержка",
    # client (legacy buttons — kept so cached old keyboards still escape FSM properly)
    "📦 Мои заказы", "👤 Профиль", "📋 Подписки", "🧺 Корзина", "⭐ Мои отзывы",
    # admin
    "📋 Заказы", "⏳ Новые заказы", "📊 Статистика", "🚴 Курьеры", "👥 Клиенты",
    "🏭 Склад", "📦 Товары", "📅 Подписки", "🧑‍💼 Менеджеры",
    "⚙️ Настройки", "📣 Рассылка",
    # manager
    "📋 Заказы", "👥 Клиенты", "📊 Статистика",
    # courier
    "📋 Мои заказы", "📊 Мои отчеты", "💧 Мой склад", "⭐ Мои отзывы", "📝 Создать заказ",
    # shared
    "🔄 Роль",
})


@router.message(~StateFilter(None), F.text.in_(_ALL_MENU_BUTTONS))
async def escape_fsm_on_menu_btn(message: Message, state: FSMContext):
    """When user presses a menu button while stuck in an FSM flow, abort flow and restore keyboard."""
    await state.clear()
    role = await get_primary_role(message.from_user.id)
    subs_on = await api.is_subscriptions_enabled()
    if role == "admin":
        from keyboards.admin import admin_menu_kb
        await message.answer("Главное меню:", reply_markup=admin_menu_kb(subs_enabled=subs_on))
    elif role == "manager":
        from keyboards.manager import manager_menu_kb
        await message.answer("Главное меню:", reply_markup=manager_menu_kb(subs_enabled=subs_on))
    elif role == "courier":
        from keyboards.courier import courier_menu_kb
        await message.answer("Главное меню:", reply_markup=courier_menu_kb())
    elif role == "warehouse":
        from keyboards.warehouse import warehouse_menu_kb
        await message.answer("Главное меню:", reply_markup=warehouse_menu_kb(subs_enabled=subs_on))
    else:
        await message.answer("Главное меню:", reply_markup=main_menu_kb(subs_enabled=subs_on))


# ─── /menu — always restores keyboard regardless of FSM state ────────────────

@router.message(Command("menu"))
async def cmd_menu(message: Message, state: FSMContext):
    await state.clear()
    role = await get_primary_role(message.from_user.id)
    subs_on = await api.is_subscriptions_enabled()
    if role == "admin":
        from keyboards.admin import admin_menu_kb
        await message.answer("Главное меню:", reply_markup=admin_menu_kb(subs_enabled=subs_on))
    elif role == "manager":
        from keyboards.manager import manager_menu_kb
        await message.answer("Главное меню:", reply_markup=manager_menu_kb(subs_enabled=subs_on))
    elif role == "courier":
        from keyboards.courier import courier_menu_kb
        await message.answer("Главное меню:", reply_markup=courier_menu_kb())
    elif role == "warehouse":
        from keyboards.warehouse import warehouse_menu_kb
        await message.answer("Главное меню:", reply_markup=warehouse_menu_kb(subs_enabled=subs_on))
    else:
        await message.answer("Главное меню:", reply_markup=main_menu_kb(subs_enabled=subs_on))


# ─── /start ───────────────────────────────────────────────────────────────────

@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    tg_id = message.from_user.id

    user = await api.get_user(tg_id)
    if not user:
        user = await api.create_or_get_user(tg_id)

    if not user.get("is_registered"):
        await state.set_state(Registration.waiting_name)
        await message.answer(
            "👋 Добро пожаловать в Ever Water!\n\n"
            "Для заказов нам нужно несколько данных.\n\nКак вас зовут?"
        )
        return

    roles = await get_user_roles(tg_id)
    if len(roles) > 1:
        labels = " | ".join(ROLE_LABELS[r] for r in roles)
        await message.answer(f"👋 С возвращением, {user['name']}!", reply_markup=ReplyKeyboardRemove())
        await message.answer(
            f"Ваши роли: {labels}\n\nВыберите режим:",
            reply_markup=roles_inline_kb(roles),
        )
    else:
        role = roles[0] if roles else "client"
        await message.answer(f"👋 С возвращением, {user['name']}!", reply_markup=ReplyKeyboardRemove())
        await show_role_menu(message, role)


# ─── Role selection callback ──────────────────────────────────────────────────

@router.callback_query(F.data.startswith("role:select:"))
async def role_selected(call: CallbackQuery, state: FSMContext):
    role = call.data.split(":")[2]
    roles = await get_user_roles(call.from_user.id)
    if role not in roles:
        await call.answer("Недоступно", show_alert=True)
        return
    await call.answer(f"Переключаюсь: {ROLE_LABELS.get(role, role)}")
    await show_role_menu(call, role)


# ─── "Switch role" inline callback ───────────────────────────────────────────

@router.callback_query(F.data == "role:switch")
async def switch_role_cb(call: CallbackQuery, state: FSMContext):
    roles = await get_user_roles(call.from_user.id)
    if len(roles) <= 1:
        await call.answer("У вас только одна роль", show_alert=True)
        return
    await call.answer()
    await call.message.answer("Выберите режим:", reply_markup=roles_inline_kb(roles))


# ─── /role command ────────────────────────────────────────────────────────────

@router.message(Command("role"))
async def cmd_role(message: Message):
    roles = await get_user_roles(message.from_user.id)
    if len(roles) <= 1:
        return
    labels = " | ".join(ROLE_LABELS[r] for r in roles)
    await message.answer(f"Ваши роли: {labels}\n\nВыберите режим:", reply_markup=roles_inline_kb(roles))


# ─── "Switch role" reply button ───────────────────────────────────────────────

@router.message(F.text == "🔄 Роль")
async def switch_role_btn(message: Message):
    roles = await get_user_roles(message.from_user.id)
    if len(roles) <= 1:
        return
    await message.answer("Выберите режим:", reply_markup=roles_inline_kb(roles))


# ─── Registration ─────────────────────────────────────────────────────────────

@router.message(Registration.waiting_name)
async def process_name(message: Message, state: FSMContext):
    name = message.text.strip()
    if len(name) < 2:
        await message.answer("Введите корректное имя (минимум 2 символа).")
        return
    await state.update_data(name=name)
    await state.set_state(Registration.waiting_phone)
    await message.answer(
        f"Приятно познакомиться, {name}!\n\nВведите номер телефона или нажмите кнопку:",
        reply_markup=request_phone_kb(),
    )


@router.message(Registration.waiting_phone, F.contact)
async def process_contact(message: Message, state: FSMContext):
    await _finish_registration(message, state, message.contact.phone_number)


@router.message(Registration.waiting_phone, F.text)
async def process_phone_text(message: Message, state: FSMContext):
    phone = message.text.strip()
    if len(phone) < 7:
        await message.answer("Введите корректный номер телефона.")
        return
    await _finish_registration(message, state, phone)


async def _finish_registration(message: Message, state: FSMContext, phone: str):
    data = await state.get_data()
    name = data["name"]
    alphabet = string.ascii_uppercase + string.digits
    password = ''.join(secrets.choice(alphabet) for _ in range(8))
    await api.update_user(message.from_user.id, name=name, phone=phone, is_registered=True, site_password=password)
    await state.clear()
    await message.answer(
        f"🎉 Готово, {name}! Регистрация завершена.\n\nТеперь вы можете делать заказы!",
        reply_markup=main_menu_kb(subs_enabled=await api.is_subscriptions_enabled()),
    )
    from handlers.client import start_survey
    await start_survey(message, state)


# ─── My orders (client) ───────────────────────────────────────────────────────

@router.message(F.text == "📦 Мои заказы")
async def my_orders(message: Message, state: FSMContext):
    await state.clear()
    user = await api.get_user(message.from_user.id)
    if not user:
        return
    orders = await api.get_user_orders(user["id"])
    if not orders:
        await message.answer("У вас пока нет заказов.\n\nНажмите 🛒 Заказать чтобы сделать первый заказ!")
        return
    await message.answer("Ваши заказы:", reply_markup=orders_list_kb(orders))


@router.message(F.text == "🔁 Повторить заказ")
async def repeat_order_menu(message: Message, state: FSMContext):
    await state.clear()
    user = await api.get_user(message.from_user.id)
    if not user:
        return
    orders = await api.get_user_orders(user["id"])
    if not orders:
        await message.answer("У вас пока нет заказов.\n\nНажмите 🛒 Заказать чтобы сделать первый.")
        return
    await message.answer(
        "🔁 Выберите заказ, чтобы повторить его — товары будут добавлены в корзину:",
        reply_markup=orders_repeat_kb(orders),
    )


@router.callback_query(F.data.startswith("order_detail:"))
async def order_detail(call: CallbackQuery):
    order_id = int(call.data.split(":")[1])
    order = await api.get_order(order_id)
    if not order:
        await call.answer("Заказ не найден")
        return

    status = order["status"]
    status_label = STATUS_MAP.get(status, status)
    pay_label = PAY_MAP.get(order.get("payment_method", ""), "—")

    # Progress indicator (text-based, matches website's 4-step progress)
    STEP = {
        "new": 0, "awaiting_confirmation": 0, "confirmed": 0,
        "assigned_to_courier": 1, "in_delivery": 2, "delivered": 3,
    }
    step = STEP.get(status)
    ACTIVE = {"new", "awaiting_confirmation", "confirmed", "assigned_to_courier", "in_delivery"}
    if step is not None and status in ACTIVE:
        steps = ["⏳ Ожидание", "👤 Курьер", "🚚 В пути", "✅ Доставлен"]
        progress = "  ".join(
            f"<b>{s}</b>" if i == step else f"<i>{s}</i>"
            for i, s in enumerate(steps)
        )
    else:
        progress = None

    lines = [f"<b>📦 Заказ</b>", f"Статус: {status_label}"]
    if progress:
        lines += ["", progress]

    # Address
    lines.append("")
    lines.append(f"📍 {order.get('address', '—')}")
    if order.get("extra_info"):
        lines.append(f"   └ {order['extra_info']}")

    # Courier block
    if status in ("assigned_to_courier", "in_delivery") and order.get("courier_name"):
        lines.append("")
        lines.append(f"🚴 Курьер: <b>{order['courier_name']}</b>")
        if order.get("courier_phone"):
            lines.append(f"📞 {order['courier_phone']}")

    # Items
    items = order.get("items", [])
    if items:
        lines.append("")
        lines.append("<b>Состав заказа:</b>")
        for i in items:
            line_total = fmt(i["price"] * i["quantity"])
            lines.append(f"  • {i['product_name']} × {i['quantity']} — {line_total}")

    # Totals
    lines.append("")
    subtotal = order.get("subtotal", order.get("total", 0))
    lines.append(f"Сумма: {fmt(subtotal)}")
    if order.get("bottle_discount", 0) > 0:
        lines.append(f"Скидка за бутылки: −{fmt(order['bottle_discount'])}")
    if order.get("bonus_used", 0) > 0:
        lines.append(f"Бонусы: −{fmt(order['bonus_used'])}")
    if order.get("balance_used", 0) > 0:
        lines.append(f"Баланс: −{fmt(order['balance_used'])}")
    lines.append(f"<b>К оплате: {fmt(order.get('total', 0))}</b>")
    lines.append(f"Оплата: {pay_label}")
    lines.append(f"📱 {order.get('recipient_phone', '—')}")

    # Rejection / manager comment
    if order.get("rejection_reason"):
        lines += ["", f"❌ Причина отклонения: {order['rejection_reason']}"]
    if order.get("manager_comment"):
        lines += ["", f"💬 Комментарий: {order['manager_comment']}"]

    # Queue position for active orders (stage-specific message from API)
    ACTIVE = {"new", "awaiting_confirmation", "confirmed", "assigned_to_courier", "in_delivery"}
    if status in ACTIVE:
        try:
            qp = await api.get_queue_position(order_id)
            msg = qp.get("message") if qp else None
            if msg:
                lines.append(f"\n📋 {msg}")
        except Exception:
            pass

    # Courier phone in text (tel: not allowed in inline buttons)
    if status in ("assigned_to_courier", "in_delivery") and order.get("courier_phone"):
        lines.append(f"🚴 Курьер: {order['courier_phone']}")

    # Buttons
    buttons = []
    if status == "delivered" and not order.get("review_id"):
        buttons.append([InlineKeyboardButton(text="⭐ Оценить доставку", callback_data=f"review:{order_id}:0")])
    buttons.append([InlineKeyboardButton(text="🔄 Повторить заказ", callback_data=f"reorder:{order_id}")])
    if status in ("new", "awaiting_confirmation", "confirmed"):
        buttons.append([InlineKeyboardButton(text="❌ Запросить отмену", callback_data=f"req_cancel:{order_id}")])
    elif status == "cancellation_requested":
        buttons.append([InlineKeyboardButton(text="⏳ Отмена на рассмотрении", callback_data="noop")])
    buttons.append([InlineKeyboardButton(text="← Назад к заказам", callback_data="my_orders")])

    try:
        await call.message.edit_text(
            "\n".join(lines),
            reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
            parse_mode="HTML"
        )
    except Exception:
        await call.message.answer(
            "\n".join(lines),
            reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons),
            parse_mode="HTML"
        )
    await call.answer()


@router.callback_query(F.data == "my_orders")
async def inline_my_orders(call: CallbackQuery):
    user = await api.get_user(call.from_user.id)
    if not user:
        await call.answer("Пользователь не найден")
        return
    orders = await api.get_user_orders(user["id"])
    if not orders:
        await call.message.edit_text("У вас пока нет заказов.")
        await call.answer()
        return
    await call.message.edit_text("Ваши заказы:", reply_markup=orders_list_kb(orders))
    await call.answer()


@router.callback_query(F.data.startswith("req_cancel:"))
async def req_cancel_cb(call: CallbackQuery):
    order_id = int(call.data.split(":")[1])
    reasons = ["Изменились планы", "Заказал случайно", "Нашёл другой вариант", "Другое"]
    buttons = [
        [InlineKeyboardButton(text=r, callback_data=f"cancel_reason:{order_id}:{i}")]
        for i, r in enumerate(reasons)
    ]
    buttons.append([InlineKeyboardButton(text="← Назад", callback_data=f"order_detail:{order_id}")])
    await call.message.edit_text(
        "❌ Укажите причину отмены:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=buttons)
    )
    await call.answer()


@router.callback_query(F.data.startswith("cancel_reason:"))
async def cancel_reason_cb(call: CallbackQuery):
    parts = call.data.split(":")
    order_id = int(parts[1])
    idx = int(parts[2])
    reasons = ["Изменились планы", "Заказал случайно", "Нашёл другой вариант", "Другое"]
    reason = reasons[idx] if idx < len(reasons) else "Другое"
    result = await api.request_cancellation(order_id, reason)
    if result and result.get("ok"):
        await call.message.edit_text(
            f"⏳ Запрос на отмену заказа #{order_id} отправлен.\n"
            f"Причина: {reason}\n\n"
            "Ожидайте подтверждения от оператора."
        )
    else:
        await call.answer("Не удалось отправить запрос. Обратитесь в поддержку.", show_alert=True)
    await call.answer()


@router.callback_query(F.data.startswith("cancel_order:"))
async def cancel_order_cb(call: CallbackQuery):
    # Legacy handler — now redirect to req_cancel
    order_id = int(call.data.split(":")[1])
    result = await api.cancel_order(order_id)
    if result:
        await call.message.edit_text("🚫 Заказ отменён.")
    else:
        await call.answer("Не удалось отменить заказ. Обратитесь в поддержку.", show_alert=True)
    await call.answer()


@router.callback_query(F.data == "noop")
async def noop_cb(call: CallbackQuery):
    await call.answer()


@router.callback_query(F.data.startswith("reorder:"))
async def reorder(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.split(":")[1])
    order = await api.get_order(order_id)
    cart = {}
    for item in order.get("items", []):
        pid = str(item["product_id"])
        cart[pid] = {
            "name": item.get("product_name", f"Товар #{pid}"),
            "price": item["price"],
            "qty": item["quantity"],
            "volume": 0,
            "product_id": item["product_id"],
        }
    await state.update_data(cart=cart)
    await call.answer("Товары добавлены в корзину!")
    from handlers.client import show_cart
    await show_cart(call, state)


# ─── Profile ──────────────────────────────────────────────────────────────────

@router.message(F.text == "👤 Профиль")
async def profile(message: Message, state: FSMContext):
    await state.clear()
    user = await api.get_user(message.from_user.id)
    if not user:
        return
    bottles = await api.get_bottles_owed(user["id"])
    bottle_count = bottles.get("count", 0)
    pending = bottles.get("pending_return", 0)
    available = bottles.get("available", bottle_count)
    subs_on = await api.is_subscriptions_enabled()
    if subs_on:
        subs = await api.get_subscriptions(user["id"]) or []
        active_subs = [s for s in subs if s.get("status") == "active"]
    else:
        subs = []
        active_subs = []
    order_count = user.get("order_count", 0)

    reg_date = ""
    if user.get("created_at"):
        try:
            dt = datetime.fromisoformat(str(user["created_at"]).replace("Z", ""))
            reg_date = dt.strftime("%d.%m.%Y")
        except Exception:
            pass

    text = f"<b>👤 Профиль</b>\n\n"
    text += f"Имя: <b>{user.get('name') or '—'}</b>\n"
    text += f"Телефон: <b>{user.get('phone') or '—'}</b>\n"
    if reg_date:
        text += f"Клиент с: {reg_date}\n"
    text += "\n"
    text += f"✔️ Выполненных заказов: <b>{order_count}</b>\n"
    bonus = int(user.get("bonus_points") or 0)
    text += f"⭐ Бонусный баланс: <b>{fmt(bonus)}</b>\n"
    if float(user.get("balance") or 0) > 0:
        text += f"💰 Депозит: <b>{fmt(user['balance'])}</b>\n"
    if bottle_count > 0:
        text += "\n"
        if pending > 0:
            text += (
                f"🫙 Тара в долге: <b>{bottle_count} шт.</b>\n"
                f"   ↩️ Возвращается сейчас: {pending} шт.\n"
                f"   ✅ Можно вернуть: {available} шт.\n"
            )
        else:
            text += f"🫙 Бутылок к возврату: <b>{bottle_count} шт.</b>\n"
    if subs_on and active_subs:
        text += f"\n📋 Активных подписок: <b>{len(active_subs)}</b>\n"

    if subs_on:
        kb = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📋 Мои подписки", callback_data="profile:subs")],
        ])
        await message.answer(text, reply_markup=kb, parse_mode="HTML")
    else:
        await message.answer(text, parse_mode="HTML")


@router.message(F.text == "🎁 Бонусы")
async def bonuses_menu(message: Message, state: FSMContext):
    await state.clear()
    user = await api.get_user(message.from_user.id)
    if not user:
        return
    cfg = await api.get_settings()
    bonus = int(user.get("bonus_points") or 0)
    per_bottle = int(cfg.get("bonus_per_bottle") or 100)
    expiry_days = int(cfg.get("bonus_expiry_days") or 60)
    limit_pct = int(cfg.get("bonus_limit_percent") or 30)

    text = f"🎁 <b>Бонусная программа</b>\n\n"
    text += f"Ваш баланс: <b>{fmt(bonus)}</b>\n"

    if bonus > 0 and user.get("bonus_expires_at"):
        try:
            exp_dt = datetime.fromisoformat(str(user["bonus_expires_at"]).replace("Z", ""))
            text += f"⏰ Действуют до: <b>{exp_dt.strftime('%d.%m.%Y')}</b>\n"
        except Exception:
            pass

    text += "\n<b>Как зарабатывать:</b>\n"
    text += f"• За каждую бутылку 19л при доставке — +{per_bottle:,} бонусов\n"
    text += "\n<b>Как тратить:</b>\n"
    text += f"• При оформлении заказа бонусами можно оплатить до {limit_pct}% суммы\n"
    text += "• Выбирается на этапе оплаты\n"

    if expiry_days > 0:
        text += f"\n⏳ Бонусы сгорают через <b>{expiry_days} дней</b> после последнего начисления\n"
    else:
        text += "\n✅ Бонусы бессрочные — не сгорают\n"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="🛒 Сделать заказ", callback_data="goto_order")],
    ])
    await message.answer(text, reply_markup=kb, parse_mode="HTML")


@router.callback_query(F.data == "profile:subs")
async def profile_subs(call: CallbackQuery, state: FSMContext):
    await call.answer()
    if not await api.is_subscriptions_enabled():
        await call.message.answer("📋 Подписки временно недоступны.")
        return
    user = await api.get_user(call.from_user.id)
    if not user:
        return
    subs = await api.get_subscriptions(user["id"]) or []
    active = [s for s in subs if s.get("status") in ("active", "paused")]
    if not active:
        await call.message.answer(
            "📋 <b>Подписки</b>\n\nУ вас нет активных подписок.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="➕ Оформить подписку", callback_data="sub_new")],
            ]),
            parse_mode="HTML",
        )
        return
    # Import sub_card from client handler
    from handlers.client import _sub_card
    text = "📋 <b>Мои подписки</b>\n"
    for s in active:
        text += "\n" + _sub_card(s) + "\n"
    rows = [[InlineKeyboardButton(text="➕ Новая подписка", callback_data="sub_new")]]
    for s in active:
        sub_id = s["id"]
        row = []
        if s.get("status") == "paused":
            row.append(InlineKeyboardButton(text=f"▶ Возобновить #{sub_id}", callback_data=f"sub_resume:{sub_id}"))
        else:
            row.append(InlineKeyboardButton(text=f"⏸ Пауза #{sub_id}", callback_data=f"sub_pause:{sub_id}"))
        row.append(InlineKeyboardButton(text=f"❌ Отменить #{sub_id}", callback_data=f"sub_del:{sub_id}"))
        rows.append(row)
    await call.message.answer(text, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows), parse_mode="HTML")


# ─── Support (client) ─────────────────────────────────────────────────────────

@router.message(F.text == "💬 Поддержка")
async def support_start(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(
        "💬 <b>Поддержка</b>\n\n"
        "Напишите ваш вопрос — оператор ответит в ближайшее время.\n\n"
        "Или выберите быструю тему:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📦 Где мой заказ?", callback_data="support_quick:order")],
            [InlineKeyboardButton(text="💳 Вопрос по оплате", callback_data="support_quick:payment")],
            [InlineKeyboardButton(text="🔄 Возврат / замена", callback_data="support_quick:return")],
            [InlineKeyboardButton(text="✏️ Другой вопрос", callback_data="support_quick:other")],
        ]),
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("support_quick:"))
async def support_quick_cb(call: CallbackQuery):
    topics = {
        "order": "Где мой заказ?",
        "payment": "Вопрос по оплате",
        "return": "Возврат / замена",
        "other": "Другой вопрос",
    }
    topic = call.data.split(":")[1]
    label = topics.get(topic, topic)
    tg_id = call.from_user.id
    name = call.from_user.full_name or str(tg_id)
    try:
        await api.send_user_support_message(tg_id, name, f"[{label}]")
        await call.message.edit_text(
            f"✉️ Обращение «{label}» принято.\nОператор ответит в ближайшее время."
        )
    except Exception:
        await call.message.edit_text("Не удалось отправить обращение. Просто напишите сюда — мы увидим.")
    await call.answer()


# ─── Payment confirmed ────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("paid:"))
async def user_paid(call: CallbackQuery):
    order_id = int(call.data.split(":")[1])
    await api.payment_confirmed(order_id)
    order = await api.get_order(order_id)

    await call.message.edit_text(
        "✅ Заказ передан на подтверждение.\n"
        "Мы уведомим вас когда подтвердят."
    )
    await call.answer()


# ─── Reviews ──────────────────────────────────────────────────────────────────

@router.message(F.text == "⭐ Мои отзывы")
async def my_reviews(message: Message, state: FSMContext):
    await state.clear()
    user = await api.get_user(message.from_user.id)
    if not user:
        await message.answer("Профиль не найден.")
        return
    await _send_my_reviews(message, user["id"])


async def _send_my_reviews(target, user_id: int):
    """Render reviews list with 'Leave review' button. target = Message or CallbackQuery."""
    reviews = await api.get_user_reviews(user_id)
    leave_btn = [[InlineKeyboardButton(text="✏️ Оставить отзыв", callback_data="leave_review")]]

    if not reviews:
        text = "⭐ <b>Мои отзывы</b>\n\nУ вас пока нет отзывов."
        kb = InlineKeyboardMarkup(inline_keyboard=leave_btn)
    else:
        lines = ["⭐ <b>Мои отзывы</b>\n"]
        for r in reviews[:6]:
            stars = "⭐" * int(r.get("rating") or 0)
            review_date = ""
            if r.get("created_at"):
                try:
                    dt = datetime.fromisoformat(r["created_at"].replace("Z", ""))
                    review_date = dt.strftime("%d.%m.%Y")
                except Exception:
                    pass
            delivered_str = ""
            if r.get("order_delivered_at"):
                try:
                    dt = datetime.fromisoformat(r["order_delivered_at"].replace("Z", ""))
                    delivered_str = dt.strftime("%d.%m.%Y")
                except Exception:
                    pass
            lines.append("─────────────────")
            lines.append(f"{stars}  Заказ #{r.get('order_id','—')}  ·  {review_date}")
            if r.get("order_items"):
                lines.append(f"📦 {r['order_items']}")
            if delivered_str:
                lines.append(f"🚚 Доставлен: {delivered_str}")
            if r.get("courier_name"):
                lines.append(f"🚴 Курьер: {r['courier_name']}")
            if r.get("order_total"):
                lines.append(f"💰 Итого: {fmt(r['order_total'])}")
            if r.get("comment"):
                lines.append(f"💬 {r['comment']}")
        text = "\n".join(lines)
        kb = InlineKeyboardMarkup(inline_keyboard=leave_btn)

    if isinstance(target, CallbackQuery):
        try:
            await target.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
        except Exception:
            await target.message.answer(text, reply_markup=kb, parse_mode="HTML")
        await target.answer()
    else:
        await target.answer(text, reply_markup=kb, parse_mode="HTML")


@router.callback_query(F.data == "back_to_reviews")
async def back_to_reviews(call: CallbackQuery):
    user = await api.get_user(call.from_user.id)
    if not user:
        await call.answer()
        return
    await _send_my_reviews(call, user["id"])


@router.callback_query(F.data == "leave_review")
async def leave_review_select(call: CallbackQuery):
    user = await api.get_user(call.from_user.id)
    if not user:
        await call.answer("Профиль не найден", show_alert=True)
        return
    orders = await api.get_user_orders(user["id"])
    reviewable = [o for o in orders if o.get("status") == "delivered" and not o.get("review_id")]
    if not reviewable:
        await call.message.edit_text(
            "Нет заказов, ожидающих оценки.\n"
            "Отзыв можно оставить только после доставки.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="← Назад", callback_data="back_to_reviews")]
            ])
        )
        await call.answer()
        return
    await call.message.edit_text(
        "Выберите заказ для оценки:",
        reply_markup=review_order_select_kb(reviewable),
    )
    await call.answer()


@router.callback_query(F.data == "goto_order")
async def goto_order_cb(call: CallbackQuery, state: FSMContext):
    await call.answer()
    from handlers.client import catalog
    await catalog(call.message, state)


@router.callback_query(F.data.startswith("review:"))
async def process_review_rating(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    order_id = int(parts[1])
    rating = int(parts[2]) if len(parts) > 2 and parts[2] != "0" else 0

    if rating == 0:
        await call.message.edit_text(
            "Оцените качество доставки:",
            reply_markup=review_kb(order_id)
        )
        await call.answer()
        return

    user = await api.get_user(call.from_user.id)
    await api.create_review(user_id=user["id"], order_id=order_id, rating=rating)

    stars = "⭐" * rating
    comment_kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💬 Добавить комментарий", callback_data=f"review_comment:{order_id}")],
        [InlineKeyboardButton(text="✅ Готово", callback_data="back_to_reviews")],
    ])
    await call.message.edit_text(
        f"Спасибо за оценку! {stars}\n\nХотите добавить комментарий?",
        reply_markup=comment_kb,
    )
    await call.answer()


@router.callback_query(F.data.startswith("review_comment:"))
async def process_review_comment_prompt(call: CallbackQuery, state: FSMContext):
    order_id = int(call.data.split(":")[1])
    await state.update_data(review_order_id=order_id)
    await state.set_state(ReviewState.waiting_comment)
    await call.message.edit_text("Напишите ваш комментарий:")
    await call.answer()


@router.message(ReviewState.waiting_comment)
async def process_review_comment(message: Message, state: FSMContext):
    data = await state.get_data()
    await api.update_review_comment(order_id=data["review_order_id"], comment=message.text)
    await state.clear()
    await message.answer("Спасибо за отзыв! 🙏", reply_markup=main_menu_kb(subs_enabled=await api.is_subscriptions_enabled()))
