from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, Contact, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.user import main_menu_kb, miniapp_inline_kb, request_phone_kb, review_kb, orders_list_kb
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


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    await state.clear()
    user = await api.get_user(message.from_user.id)
    if not user:
        user = await api.create_or_get_user(message.from_user.id)

    if user.get("is_registered"):
        await message.answer(
            f"👋 С возвращением, {user['name']}!\n\nВыберите действие:",
            reply_markup=main_menu_kb(),
        )
        await message.answer(
            "Или откройте мини-приложение:",
            reply_markup=miniapp_inline_kb(),
        )
        return

    await state.set_state(Registration.waiting_name)
    await message.answer(
        "👋 Добро пожаловать в сервис доставки воды Ever Water!\n\n"
        "Для оформления заказов нам нужно несколько данных.\n\n"
        "Как вас зовут? Введите имя:"
    )


@router.message(Registration.waiting_name)
async def process_name(message: Message, state: FSMContext):
    name = message.text.strip()
    if len(name) < 2:
        await message.answer("Пожалуйста, введите корректное имя (минимум 2 символа).")
        return
    await state.update_data(name=name)
    await state.set_state(Registration.waiting_phone)
    await message.answer(
        f"Приятно познакомиться, {name}!\n\n"
        "Теперь введите ваш номер телефона или нажмите кнопку ниже:",
        reply_markup=request_phone_kb(),
    )


@router.message(Registration.waiting_phone, F.contact)
async def process_contact(message: Message, state: FSMContext):
    phone = message.contact.phone_number
    await _finish_registration(message, state, phone)


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
    await api.update_user(message.from_user.id, name=name, phone=phone)
    await state.clear()
    await message.answer(
        f"🎉 Отлично, {name}! Регистрация завершена.\n\n"
        "Теперь вы можете делать заказы!",
        reply_markup=main_menu_kb(),
    )
    await message.answer(
        "Откройте мини-приложение или используйте бот:",
        reply_markup=miniapp_inline_kb(),
    )
    from handlers.client import start_survey
    await start_survey(message, state)


# ─── Orders ──────────────────────────────────────────────────────────────────

@router.message(F.text == "📦 Мои заказы")
async def my_orders(message: Message):
    user = await api.get_user(message.from_user.id)
    if not user:
        return
    orders = await api.get_user_orders(user["id"])
    if not orders:
        await message.answer("У вас пока нет заказов.\n\nОткройте каталог чтобы сделать первый заказ! 🛒")
        return
    await message.answer("Ваши заказы:", reply_markup=orders_list_kb(orders))


@router.callback_query(F.data.startswith("order_detail:"))
async def order_detail(call: CallbackQuery):
    order_id = int(call.data.split(":")[1])
    order = await api.get_order(order_id)

    items_text = "\n".join(
        f"  • {i['product_name']} × {i['quantity']} — {fmt(i['price'] * i['quantity'])}"
        for i in order.get("items", [])
    )

    lines = [
        f"<b>📦 Заказ #{order['id']}</b>",
        f"Статус: {STATUS_MAP.get(order['status'], order['status'])}",
        "",
        f"<b>Товары:</b>\n{items_text}",
        "",
        f"📍 Адрес: {order.get('address', '—')}",
    ]
    if order.get("extra_info"):
        lines.append(f"   {order['extra_info']}")
    lines.append(f"🕐 Время: {order.get('delivery_time') or 'не указано'}")
    lines.append(f"📱 Телефон: {order.get('recipient_phone', '—')}")
    lines.append("")
    lines.append(f"Сумма: {fmt(order['subtotal'])}")
    if order.get("bottle_discount", 0) > 0:
        lines.append(f"Скидка за бутылки: −{fmt(order['bottle_discount'])}")
    if order.get("bonus_used", 0) > 0:
        lines.append(f"Бонусы: −{fmt(order['bonus_used'])}")
    if order.get("balance_used", 0) > 0:
        lines.append(f"Баланс: −{fmt(order['balance_used'])}")
    lines.append(f"<b>Итого: {fmt(order['total'])}</b>")
    lines.append(f"Оплата: {PAY_MAP.get(order.get('payment_method', ''), order.get('payment_method', '—'))}")

    if order.get("rejection_reason"):
        lines.append(f"\n❌ Причина отклонения: {order['rejection_reason']}")

    text = "\n".join(lines)

    buttons = []
    if order["status"] == "delivered":
        buttons.append([InlineKeyboardButton(text="⭐ Оценить", callback_data=f"review:{order_id}:0")])
    buttons.append([InlineKeyboardButton(text="🔄 Повторить заказ", callback_data=f"reorder:{order_id}")])
    buttons.append([InlineKeyboardButton(text="← Назад к заказам", callback_data="my_orders")])

    kb = InlineKeyboardMarkup(inline_keyboard=buttons)
    await call.message.edit_text(text, reply_markup=kb, parse_mode="HTML")
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


# ─── Profile ─────────────────────────────────────────────────────────────────

@router.message(F.text == "👤 Профиль")
async def profile(message: Message):
    user = await api.get_user(message.from_user.id)
    if not user:
        return
    bottles = await api.get_bottles_owed(user["id"])
    bottle_count = bottles.get("count", 0)

    text = (
        f"<b>👤 Профиль</b>\n\n"
        f"Имя: {user.get('name', '—')}\n"
        f"Телефон: {user.get('phone', '—')}\n"
        f"Баланс: <b>{fmt(user.get('balance', 0))}</b>\n"
        f"Бонусы: <b>{fmt(user.get('bonus_points', 0))}</b>\n"
    )
    if bottle_count > 0:
        text += f"Бутылки к возврату: {bottle_count} шт.\n"

    await message.answer(text, parse_mode="HTML")


# ─── Support ─────────────────────────────────────────────────────────────────

@router.message(F.text == "🆘 Поддержка")
async def support(message: Message):
    kb = miniapp_inline_kb()
    await message.answer(
        "🆘 <b>Поддержка</b>\n\n"
        "Напишите ваш вопрос прямо сюда в чат, и мы ответим в ближайшее время.\n\n"
        "Или откройте мини-приложение → раздел Поддержка:",
        reply_markup=kb,
        parse_mode="HTML",
    )


# ─── Payment confirmed ──────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("paid:"))
async def user_paid(call: CallbackQuery):
    order_id = int(call.data.split(":")[1])
    await api.payment_confirmed(order_id)
    order = await api.get_order(order_id)

    from aiogram import Bot
    bot: Bot = call.bot
    for admin_id in settings.ADMIN_IDS:
        try:
            from keyboards.admin import order_confirm_kb
            await bot.send_message(
                admin_id,
                f"💰 Новый заказ #{order_id} ожидает подтверждения!\n"
                f"Клиент: {order.get('recipient_phone', '—')}\n"
                f"Сумма: {fmt(order['total'])}\n"
                f"Адрес: {order['address']}",
                reply_markup=order_confirm_kb(order_id),
            )
        except Exception:
            pass

    await call.message.edit_text(
        f"✅ Спасибо! Заказ #{order_id} передан на подтверждение.\n"
        "Мы уведомим вас когда заказ будет подтверждён."
    )
    await call.answer()


# ─── Review ──────────────────────────────────────────────────────────────────

@router.callback_query(F.data.startswith("review:"))
async def process_review_rating(call: CallbackQuery, state: FSMContext):
    parts = call.data.split(":")
    order_id = int(parts[1])
    rating = int(parts[2]) if len(parts) > 2 and parts[2] != "0" else 0

    if rating == 0:
        await call.message.edit_text(
            "Оцените качество доставки:",
            reply_markup=review_kb(order_id),
        )
        await call.answer()
        return

    await state.update_data(review_order_id=order_id, review_rating=rating)
    await state.set_state(ReviewState.waiting_comment)
    await call.message.answer(
        f"Вы поставили {rating}⭐. Хотите добавить комментарий? (или напишите «нет»)"
    )
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
    await message.answer("Спасибо за ваш отзыв! 🙏")
