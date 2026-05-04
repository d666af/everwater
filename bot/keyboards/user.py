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
        [KeyboardButton(text="🛒 Заказать")],
        [KeyboardButton(text="📦 Мои заказы"), KeyboardButton(text="👤 Профиль")],
        [KeyboardButton(text="📋 Подписки"), KeyboardButton(text="🎁 Бонусы")],
        [KeyboardButton(text="💬 Поддержка")],
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
        [InlineKeyboardButton(text="📋 Мои заказы на сайте", url=_site("/orders"))],
    ])


def review_kb(order_id: int) -> InlineKeyboardMarkup:
    buttons = [
        [InlineKeyboardButton(text=str(i) + "⭐", callback_data=f"review:{order_id}:{i}") for i in range(1, 6)]
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)


def orders_list_kb(orders: list) -> InlineKeyboardMarkup:
    status_map = {
        "new": "⏱️",
        "awaiting_confirmation": "⏱️",
        "confirmed": "✅",
        "assigned_to_courier": "👤",
        "in_delivery": "🚚",
        "delivered": "✅",
        "rejected": "❌",
        "cancelled": "🚫",
        "rejected_by_manager": "❌",
        "cancellation_requested": "⏳",
    }
    buttons = []
    for o in orders[:10]:
        emoji = status_map.get(o["status"], "📦")
        total = f'{int(o["total"]):,}'.replace(",", " ")
        qty = sum(i.get("quantity", 1) for i in o.get("items", []))
        qty_part = f"{qty} шт. · " if qty else ""
        buttons.append([
            InlineKeyboardButton(
                text=f'{emoji} {qty_part}{total} сум',
                callback_data=f"order_detail:{o['id']}"
            )
        ])
    buttons.append([InlineKeyboardButton(text="📋 Все заказы на сайте", url=_site("/orders"))])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
