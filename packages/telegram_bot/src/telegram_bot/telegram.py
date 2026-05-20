import logging
from collections.abc import Awaitable, Callable

from telegram import Update
from telegram.ext import Application, ContextTypes, filters
from telegram.ext import MessageHandler as TgMessageHandler

logger = logging.getLogger(__name__)


TelegramCallback = Callable[[Update, ContextTypes.DEFAULT_TYPE], Awaitable[None]]
TextHandler = Callable[[str], Awaitable[None]]


def log_incoming_message(update: Update, text: str) -> None:
    chat = update.effective_message.chat if update.effective_message else None
    logger.info(
        'Received message from chat %s (%s): %r',
        chat.id if chat else None,
        chat.title or chat.username if chat else None,
        text,
    )


def message_report_text(message) -> str | None:
    return message.text or message.caption


def telegram_text_callback(handle_text: TextHandler) -> TelegramCallback:
    async def handle(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        del context  # Required by the Telegram callback signature.

        message = update.effective_message
        text = message_report_text(message) if message is not None else None
        if not text:
            return

        log_incoming_message(update, text)
        await handle_text(text)

    return handle


def build_telegram_app(*, token: str, handle_text: TextHandler) -> Application:
    app = Application.builder().token(token).build()
    app.add_handler(TgMessageHandler((filters.TEXT | filters.CAPTION) & ~filters.COMMAND, telegram_text_callback(handle_text)))
    return app
