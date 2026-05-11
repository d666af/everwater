from datetime import datetime
from aiogram.types import (
    ReplyKeyboardMarkup, KeyboardButton,
    InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
)
from config import settings


def _site(path: str = "") -> str:
    base = settings.MINI_APP_URL.rstrip("/")
    return f"{base}{path}"


def main_menu_kb(show_role_switch: bool = False) -> ReplyKeyboardMarkup:
    keyboard = [
        [KeyboardButton(text="🛒 Заказать"), KeyboardButton(text="🧺 Корзина")],
        [KeyboardButton(text="📦 Мои заказы"), KeyboardButton(text="👤 Профиль")],
        [KeyboardButton(text="📋 Подписки"), KeyboardButton(text="🎁 Бонусы")],
        [KeyboardButton(text="⭐ Мои отзывы"), KeyboardButton(text="💬 Поддержка")],
    ]
    if show_role_switch:
        keyboard.append([KeyboardButton(text="🔄 Роль")])
    return ReplyKeyboardMarkup(keyboard=keyboard, resize_keyboard=True)


def miniapp_inline_kb(path: str = "") -> InlineKeyboardMarkup:
    url = _site(path)
    if url.startswith("https"):
        return InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="📱 Открыть на сайте", web_app=WebAppInfo(url=url))],
        ])
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="📱 Открыть на сайте", url=url)],
    ])


def site_link_kb(label: str, path: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=label, url=_site(path))],
    ])


def request_phone_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📱 Отправить номер", request_contact=True)],
        ],
        resize_keyboard=True,
        one_time_keyboard=True,
    )


def order_actions_kb(order_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="✅ Я оплатил", callback_data=f"paid:{order_id}")],
        [InlineKeyboardButton(text="❌ Отменить заказ", callback_data=f"cancel_order:{order_id}")],
    ])


def review_kb(order_id: int) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=str(i) + "⭐", callback_data=f"review:{order_id}:{i}") for i in range(1, 6)]
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


_STATUS_MAP = {
    "new": "🆕",
    "awaiting_confirmation": "⏳",
    "confirmed": "✅",
    "assigned_to_courier": "🚴",
    "in_delivery": "🚚",
    "delivered": "✔️",
    "rejected": "❌",
    "cancelled": "🚫",
    "rejected_by_manager": "❌",
    "cancellation_requested": "⏳",
}

_STATUS_LABEL = {
    "new": "Новый",
    "awaiting_confirmation": "Ожидает",
    "confirmed": "Подтверждён",
    "assigned_to_courier": "Курьер назначен",
    "in_delivery": "В пути",
    "delivered": "Доставлен",
    "rejected": "Отклонён",
    "cancelled": "Отменён",
    "rejected_by_manager": "Отклонён",
    "cancellation_requested": "Ожидает отмены",
}


def orders_list_kb(orders: list) -> InlineKeyboardMarkup:
    buttons = []
    for o in orders[:10]:
        emoji = _STATUS_MAP.get(o["status"], "📦")
        label = _STATUS_LABEL.get(o["status"], o["status"])
        total = f'{int(o["total"]):,}'.replace(",", " ")
        # Date
        date_str = ""
        raw_date = o.get("delivered_at") or o.get("created_at")
        if raw_date:
            try:
                dt = datetime.fromisoformat(str(raw_date).replace("Z", ""))
                date_str = dt.strftime("%d.%m")
            except Exception:
                pass
        # Items short
        items = o.get("items", [])
        if items:
            first = items[0]
            name_short = (first.get("product_name") or "Товар").split()[0]
            qty = sum(i.get("quantity", 1) for i in items)
            items_part = f"{name_short}" + (f" +{len(items)-1}" if len(items) > 1 else "") + f" ×{qty}"
        else:
            items_part = "—"
        text = f"{emoji} {date_str}  {items_part}  {total} сум  {label}"
        buttons.append([InlineKeyboardButton(text=text, callback_data=f"order_detail:{o['id']}")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def review_order_select_kb(orders: list) -> InlineKeyboardMarkup:
    """Keyboard for selecting an order to leave a review on."""
    buttons = []
    for o in orders[:8]:
        raw_date = o.get("delivered_at") or o.get("created_at")
        date_str = ""
        if raw_date:
            try:
                dt = datetime.fromisoformat(str(raw_date).replace("Z", ""))
                date_str = dt.strftime("%d.%m.%y")
            except Exception:
                pass
        items = o.get("items", [])
        items_parts = []
        for i in items[:2]:
            name = (i.get("product_name") or "Товар").split()[0]
            items_parts.append(f"{name}×{i.get('quantity',1)}")
        items_short = ", ".join(items_parts)
        if len(items) > 2:
            items_short += f" +{len(items)-2}"
        total = f'{int(o["total"]):,}'.replace(",", " ")
        courier = o.get("courier_name") or ""
        courier_part = f" · {courier}" if courier else ""
        text = f"📦 {date_str} · {items_short} · {total} сум{courier_part}"
        buttons.append([InlineKeyboardButton(text=text, callback_data=f"review:{o['id']}:0")])
    buttons.append([InlineKeyboardButton(text="← Назад", callback_data="back_to_reviews")])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
