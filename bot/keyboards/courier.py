from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton


def courier_menu_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📋 Мои заказы"), KeyboardButton(text="📊 Мои отчеты")],
            [KeyboardButton(text="💧 Мой склад"), KeyboardButton(text="💸 Мои долги")],
            [KeyboardButton(text="⭐ Мои отзывы"), KeyboardButton(text="📝 Создать заказ")],
            [KeyboardButton(text="🔄 Роль")],
        ],
        resize_keyboard=True,
    )


def courier_order_kb(order_id: int, status: str = "assigned_to_courier") -> InlineKeyboardMarkup:
    rows = []
    if status == "assigned_to_courier":
        rows.append([InlineKeyboardButton(text="✅ Принял заказ", callback_data=f"courier:accept:{order_id}")])
    if status in ("assigned_to_courier", "in_delivery"):
        rows.append([InlineKeyboardButton(text="🚴 Доставляю", callback_data=f"courier:in_delivery:{order_id}")])
        rows.append([InlineKeyboardButton(text="✔️ Доставлено", callback_data=f"courier:done:{order_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows) if rows else InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✔️ Доставлено", callback_data=f"courier:done:{order_id}")]
    ])


def courier_debt_kb(debt_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📤 Запросить погашение", callback_data=f"courier:debt_request:{debt_id}")]
    ])
