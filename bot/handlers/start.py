import secrets
import string
from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardRemove
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from services.roles import get_user_roles, get_primary_role, ROLE_LABELS
from keyboards.user import main_menu_kb, miniapp_inline_kb, request_phone_kb, review_kb, orders_list_kb, _site
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

    if role == "client":
        await send("👤 Режим клиента:", reply_markup=main_menu_kb(show_role_switch=bool(switch_kb)))
        try:
            await send("Или откройте сайт:", reply_markup=miniapp_inline_kb("/"))
        except Exception:
            pass

    elif role == "admin":
        from keyboards.admin import admin_menu_kb
        await send("🔧 Панель администратора:", reply_markup=admin_menu_kb())
        if switch_kb:
            await send("Переключить роль:", reply_markup=switch_kb)

    elif role == "manager":
        from keyboards.manager import manager_menu_kb
        await send("🧑‍💼 Панель менеджера:", reply_markup=manager_menu_kb())
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
        await send("🏭 Панель склада:", reply_markup=warehouse_menu_kb())
        site_rows = [[InlineKeyboardButton(text="🌐 Открыть склад на сайте", url=_site("/warehouse"))]]
        if switch_kb:
            site_rows.append(switch_kb.inline_keyboard[0])
        try:
            await send("Сайт:", reply_markup=InlineKeyboardMarkup(inline_keyboard=site_rows))
        except Exception:
            if switch_kb:
                await send("Переключить роль:", reply_markup=switch_kb)


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
        reply_markup=main_menu_kb(),
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
        await message.answer(
            "У вас пока нет заказов.\n\nОткройте каталог чтобы сделать первый заказ! 🛒",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="🛒 Каталог на сайте", url=_site("/"))]
            ])
        )
        return
    await message.answer("Ваши заказы:", reply_markup=orders_list_kb(orders))


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

    # Buttons
    buttons = []
    if status == "delivered" and not order.get("review_id"):
        buttons.append([InlineKeyboardButton(text="⭐ Оценить доставку", callback_data=f"review:{order_id}:0")])
    if status in ("assigned_to_courier", "in_delivery") and order.get("courier_phone"):
        buttons.append([InlineKeyboardButton(text="📞 Позвонить курьеру", url=f"tel:{order['courier_phone']}")])
    buttons.append([InlineKeyboardButton(text="🔄 Повторить заказ", callback_data=f"reorder:{order_id}")])
    if status in ("new", "awaiting_confirmation"):
        buttons.append([InlineKeyboardButton(text="❌ Отменить заказ", callback_data=f"cancel_order:{order_id}")])
    buttons.append([InlineKeyboardButton(text="💬 Связаться с поддержкой", url=_site("/support"))])
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


@router.callback_query(F.data.startswith("cancel_order:"))
async def cancel_order_cb(call: CallbackQuery):
    order_id = int(call.data.split(":")[1])
    result = await api.cancel_order(order_id)
    if result:
        await call.message.edit_text("🚫 Заказ отменён.")
    else:
        await call.answer("Не удалось отменить заказ. Обратитесь в поддержку.", show_alert=True)
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
    subs = await api.get_subscriptions(user["id"])
    active_subs = [s for s in subs if s.get("status") == "active"]

    text = (
        f"<b>👤 Профиль</b>\n\n"
        f"Имя: {user.get('name', '—')}\n"
        f"Телефон: {user.get('phone', '—')}\n\n"
        f"⭐ Бонусы: <b>{fmt(user.get('bonus_points', 0))}</b>\n"
    )
    if bottle_count > 0:
        text += f"🫙 Бутылок к возврату: <b>{bottle_count} шт.</b>\n"
    if active_subs:
        text += f"📋 Активных подписок: <b>{len(active_subs)}</b>\n"

    kb = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Мои подписки", callback_data="profile:subs")],
        [InlineKeyboardButton(text="🌐 Профиль на сайте", url=_site("/profile"))],
    ])
    await message.answer(text, reply_markup=kb, parse_mode="HTML")


@router.callback_query(F.data == "profile:subs")
async def profile_subs(call: CallbackQuery, state: FSMContext):
    await call.answer()
    # Reuse the subscriptions message handler
    user = await api.get_user(call.from_user.id)
    if not user:
        return
    subs = await api.get_subscriptions(user["id"]) or []
    active = [s for s in subs if s.get("status") == "active"]
    plan_label = {"weekly": "Еженедельная", "monthly": "Ежемесячная"}
    if active:
        lines = ["<b>📋 Активные подписки:</b>\n"]
        for s in active:
            plan = plan_label.get(s.get("plan", ""), s.get("plan", ""))
            lines.append(f"• {plan} | {s.get('water_summary', '')} | День: {s.get('day', '—')}")
        rows = [[InlineKeyboardButton(text="➕ Новая подписка", callback_data="sub_new")]]
        for s in active:
            rows.append([InlineKeyboardButton(text=f"❌ Отменить #{s['id']}", callback_data=f"sub_del:{s['id']}")])
        rows.append([InlineKeyboardButton(text="🌐 Подписки на сайте", url=_site("/subscription"))])
        await call.message.answer("\n".join(lines), reply_markup=InlineKeyboardMarkup(inline_keyboard=rows),
                                   parse_mode="HTML")
    else:
        await call.message.answer(
            "У вас нет активных подписок.",
            reply_markup=InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(text="➕ Оформить подписку", callback_data="sub_new")],
                [InlineKeyboardButton(text="🌐 Подписки на сайте", url=_site("/subscription"))],
            ])
        )


# ─── Support (client) ─────────────────────────────────────────────────────────

@router.message(F.text == "🆘 Поддержка")
async def support_start(message: Message, state: FSMContext):
    await state.clear()
    await message.answer(
        "💬 <b>Поддержка</b>\n\n"
        "Напишите вопрос прямо сюда или откройте чат на сайте:",
        reply_markup=InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="💬 Открыть чат поддержки", url=_site("/support"))]
        ]),
        parse_mode="HTML",
    )


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


# ─── Review ───────────────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("review:"))
async def process_review_rating(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    order_id = int(parts[1])
    rating = int(parts[2]) if len(parts) > 2 and parts[2] != "0" else 0

    if rating == 0:
        await call.message.edit_text("Оцените качество доставки:", reply_markup=review_kb(order_id))
        await call.answer()
        return

    await state.update_data(review_order_id=order_id, review_rating=rating)
    await state.set_state(ReviewState.waiting_comment)
    await call.message.answer(f"Вы поставили {rating}⭐. Добавьте комментарий (или напишите «нет»):")
    await call.answer()


@router.message(ReviewState.waiting_comment)
async def process_review_comment(message: Message, state: FSMContext):
    data = await state.get_data()
    comment = message.text if message.text.lower() != "нет" else None
    user = await api.get_user(message.from_user.id)
    await api.create_review(
        user_id=user["id"],
        order_id=data["review_order_id"],
        rating=data["review_rating"],
        comment=comment,
    )
    await state.clear()
    await message.answer("Спасибо за отзыв! 🙏")
