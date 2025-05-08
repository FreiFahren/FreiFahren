from nlp_service.config.config import NLP_BOT_TOKEN, MINI_APP_SERVER_URL
from nlp_service.utils.logger import setup_logger
from nlp_service.core.processor import process_new_message

from telebot import TeleBot
from telebot.types import WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton

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
        logger.error(f'Failed to send message to user {chat_id}: {e}')

def send_webapp_button(chat_id: str, text: str, button_text: str, webapp_url: str) -> None:
    """Send a message with a button that opens a Mini App.
    
    Args:
        chat_id (str): The ID of the user or chat.
        text (str): The message text to accompany the button.
        button_text (str): The text displayed on the button.
        webapp_url (str): The URL of the Mini App.
    """
    try:
        markup = InlineKeyboardMarkup()
        markup.add(InlineKeyboardButton(
            text=button_text,
            web_app=WebAppInfo(url=webapp_url)
        ))
        nlp_bot.send_message(chat_id, text, reply_markup=markup)
    except Exception as e:
        logger.error(f'Failed to send webapp button to chat {chat_id}: {e}')

# Handler for the /start command
@nlp_bot.message_handler(commands=['start'])
def handle_start_command(message):
    """Handle the /start command by sending a welcome message with the Mini App button."""
    logger.info(f"Start command received from chat id: {message.chat.id}")
    
    # Send welcome message with Mini App button
    chat_id = message.chat.id
    welcome_text = "Willkommen 👋 Nutze den Button unten um Kontrolleure zu melden:\n\n Welcome 👋 Use the button below to report inspectors:"
    button_text = "Kontrolleure melden / Report inspectors"
    
    # Use the configured server URL from config
    webapp_url = f"{MINI_APP_SERVER_URL}/mini-app"
    
    # Send the Mini App button
    send_webapp_button(chat_id, welcome_text, button_text, webapp_url)

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

    process_new_message(timestamp, text)

