from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton


def admin_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Все заказы", callback_data="admin:orders:all")],
        [InlineKeyboardButton(text="⏳ Ожидают подтверждения", callback_data="admin:orders:awaiting_confirmation")],
        [InlineKeyboardButton(text="📊 Статистика", callback_data="admin:stats")],
        [InlineKeyboardButton(text="🚴 Курьеры", callback_data="admin:couriers")],
        [InlineKeyboardButton(text="👥 Пользователи", callback_data="admin:users")],
    ])


def order_confirm_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"admin:confirm:{order_id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"admin:reject:{order_id}"),
        ],
        [InlineKeyboardButton(text="🚴 Назначить курьера", callback_data=f"admin:assign:{order_id}")],
        [InlineKeyboardButton(text="💬 Написать клиенту", callback_data=f"admin:contact:{order_id}")],
    ])


def courier_select_kb(couriers: list, order_id: int) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=c["name"], callback_data=f"admin:set_courier:{order_id}:{c['id']}")]
        for c in couriers
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def stats_period_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="День", callback_data="admin:stats:day"),
            InlineKeyboardButton(text="Неделя", callback_data="admin:stats:week"),
            InlineKeyboardButton(text="Месяц", callback_data="admin:stats:month"),
        ]
    ])
