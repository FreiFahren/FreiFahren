import os
import requests
import telebot
from dotenv import load_dotenv
from logger import setup_logger
from flask import Flask, request
import threading
import time
import queue

app = Flask(__name__)

load_dotenv()

DEV_BOT_TOKEN = os.getenv('DEV_BOT_TOKEN')
BACKEND_URL = os.getenv('BACKEND_URL')
DEV_CHAT_ID = os.getenv('DEV_CHAT_ID')
***REMOVED***

TELEGRAM_NEXT_CHECK_TIME = 60
TELEGRAM_TIMEOUT = 5
TELEGRAM_CHECKING_MESSAGE = 'Hey, are you alive?'
TELEGRAM_RESPONSE_MESSAGE = 'Yes, I am alive'

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


# curl -X POST -H "Content-Type: application/json" -d '{"error_message":"Test error message"}' http://127.0.0.1:5000/backend-failure
@app.route('/failure-report', methods=['POST'])
def backend_failure() -> tuple:
    system_name = request.json.get('system_name', '')
    error_message = request.json.get('error_message', '')
    
    watcherbot.send_message(DEV_CHAT_ID, f'{system_name} send an error message: {error_message}')
    logger.error(f'Received {system_name} failure: {error_message}')
    
    return {'status': 'success'}, 200


def check_backend_status() -> None:
    while True:
        errorlist, _ = do_backend_healthcheck()
        if errorlist:
            try:
                watcherbot.send_message(DEV_CHAT_ID, 'Backend is not healthy! Please check the logs for more information.')
            except Exception as e:
                logger.error(f'Failed to send message: {e}')
        time.sleep(20)


def handle_telegram_bot_status_message(message, response_queue) -> None:
    if message.text == TELEGRAM_RESPONSE_MESSAGE:
        response_queue.put(True)
        send_message(DEV_CHAT_ID,  'Woohoo! The bot is alive! Next check in 20 minutes')


def do_telegram_bot_healthcheck() -> None:
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


def ping_backend() -> tuple:
    start_time = time.time()
    response = requests.get(BACKEND_URL)
    end_time = time.time()
    request_time = end_time - start_time
    
    return response, request_time


def do_backend_healthcheck() -> tuple:
    errorlist = []
    request_time = 0
    
    try:
        response = requests.get(BACKEND_URL)
        response.raise_for_status()
    except requests.exceptions.HTTPError as errh:
        errorlist.append(errh)
        logger.error(f'Http Error: {errh}')
    except requests.exceptions.ConnectionError as errc:
        errorlist.append(errc)
        logger.error(f'Error Connecting: {errc}')
    except requests.exceptions.Timeout as errt:
        errorlist.append(errt)
        logger.error(f'Timeout Error: {errt}')
    except requests.exceptions.RequestException as err:
        errorlist.append(err)
        logger.error(f'Request Exception: {err}')
    else:
        response, request_time = ping_backend()
        logger.info(f'Backend is healthy. The request took {round(request_time * 1000,1)} seconds with {response}.')
    
    return errorlist, request_time


def start_watcher_threads():
    bot_thread = threading.Thread(target=start_bot)
    backend_health_thread = threading.Thread(target=check_backend_status)
    check_telegram_status_thread = threading.Thread(target=do_telegram_bot_healthcheck)

    bot_thread.start()
    backend_health_thread.start()
    check_telegram_status_thread.start()
    

if __name__ == '__main__':
    logger = setup_logger()

    @watcherbot.message_handler(commands=['checkhealth'])
    def healthcheck(message):
        watcherbot.send_message(message.chat.id, 'Checking the backend health...')

        backend_errlist, request_time = do_backend_healthcheck()
        if backend_errlist:
            watcherbot.send_message(message.chat.id, f'Backend is not healthy! Please check the logs for more information. The request took {request_time * 1000} milliseconds and failed with {backend_errlist}.')
        else:
            watcherbot.send_message(message.chat.id, f'Backend is healthy! The request took {request_time * 1000} milliseconds.')
        
        
        
    start_watcher_threads()
    

    # Start the Flask app in the main thread
    app.run(port=5000)