from flask import Flask, request
from telebot import TeleBot
from waitress import serve
from telegram_bots.config import (
    DEV_CHAT_ID, 
    BACKEND_URL, 
    TELEGRAM_NEXT_CHECK_TIME,
    TELEGERAM_BOTS_URL
)
from telegram_bots.watcher.healthcheck import do_healthcheck, check_backend_status, check_nlp_bot_status
from telegram_bots.FreiFahren_BE_NLP.nlp import process_new_message
from telegram_bots.logger import setup_logger
from telegram_bots.bot_utils import send_message
from telegram_bots.bots import watcher_bot, nlp_bot

from datetime import datetime
import traceback
import threading
import requests
import time
import pytz
import sys


app = Flask(__name__)
logger = setup_logger()


@nlp_bot.message_handler(func=lambda message: True)
def get_info(message):
    logger.info("------------------------")
    logger.info("MESSAGE RECEIVED")

    utc = pytz.UTC
    timestamp = datetime.fromtimestamp(message.date, utc)
    timestamp = timestamp.replace(second=0, microsecond=0)

    process_new_message(timestamp, message.text)

@watcher_bot.message_handler(commands=['checkhealth'])
def healthcheck(message):
    send_message(message.chat.id, 'Checking the backend health...', watcher_bot)

    backend_errlist, request_time = do_healthcheck(BACKEND_URL)
    if backend_errlist:
        send_message(message.chat.id, f'Backend is not healthy!\nPlease check the logs for more information. \nThe request took {request_time * 1000} milliseconds and failed with: {backend_errlist}.', watcher_bot)
    else:
        send_message(message.chat.id, f'Backend is healthy!\nThe request took {request_time * 1000} milliseconds.', watcher_bot)

    send_message(message.chat.id, 'Checking the NLP bot health...', watcher_bot)
    
    nlp_errlist, request_time = do_healthcheck(TELEGERAM_BOTS_URL + '/healthcheck')
    if nlp_errlist:
        send_message(message.chat.id, f'NLP bot is not healthy!\nPlease check the logs for more information.\nThe request took {request_time * 1000} milliseconds and failed with: {nlp_errlist}.', watcher_bot)
    else:
        send_message(message.chat.id, f'NLP bot is healthy!\n The request took {request_time * 1000} milliseconds.', watcher_bot)


# Flask routes
@app.route('/healthcheck', methods=['GET']) # Inorder to check if the nlp_bot is healthy
def healthcheck_endpoint():
    return {'status': 'success'}, 200

@app.route('/report-inspector', methods=['POST'])
def report_inspector() -> tuple:
    line = request.json.get('line', None)
    station = request.json.get('station', None)
    direction = request.json.get('direction', None)
    message = request.json.get('message', None)

    logger.info(f'Received a report from an inspector: Line: {line}, Station: {station}, Direction: {direction}, Message: {message}')

    telegram_message = 'Über app.freifahren.org gab es folgende Meldung:'
    telegram_message += '\n'
    telegram_message += f'\n<b>Station</b>: {station}'
    if line:
        telegram_message += f'\n<b>Line</b>: {line}'
    if direction:
        telegram_message += f'\n<b>Richtung</b>: {direction}'
    if message:
        telegram_message += f'\n<b>Beschreibung</b>: {message}'
    
    # commented due to not being released yet
    #send_message(FREIFAHREN_CHAT_ID, telegram_message, nlp_bot)

    return {'status': 'success'}, 200

@app.route('/report-failure', methods=['POST'])
def report_failure():
    console_line = request.json.get('console_line', '')
    system = request.json.get('system', '')
    
    error_message = f"Error in {system}: {console_line}"
    logger.error(error_message)
    send_message(DEV_CHAT_ID, error_message, watcher_bot)
    
    return {'status': 'success'}, 200


# save running helper functions
def thread_exception_handler(args):
    if isinstance(args, threading.ExceptHookArgs):
        exc_type, exc_value, exc_traceback = args.exc_type, args.exc_value, args.exc_traceback
    else:
        exc_type, exc_value, exc_traceback = sys.exc_info()
    
    logger.error("Uncaught exception in thread:", 
                 exc_info=(exc_type, exc_value, exc_traceback))
    send_message(DEV_CHAT_ID, f"Uncaught exception in thread: {exc_value}", watcher_bot)

def run_safely(func):
    try:
        func()
    except Exception as e:
        logger.error(f"Error in thread {threading.current_thread().name}: {str(e)}", exc_info=True)
        send_message(DEV_CHAT_ID, f"Error in thread {threading.current_thread().name}: {str(e)}", watcher_bot)


if __name__ == '__main__':
    try:
        logger.info("Starting the combined bot...")
        
        # Set up global exception handler for threads
        threading.excepthook = thread_exception_handler
        
        # Start the NLP bot polling in a separate thread
        nlp_thread = threading.Thread(target=lambda: run_safely(nlp_bot.polling), daemon=True, name="NLP Bot")
        nlp_thread.start()
        
        # Start the watcher bot polling in a separate thread
        watcher_thread = threading.Thread(target=lambda: run_safely(watcher_bot.polling), daemon=True, name="Watcher Bot")
        watcher_thread.start()
        
        # Start health check threads
        backend_health_thread = threading.Thread(target=lambda: run_safely(check_backend_status), daemon=True, name="Backend Health Check")
        nlp_health_thread = threading.Thread(target=lambda: run_safely(check_nlp_bot_status), daemon=True, name="NLP Health Check")
        backend_health_thread.start()
        nlp_health_thread.start()
        
        # Run the Flask app
        logger.info("Starting the Flask server...")
        serve(app, host='0.0.0.0', port=6000)

    except Exception as e:
        error_message = f"Error in combined bot: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_message)
        requests.post(f"{BACKEND_URL}/report-failure", json={"console_line": error_message, "system": "combined_bot"})
        sys.exit(1)  # Exit with error code

# to keep the main thread running
    while True:
        time.sleep(10)