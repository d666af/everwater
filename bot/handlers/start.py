from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, Contact
from aiogram.filters import CommandStart, Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
import services.api_client as api
from keyboards.user import main_menu_kb, request_phone_kb, order_actions_kb, review_kb, orders_list_kb
from config import settings

router = Router()


class Registration(StatesGroup):
    waiting_name = State()
    waiting_phone = State()


class ReviewState(StatesGroup):
    waiting_comment = State()


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext):
    user = await api.get_user(message.from_user.id)
    if not user:
        user = await api.create_or_get_user(message.from_user.id)

    if user.get("is_registered"):
        await message.answer(
            f"👋 С возвращением, {user['name']}!\n\nВыберите действие:",
            reply_markup=main_menu_kb(),
        )
        return

    await state.set_state(Registration.waiting_name)
    await message.answer(
        "👋 Добро пожаловать в сервис доставки воды!\n\n"
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
    contact: Contact = message.contact
    phone = contact.phone_number
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
        "Теперь вы можете делать заказы. Нажмите «Открыть каталог» чтобы начать!",
        reply_markup=main_menu_kb(),
    )


@router.message(F.text == "📦 Мои заказы")
async def my_orders(message: Message):
    user = await api.get_user(message.from_user.id)
    if not user:
        return
    orders = await api.get_user_orders(user["id"])
    if not orders:
        await message.answer("У вас пока нет заказов.")
        return
    await message.answer("Ваши заказы:", reply_markup=orders_list_kb(orders))


@router.callback_query(F.data.startswith("order_detail:"))
async def order_detail(call: CallbackQuery):
    order_id = int(call.data.split(":")[1])
    order = await api.get_order(order_id)
    status_map = {
        "new": "🆕 Новый",
        "awaiting_confirmation": "⏳ Ожидает подтверждения",
        "confirmed": "✅ Подтвержден",
        "assigned_to_courier": "🚚 Передан курьеру",
        "in_delivery": "🚴 В доставке",
        "delivered": "✔️ Доставлен",
        "rejected": "❌ Отклонен",
    }
    items_text = "\n".join(
        f"  • {i['product_name']} x{i['quantity']} — {i['price'] * i['quantity']}₽"
        for i in order.get("items", [])
    )
    text = (
        f"📦 Заказ #{order['id']}\n"
        f"Статус: {status_map.get(order['status'], order['status'])}\n\n"
        f"Товары:\n{items_text}\n\n"
        f"Адрес: {order['address']}\n"
        f"Время: {order.get('delivery_time', 'не указано')}\n\n"
        f"Сумма: {order['subtotal']}₽\n"
        f"Скидка за бутылки: -{order['bottle_discount']}₽\n"
        f"Итого: {order['total']}₽"
    )
    await call.message.edit_text(text)
    await call.answer()


@router.message(F.text == "👤 Профиль")
async def profile(message: Message):
    user = await api.get_user(message.from_user.id)
    if not user:
        return
    await message.answer(
        f"👤 Профиль\n\n"
        f"Имя: {user.get('name', '—')}\n"
        f"Телефон: {user.get('phone', '—')}\n"
        f"Баланс: {user.get('balance', 0)}₽\n"
        f"Бонусы: {user.get('bonus_points', 0)} баллов\n"
    )


@router.message(F.text == "🆘 Поддержка")
async def support(message: Message):
    await message.answer(
        "Для связи с поддержкой напишите нам: @support_username\n\n"
        "Или позвоните: +7 (XXX) XXX-XX-XX"
    )


# Payment confirmed by user
@router.callback_query(F.data.startswith("paid:"))
async def user_paid(call: CallbackQuery):
    order_id = int(call.data.split(":")[1])
    await api.payment_confirmed(order_id)
    order = await api.get_order(order_id)

    # Notify admins
    from aiogram import Bot
    bot: Bot = call.bot
    for admin_id in settings.ADMIN_IDS:
        try:
            from keyboards.admin import order_confirm_kb
            await bot.send_message(
                admin_id,
                f"💰 Новый заказ #{order_id} ожидает подтверждения!\n"
                f"Клиент: {order.get('user_id')}\n"
                f"Сумма: {order['total']}₽\n"
                f"Адрес: {order['address']}",
                reply_markup=order_confirm_kb(order_id),
            )
        except Exception:
            pass

    await call.message.edit_text(
        f"✅ Спасибо! Заказ #{order_id} передан на подтверждение.\n"
        "Мы уведомим вас как только заказ будет подтвержден."
    )
    await call.answer()


# Review
@router.callback_query(F.data.startswith("review:"))
async def process_review_rating(call: CallbackQuery, state: FSMContext):
    _, order_id, rating = call.data.split(":")
    await state.update_data(review_order_id=int(order_id), review_rating=int(rating))
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
