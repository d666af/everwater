import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.types import ErrorEvent
from handlers import start, admin, courier, client, manager, warehouse, agent, invoice
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
    # manager before admin so admin+manager users hit manager handlers first
    # (manager handlers carry _IsManagerFilter so admin-only users pass through).
    dp.include_router(start.router)
    dp.include_router(manager.router)
    dp.include_router(admin.router)
    dp.include_router(warehouse.router)
    dp.include_router(courier.router)
    dp.include_router(agent.router)
    dp.include_router(invoice.router)  # group photo handler (INVOICE_GROUP_ID)
    dp.include_router(client.router)  # catch-all text → support must be last

    @dp.errors()
    async def global_error_handler(event: ErrorEvent) -> bool:
        """Catch any unhandled exception, log it, and nudge the user back to the menu."""
        logging.exception(
            "Unhandled error on update %s", event.update.update_id,
            exc_info=event.exception,
        )
        upd = event.update
        msg = None
        if upd.message:
            msg = upd.message
        elif upd.callback_query:
            msg = upd.callback_query.message
        if msg:
            try:
                await msg.answer("⚠️ Что-то пошло не так. Нажмите /menu для возврата в меню.")
            except Exception:
                pass
        return True  # mark as handled so aiogram doesn't re-raise

    setup_scheduler(bot)

    logging.info("Bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
