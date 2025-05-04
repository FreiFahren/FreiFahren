from nlp_service.config.config import NLP_BOT_TOKEN
from nlp_service.utils.logger import setup_logger
from nlp_service.core.processor import process_new_message

from telebot import TeleBot, types

import pytz
from datetime import datetime
import traceback

logger = setup_logger()

nlp_bot = TeleBot(NLP_BOT_TOKEN)

def bot_error_handler(exception):
            logger.error(f"NLP Bot Error: {str(exception)}")
            logger.error(traceback.format_exc())

# Register error handler for the bot
nlp_bot.logger = logger
nlp_bot.exception_handler = bot_error_handler

def send_message(chat_id: str,
                 text: str,
                 preview_url: str,
                 bot,
                 parse_mode: str = "HTML") -> None:

    try:
        lp_opts = types.LinkPreviewOptions(
            url=preview_url,
            prefer_large_media=True,
            show_above_text=False
        )

        bot.send_message(
            chat_id,
            text,
            parse_mode=parse_mode,
            link_preview_options=lp_opts
        )
    except Exception as e:
        logger.error(f"Failed to send message to chat {chat_id}: {e}")
        

# message handler for the nlp bot
@nlp_bot.message_handler(content_types=["text", "photo"])
def get_info(message):
    logger.info("------------------------")
    logger.info("MESSAGE RECEIVED")

    utc = pytz.UTC
    timestamp = datetime.fromtimestamp(message.date, utc).replace(
        second=0, microsecond=0
    )

    text = (
        message.text
        if message.content_type == "text"
        else (message.caption or "Image without description")
    )
    logger.info(f"Message received: {text} from chat id: {message.chat.id}")

    process_new_message(timestamp, text)

