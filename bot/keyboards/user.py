from aiogram.types import (
    ReplyKeyboardMarkup, KeyboardButton,
    InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
)
from config import settings


def main_menu_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="🛒 Открыть каталог", web_app=WebAppInfo(url=settings.MINI_APP_URL))],
            [KeyboardButton(text="📦 Мои заказы"), KeyboardButton(text="👤 Профиль")],
            [KeyboardButton(text="🆘 Поддержка")],
        ],
        resize_keyboard=True,
    )


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


def orders_list_kb(orders: list) -> InlineKeyboardMarkup:
    buttons = []
    for o in orders[:10]:
        status_map = {
            "new": "🆕",
            "awaiting_confirmation": "⏳",
            "confirmed": "✅",
            "assigned_to_courier": "🚚",
            "in_delivery": "🚴",
            "delivered": "✔️",
            "rejected": "❌",
        }
        emoji = status_map.get(o["status"], "📦")
        buttons.append([
            InlineKeyboardButton(
                text=f"{emoji} Заказ #{o['id']} — {o['total']}₽",
                callback_data=f"order_detail:{o['id']}"
            )
        ])
    return InlineKeyboardMarkup(inline_keyboard=buttons)
