from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from config import settings


def _site(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path


def warehouse_menu_kb() -> ReplyKeyboardMarkup:
    # No role-switch button — warehouse operators stay in warehouse flow
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📦 Остатки"), KeyboardButton(text="➕ Производство")],
            [KeyboardButton(text="📤 Выдать курьеру"), KeyboardButton(text="📥 Принять возврат")],
            [KeyboardButton(text="🔧 Корректировка"), KeyboardButton(text="🚴 Склад курьеров")],
            [KeyboardButton(text="📜 История")],
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
    buttons.append([InlineKeyboardButton(text="🌐 Склад на сайте", url=_site("/warehouse"))])
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
        [InlineKeyboardButton(text="🌐 История на сайте", url=_site("/warehouse/history"))],
    ])


def wh_period_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="День", callback_data="wh:period:day"),
            InlineKeyboardButton(text="Неделя", callback_data="wh:period:week"),
            InlineKeyboardButton(text="Месяц", callback_data="wh:period:month"),
        ],
        [InlineKeyboardButton(text="🌐 Склад на сайте", url=_site("/warehouse"))],
    ])


def wh_stock_actions_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="➕ Производство", callback_data="wh:quick:prod"),
            InlineKeyboardButton(text="📤 Выдача", callback_data="wh:quick:issue"),
        ],
        [InlineKeyboardButton(text="🔧 Корректировка", callback_data="wh:quick:adjust")],
        [InlineKeyboardButton(text="🌐 Открыть склад на сайте", url=_site("/warehouse"))],
    ])


def wh_low_stock_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Записать производство", callback_data="wh:quick:prod")],
        [InlineKeyboardButton(text="🌐 Склад на сайте", url=_site("/warehouse"))],
    ])
