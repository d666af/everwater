import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from handlers import start, admin, courier, client
from services.scheduler import setup_scheduler
from config import settings

logging.basicConfig(level=logging.INFO)


async def main():
    bot = Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()

    dp.include_router(client.router)
    dp.include_router(start.router)
    dp.include_router(admin.router)
    dp.include_router(courier.router)

    setup_scheduler(bot)

    logging.info("Bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
