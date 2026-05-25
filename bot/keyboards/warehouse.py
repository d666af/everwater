from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from config import settings


def _site(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path


def warehouse_menu_kb(subs_enabled: bool = True) -> ReplyKeyboardMarkup:
    rows = [
        [KeyboardButton(text="📦 Остатки"), KeyboardButton(text="➕ Производство")],
        [KeyboardButton(text="🔄 Выдать/Возврат"), KeyboardButton(text="📊 Отчёт")],
        [KeyboardButton(text="👥 Курьеры"), KeyboardButton(text="🗑 Отменить выдачу")],
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
    buttons = []
    for c in couriers:
        phone = c.get("phone", "")
        label = c["name"] + (f"  {phone}" if phone else "")
        buttons.append([InlineKeyboardButton(
            text=label,
            callback_data=f"wh:{action}:courier:{c['id']}"
        )])
    buttons.append([InlineKeyboardButton(text="🏭 Завод", callback_data=f"wh:{action}:factory")])
    if action == "ir":
        buttons.append([InlineKeyboardButton(text="➕ Новый курьер", callback_data="wh:ir:new_courier")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def wh_factory_select_kb(factories: list, action: str) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=f["name"], callback_data=f"wh:{action}:factpick:{f['id']}")]
        for f in factories
    ]
    buttons.append([InlineKeyboardButton(text="◀ Назад к курьерам", callback_data=f"wh:{action}:fback")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


_VEHICLE_TYPES = ["Легковая", "Грузовая", "Мотоцикл", "Велосипед", "Пешком"]


def wh_cart_kb(catalog: list, cart: dict, return_qty: int,
               vtype: str, vplate: str, date_label: str,
               is_factory: bool = False) -> InlineKeyboardMarkup:
    rows = []

    # Date row
    rows.append([
        InlineKeyboardButton(text=f"📅 {date_label}", callback_data="wh:ir:noop"),
        InlineKeyboardButton(text="✏️ Дата", callback_data="wh:ir:datemenu"),
    ])

    # Products: [−] [Name × qty] [+]
    for p in catalog:
        qty = cart.get(str(p['id']), {}).get('qty', 0)
        center = f"{p['name']} × {qty}" if qty > 0 else p['name']
        rows.append([
            InlineKeyboardButton(text="−", callback_data=f"wh:ir:minus:{p['id']}"),
            InlineKeyboardButton(text=center, callback_data="wh:ir:noop"),
            InlineKeyboardButton(text="+", callback_data=f"wh:ir:plus:{p['id']}"),
        ])

    # Return row (courier only)
    if not is_factory:
        center_ret = f"↩ Бутылки × {return_qty}" if return_qty > 0 else "↩ Бутылки 19л"
        rows.append([
            InlineKeyboardButton(text="−", callback_data="wh:ir:rminus"),
            InlineKeyboardButton(text=center_ret, callback_data="wh:ir:noop"),
            InlineKeyboardButton(text="+", callback_data="wh:ir:rplus"),
        ])

    # Vehicle row
    rows.append([
        InlineKeyboardButton(text=vtype or "🚗 Тип авто", callback_data="wh:ir:vtypemenu"),
        InlineKeyboardButton(text=vplate or "🔢 Номер", callback_data="wh:ir:vplate"),
    ])

    has_items = any(v.get('qty', 0) > 0 for v in cart.values()) or (not is_factory and return_qty > 0)
    if has_items:
        rows.append([InlineKeyboardButton(text="✅ Выдать", callback_data="wh:ir:submit")])

    rows.append([
        InlineKeyboardButton(text="◀ Назад", callback_data="wh:ir:back"),
        InlineKeyboardButton(text="❌ Отмена", callback_data="wh:ir:cancel"),
    ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def wh_date_menu_kb(date_options: list, current_iso: str) -> InlineKeyboardMarkup:
    """date_options: list of (label, iso_date) tuples"""
    rows = []
    row = []
    for i, (label, iso) in enumerate(date_options):
        mark = " ✓" if iso == current_iso else ""
        row.append(InlineKeyboardButton(text=label + mark, callback_data=f"wh:ir:date:{iso}"))
        if len(row) == 2 or i == len(date_options) - 1:
            rows.append(row)
            row = []
    rows.append([
        InlineKeyboardButton(text="✏️ Другая дата", callback_data="wh:ir:date:custom"),
        InlineKeyboardButton(text="◀ Назад", callback_data="wh:ir:date:back"),
    ])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def wh_vtype_kb(current: str = "") -> InlineKeyboardMarkup:
    rows = []
    row = []
    for i, vt in enumerate(_VEHICLE_TYPES):
        mark = " ✓" if vt == current else ""
        row.append(InlineKeyboardButton(text=vt + mark, callback_data=f"wh:ir:vtype:{vt}"))
        if len(row) == 2 or i == len(_VEHICLE_TYPES) - 1:
            rows.append(row)
            row = []
    rows.append([InlineKeyboardButton(text="◀ Назад", callback_data="wh:ir:vtype:__back")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


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
