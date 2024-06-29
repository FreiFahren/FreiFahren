import telebot
from config import DEV_BOT_TOKEN, DEV_BOT_CHAT_ID, DEV_CHAT_ID, NLP_BOT_URL, TELEGRAM_NEXT_CHECK_TIME
from logger import logger


watcherbot = telebot.TeleBot(DEV_BOT_TOKEN)

def start_bot():
    watcherbot.infinity_polling()

def send_message(chat_id: str, message: str) -> None:
    """Send a message to a user or chat id.

    Args:
        user_id (int): The ID of the user or chat id.
        message (str): The message to send.
    """
    try:
        watcherbot.send_message(chat_id, message)
    except Exception as e:
        logger.error(f'Failed to send message to user {chat_id}: {e}')
