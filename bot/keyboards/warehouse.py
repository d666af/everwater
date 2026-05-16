from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from config import settings


def _site(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path


def warehouse_menu_kb(subs_enabled: bool = True) -> ReplyKeyboardMarkup:
    rows = [
        [KeyboardButton(text="📦 Остатки"), KeyboardButton(text="➕ Производство")],
        [KeyboardButton(text="🔄 Выдать/Возврат"), KeyboardButton(text="📊 Отчёт")],
        [KeyboardButton(text="👥 Курьеры")],
    ]
    if subs_enabled:
        rows.append([KeyboardButton(text="📅 Подписки"), KeyboardButton(text="📜 История")])
    else:
        rows.append([KeyboardButton(text="📜 История")])
    return ReplyKeyboardMarkup(keyboard=rows, resize_keyboard=True)


def wh_prod_product_kb(products: list) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=p['name'], callback_data=f"wh:prod:{p['id']}")]
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


def wh_ir_catalog_kb(catalog: list, cart: dict, return_qty: int) -> InlineKeyboardMarkup:
    buttons = []
    for p in catalog:
        qty = cart.get(str(p['id']), {}).get('qty', 0)
        mark = f" ✓{qty}" if qty > 0 else ""
        buttons.append([InlineKeyboardButton(
            text=f"{p['name']}{mark}",
            callback_data=f"wh:ir:p:{p['id']}"
        )])
    ret_mark = f" ✓{return_qty}" if return_qty > 0 else ""
    buttons.append([InlineKeyboardButton(text=f"↩ Бутылки 19л{ret_mark}", callback_data="wh:ir:ret")])
    has_items = any(v.get('qty', 0) > 0 for v in cart.values()) or return_qty > 0
    if has_items:
        buttons.append([InlineKeyboardButton(text="✅ Выдать", callback_data="wh:ir:submit")])
    buttons.append([InlineKeyboardButton(text="❌ Отмена", callback_data="wh:ir:cancel")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def wh_report_period_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="Сегодня", callback_data="wh:report:today"),
            InlineKeyboardButton(text="Неделя", callback_data="wh:report:week"),
            InlineKeyboardButton(text="Месяц", callback_data="wh:report:month"),
        ],
        [InlineKeyboardButton(text="🌐 Склад на сайте", url=_site("/warehouse"))],
    ])


def wh_history_filter_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="Все", callback_data="wh:hist:all"),
            InlineKeyboardButton(text="Производство", callback_data="wh:hist:production"),
        ],
        [
            InlineKeyboardButton(text="Выдача", callback_data="wh:hist:issue"),
            InlineKeyboardButton(text="Возврат тары", callback_data="wh:hist:bottle_return"),
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
            InlineKeyboardButton(text="🔄 Выдать/Возврат", callback_data="wh:quick:ir"),
        ],
        [InlineKeyboardButton(text="🌐 Открыть склад на сайте", url=_site("/warehouse"))],
    ])


def wh_low_stock_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="➕ Записать производство", callback_data="wh:quick:prod")],
        [InlineKeyboardButton(text="🌐 Склад на сайте", url=_site("/warehouse"))],
    ])
