from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from config import settings


def _site(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path


def courier_menu_kb() -> ReplyKeyboardMarkup:
    # No role-switch button — couriers stay in courier flow
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📋 Мои заказы"), KeyboardButton(text="📊 Мои отчеты")],
            [KeyboardButton(text="💧 Мой склад"), KeyboardButton(text="💸 Мои долги")],
            [KeyboardButton(text="⭐ Мои отзывы"), KeyboardButton(text="📝 Создать заказ")],
        ],
        resize_keyboard=True,
    )


def courier_order_kb(order_id: int, status: str = "assigned_to_courier") -> InlineKeyboardMarkup:
    rows = []
    if status == "assigned_to_courier":
        rows.append([InlineKeyboardButton(text="✅ Принял заказ", callback_data=f"courier:accept:{order_id}")])
    if status in ("assigned_to_courier", "in_delivery"):
        rows.append([InlineKeyboardButton(text="🚴 Выехал", callback_data=f"courier:in_delivery:{order_id}")])
        rows.append([InlineKeyboardButton(text="✔️ Доставлено", callback_data=f"courier:done:{order_id}")])
    if not rows:
        rows.append([InlineKeyboardButton(text="✔️ Доставлено", callback_data=f"courier:done:{order_id}")])
    rows.append([InlineKeyboardButton(text="🌐 Заказы на сайте", url=_site("/courier"))])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def courier_debt_kb(debt_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📤 Запросить погашение", callback_data=f"courier:debt_request:{debt_id}")],
        [InlineKeyboardButton(text="🌐 Статистика на сайте", url=_site("/courier/stats"))],
    ])


def courier_cash_confirm_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Да, наличные получены", callback_data=f"courier:cash_ok:{order_id}")],
        [InlineKeyboardButton(text="💳 Безналичная оплата", callback_data=f"courier:cash_skip:{order_id}")],
    ])


def courier_orders_filter_kb(active_tab: str = "waiting") -> InlineKeyboardMarkup:
    tabs = [
        ("⏳", "waiting"),
        ("🚴", "enroute"),
        ("✔️", "done"),
        ("📋", "all"),
    ]
    buttons = []
    for icon, tab in tabs:
        marker = "·" if tab == active_tab else ""
        buttons.append(InlineKeyboardButton(text=f"{marker}{icon}{marker}", callback_data=f"cor:tab:{tab}"))
    return InlineKeyboardMarkup(inline_keyboard=[buttons])
