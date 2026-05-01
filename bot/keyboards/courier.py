from urllib.parse import quote
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton
from config import settings


def _site(path: str = "") -> str:
    return settings.MINI_APP_URL.rstrip("/") + path


def _is_phone(v: str) -> bool:
    return bool(v) and str(v) not in ("—", "-", "None") and any(c.isdigit() for c in str(v))


def _fmt_sum(v) -> str:
    return f"{int(v):,}".replace(",", " ") + " сум"


def courier_assignment_text(order: dict) -> str:
    items_text = "\n".join(
        f"  • {i.get('product_name', '?')} ×{i.get('quantity', 1)}" for i in order.get("items", [])
    )
    pay = order.get("payment_method", "cash")
    total = order.get("total") or 0
    cash_line = f"\nПолучить от клиента: {_fmt_sum(total)}" if pay == "cash" else ""
    time_str = order.get("delivery_time") or "—"
    manager_phone = order.get("manager_phone") or ""
    manager_line = f"\nМенеджер: {manager_phone}" if _is_phone(manager_phone) else ""
    return (
        f"📦 <b>🚚 Назначен курьеру</b>\n\n"
        f"Адрес: {order.get('address') or '—'}\n"
        f"Клиент: {order.get('recipient_phone') or '—'}"
        f"{manager_line}\n"
        f"Время: {time_str}\n"
        f"Товары:\n{items_text}"
        f"{cash_line}\n"
        f"Возврат бутылок: {order.get('return_bottles_count') or 0} шт."
    )


def courier_assignment_kb(order_id: int, order: dict) -> InlineKeyboardMarkup:
    rows = []
    lat = order.get("latitude")
    lng = order.get("longitude")
    address = order.get("address", "")

    if lat and lng:
        rows.append([InlineKeyboardButton(text="🗺 На карте", url=f"https://maps.google.com/?q={lat},{lng}")])
    elif address:
        rows.append([InlineKeyboardButton(text="🗺 На карте", url=f"https://maps.google.com/?q={quote(address)}")])
    rows.append([InlineKeyboardButton(text="🚴 Выехал", callback_data=f"courier:in_delivery:{order_id}")])
    rows.append([InlineKeyboardButton(text="◀️ К списку", callback_data="cor:back")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def courier_menu_kb() -> ReplyKeyboardMarkup:
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
        rows.append([InlineKeyboardButton(text="🚴 Выехал", callback_data=f"courier:in_delivery:{order_id}")])
    elif status == "in_delivery":
        rows.append([InlineKeyboardButton(text="✔️ Доставлено", callback_data=f"courier:done:{order_id}")])
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
