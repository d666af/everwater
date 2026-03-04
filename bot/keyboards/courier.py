from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton


def courier_menu_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📋 Мои заказы")],
            [KeyboardButton(text="📊 Мои отчеты")],
        ],
        resize_keyboard=True,
    )


def courier_order_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Принял заказ", callback_data=f"courier:accept:{order_id}")],
        [InlineKeyboardButton(text="🚴 Доставляю", callback_data=f"courier:in_delivery:{order_id}")],
        [InlineKeyboardButton(text="✔️ Доставлено", callback_data=f"courier:done:{order_id}")],
    ])
