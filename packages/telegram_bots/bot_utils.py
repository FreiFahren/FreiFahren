from telegram_bots.config import DEV_CHAT_ID
from telegram_bots.bots import watcher_bot
from telegram_bots import logger

logger = logger.setup_logger()

def send_message(chat_id: str, message: str, bot) -> None:
    """Send a message to a user or chat id.

    Args:
        user_id (int): The ID of the user or chat id.
        message (str): The message to send.
        bot (telebot.TeleBot): The bot to use to send the message.
    """

    try:
        bot.send_message(chat_id, message)
    except Exception as e:
        logger.error(f'Failed to send message to user {chat_id}: {e}')
        
def report_failure_to_devs(system: str, console_line: str) -> None:
    """
    Report a failure to the developers

    Args:
        system: The system where the failure occurred
        console_line: The console line where the failure occurred
    """
    error_message = f"Error in {system}: {console_line}"
    logger.error(error_message)
    send_message(DEV_CHAT_ID, error_message, watcher_bot)
