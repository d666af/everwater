from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton


def manager_menu_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📋 Заказы"), KeyboardButton(text="⏳ Новые заказы")],
            [KeyboardButton(text="👥 Клиенты"), KeyboardButton(text="📊 Статистика")],
            [KeyboardButton(text="💸 Долги курьеров"), KeyboardButton(text="🆘 Поддержка")],
            [KeyboardButton(text="🔄 Роль")],
        ],
        resize_keyboard=True,
    )


def mgr_order_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Подтвердить", callback_data=f"mgr:confirm:{order_id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"mgr:reject:{order_id}"),
        ],
        [InlineKeyboardButton(text="🚴 Назначить курьера", callback_data=f"mgr:assign:{order_id}")],
    ])


def mgr_courier_select_kb(couriers: list, order_id: int) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=c["name"], callback_data=f"mgr:set_courier:{order_id}:{c['id']}")]
        for c in couriers
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def mgr_stats_period_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="День", callback_data="mgr:stats:day"),
            InlineKeyboardButton(text="Неделя", callback_data="mgr:stats:week"),
            InlineKeyboardButton(text="Месяц", callback_data="mgr:stats:month"),
        ]
    ])


def mgr_client_kb(user_id: int, tg_id: int | None) -> InlineKeyboardMarkup:
    rows = [[InlineKeyboardButton(text="💰 Пополнить баланс", callback_data=f"mgr:topup:{user_id}")]]
    if tg_id:
        rows.append([InlineKeyboardButton(text="✉️ Написать клиенту", callback_data=f"mgr:msg_client:{tg_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def mgr_debt_kb(debt_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ Одобрить", callback_data=f"mgr:debt:approve:{debt_id}"),
            InlineKeyboardButton(text="❌ Отклонить", callback_data=f"mgr:debt:reject:{debt_id}"),
        ]
    ])
