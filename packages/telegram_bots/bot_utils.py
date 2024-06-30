import telebot
from telegram_bots.config import DEV_BOT_TOKEN
from telegram_bots import logger
from telegram_bots.watcher.bot import watcher_bot

logger = logger.setup_logger()

def send_message(chat_id: str, message: str, bot) -> None:
    """Send a message to a user or chat id.

    Args:
        user_id (int): The ID of the user or chat id.
        message (str): The message to send.
        bot (telebot.TeleBot): The bot to use to send the message.
    """
    try:
        bot.send_message(chat_id, message, parse_mode='Markdown')
    except Exception as e:
        logger.error(f'Failed to send message to user {chat_id}: {e}')
