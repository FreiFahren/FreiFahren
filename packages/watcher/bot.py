import telebot
from config import DEV_BOT_TOKEN, DEV_CHAT_ID, USER_IDS, TELEGRAM_TIMEOUT, TELEGRAM_CHECKING_MESSAGE, TELEGRAM_NEXT_CHECK_TIME, TELEGRAM_RESPONSE_MESSAGE
import queue
import time
from logger import logger


watcherbot = telebot.TeleBot(DEV_BOT_TOKEN)

def start_bot():
    watcherbot.infinity_polling()

def send_message(user_id: str, message: str) -> None:
    """Send a message to a user or chat id.

    Args:
        user_id (int): The ID of the user or chat id.
        message (str): The message to send.
    """
    try:
        watcherbot.send_message(user_id, message)
    except Exception as e:
        logger.error(f'Failed to send message to user {user_id}: {e}')


def handle_telegram_bot_status_message(message, response_queue) -> None:
    """Handle the response from the Telegram bot.

    Args:
        message (Message): The incoming message.
        response_queue (Queue): The queue to put the response status in.
    """
    if message.text == TELEGRAM_RESPONSE_MESSAGE:
        response_queue.put(True)
        send_message(DEV_CHAT_ID,  'Woohoo! The bot is alive! Next check in 20 minutes')

def do_telegram_bot_healthcheck() -> None:
    """Asks if the Telegram bot is alive every 60 seconds. 
        If the bot is not alive, it sends a message to the users.
        If the bot is alive, it waits 20 minutes before asking again.
    """
    waiting_time = TELEGRAM_NEXT_CHECK_TIME
    while True:
        try:
            response_queue = queue.Queue()
            sent_message = watcherbot.send_message(DEV_CHAT_ID, TELEGRAM_CHECKING_MESSAGE)
            watcherbot.register_next_step_handler(sent_message, handle_telegram_bot_status_message, response_queue)
            
            # Wait for 5 seconds for a response
            try:
                response_queue.get(timeout=TELEGRAM_TIMEOUT)
            except queue.Empty:
                # If no response was received within 5 seconds, send a message to each user
                send_message(DEV_CHAT_ID, 'The bot is dead')
                for user_id in USER_IDS:
                    send_message(user_id, f'The bot is dead and did not respond in time. Please check the logs.')

            time.sleep(waiting_time)

        except Exception as e:
            logger.error(f'Failed to send message: {e}')