import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from handlers import start, admin, courier, client, manager, warehouse
from services.scheduler import setup_scheduler
from config import settings

logging.basicConfig(level=logging.INFO)


async def main():
    bot = Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()

    # Order matters: FSM-state handlers must beat catch-all text handlers.
    # start contains Registration FSM and review FSM — register first.
    dp.include_router(start.router)
    dp.include_router(admin.router)
    dp.include_router(manager.router)
    dp.include_router(warehouse.router)
    dp.include_router(courier.router)
    dp.include_router(client.router)  # catch-all text → support must be last

    setup_scheduler(bot)

    logging.info("Bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
