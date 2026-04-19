from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton


def warehouse_menu_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📦 Остатки"), KeyboardButton(text="➕ Производство")],
            [KeyboardButton(text="📤 Выдать курьеру"), KeyboardButton(text="📥 Принять возврат")],
            [KeyboardButton(text="🚴 Склад курьеров"), KeyboardButton(text="📜 История")],
            [KeyboardButton(text="🔄 Роль")],
        ],
        resize_keyboard=True,
    )


def wh_product_select_kb(products: list, action: str) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(
            text=f"{p['product_name']} ({p.get('volume', '')}л) — {p.get('quantity', 0)} шт.",
            callback_data=f"wh:{action}:{p['product_id']}"
        )]
        for p in products
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def wh_courier_select_kb(couriers: list, action: str) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(
            text=c["name"],
            callback_data=f"wh:{action}:courier:{c['id']}"
        )]
        for c in couriers
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def wh_history_filter_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="Все", callback_data="wh:hist:all"),
            InlineKeyboardButton(text="Производство", callback_data="wh:hist:production"),
        ],
        [
            InlineKeyboardButton(text="Выдача", callback_data="wh:hist:issue"),
            InlineKeyboardButton(text="Возврат", callback_data="wh:hist:return"),
        ],
    ])
