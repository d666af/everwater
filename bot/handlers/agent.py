from aiogram import Router, F
from aiogram.types import Message, ReplyKeyboardMarkup, KeyboardButton, WebAppInfo
from aiogram.filters import Command
from config import settings
import services.api_client as api

router = Router()


def _site(path: str) -> str:
    return f"{settings.MINI_APP_URL.rstrip('/')}{path}"


def agent_webapp_kb() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="📋 Оформить заказ", web_app=WebAppInfo(url=_site("/agent/checkout")))],
            [KeyboardButton(text="📜 История заказов", web_app=WebAppInfo(url=_site("/agent/orders")))],
        ],
        resize_keyboard=True,
    )


@router.message(Command("agent"))
async def agent_panel(message: Message):
    agent = await api.get_agent_by_telegram(message.from_user.id)
    if not agent:
        await message.answer("❌ Вы не зарегистрированы как агент.")
        return
    await message.answer(
        f"🤝 <b>Панель агента</b>\n\n"
        f"Имя: {agent.get('name', '—')}\n"
        f"Телефон: {agent.get('phone', '—')}",
        parse_mode="HTML",
        reply_markup=agent_webapp_kb(),
    )
