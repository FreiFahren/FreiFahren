import telebot
from config import DEV_BOT_TOKEN, DEV_BOT_CHAT_ID, DEV_CHAT_ID, NLP_BOT_URL, TELEGRAM_NEXT_CHECK_TIME, TELEGRAM_RESPONSE_MESSAGE
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


def handle_nlp_bot_status_message(message, response_queue) -> None:
    """Handle the response from the Telegram bot.

    Args:
        message (Message): The incoming message.
        response_queue (Queue): The queue to put the response status in.
    """
    if message.text == TELEGRAM_RESPONSE_MESSAGE:
        response_queue.put(True)
        send_message(DEV_BOT_CHAT_ID,  'Woohoo! The bot is alive! Next check in 20 minutes')

def do_nlp_bot_healthcheck() -> None:
    """Pings the NLP bot's healthcheck endpoint every 60 seconds. 
        If the bot is not alive, it sends a message to the users.
        If the bot is alive, it waits 20 minutes before pinging again.
    """
    waiting_time = TELEGRAM_NEXT_CHECK_TIME
    while True:
        try:
            do_healthcheck(NLP_BOT_URL)

        except Exception as e:
            send_message(DEV_CHAT_ID, f'Failed to check the NLP bot status: {e}')
            logger.error(f'Failed to check the NLP bot status: {e}')