import asyncio
import logging
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties
from aiogram.types import ErrorEvent, BotCommand, BotCommandScopeChat, ReplyKeyboardRemove
from handlers import start, admin, courier, client, manager, warehouse, agent, invoice
from services.scheduler import setup_scheduler
from services.roles import load_secondary_admins
from config import settings

logging.basicConfig(level=logging.INFO)


async def main():
    bot = Bot(
        token=settings.BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()

    # invoice.router MUST be first: it silently drops ALL messages from the invoice
    # group so no other router ever sees them (prevents /start, text, etc. responses).
    dp.include_router(invoice.router)
    dp.include_router(start.router)
    dp.include_router(manager.router)
    dp.include_router(admin.router)
    dp.include_router(warehouse.router)
    dp.include_router(courier.router)
    dp.include_router(agent.router)
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

    await load_secondary_admins()

    setup_scheduler(bot)

    if settings.INVOICE_GROUP_ID:
        # Clear command menu for the invoice group
        try:
            await bot.set_my_commands(
                [],
                scope=BotCommandScopeChat(chat_id=settings.INVOICE_GROUP_ID),
            )
        except Exception as e:
            logging.warning("Could not clear commands for invoice group: %s", e)
        # Remove any lingering reply keyboard left from previous bot interactions
        try:
            msg = await bot.send_message(
                settings.INVOICE_GROUP_ID,
                "​",  # zero-width space — invisible text
                reply_markup=ReplyKeyboardRemove(),
            )
            await bot.delete_message(settings.INVOICE_GROUP_ID, msg.message_id)
        except Exception as e:
            logging.warning("Could not clear reply keyboard in invoice group: %s", e)

    logging.info("Bot started")
    await dp.start_polling(
        bot,
        allowed_updates=['message', 'callback_query', 'my_chat_member', 'chat_member'],
    )


if __name__ == "__main__":
    asyncio.run(main())
