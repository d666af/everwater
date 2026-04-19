from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton


def admin_menu_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📋 Все заказы", callback_data="admin:orders:all")],
        [InlineKeyboardButton(text="⏳ Ожидают подтверждения", callback_data="admin:orders:awaiting_confirmation")],
        [InlineKeyboardButton(text="📊 Статистика", callback_data="admin:stats")],
        [InlineKeyboardButton(text="🚴 Курьеры", callback_data="admin:couriers")],
        [InlineKeyboardButton(text="👥 Пользователи", callback_data="admin:users")],
        [InlineKeyboardButton(text="🧑‍💼 Менеджеры", callback_data="admin:managers")],
        [InlineKeyboardButton(text="💸 Долги курьеров", callback_data="admin:cash_debts")],
        [InlineKeyboardButton(text="📦 Склад", callback_data="admin:warehouse")],
        [InlineKeyboardButton(text="⚙️ Настройки", callback_data="admin:settings")],
        [InlineKeyboardButton(text="📣 Рассылка", callback_data="admin:broadcast")],
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


def admin_user_kb(user_id: int, tg_id: int | None) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text="💰 Пополнить баланс", callback_data=f"admin:topup_manual:{user_id}")]]
    if tg_id:
        rows.append([InlineKeyboardButton(text="✉️ Написать", callback_data=f"admin:msg_user:{tg_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def admin_debt_kb(debt_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Одобрить", callback_data=f"admin:debt:approve:{debt_id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"admin:debt:reject:{debt_id}"),
        ]
    ])


def broadcast_target_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="👥 Все клиенты", callback_data="admin:bc:clients")],
        [InlineKeyboardButton(text="🚴 Курьеры", callback_data="admin:bc:couriers")],
        [InlineKeyboardButton(text="🧑‍💼 Менеджеры", callback_data="admin:bc:managers")],
        [InlineKeyboardButton(text="🌐 Все", callback_data="admin:bc:all")],
    ])
