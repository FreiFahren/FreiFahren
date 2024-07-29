from flask import Flask, request
from telegram_bots.config import DEV_CHAT_ID
from telegram_bots.bot_utils import send_message
from telegram_bots import logger
from telegram_bots.watcher.bot import watcher_bot
from telegram_bots.watcher.healthcheck import check_nlp_bot_status

watcher_app = Flask(__name__)
logger = logger.setup_logger()

def handle_nlp_bot_error(console_line):
    """
    Handles the error message from the NLP bot's console output.
    By sending the error message to the developer chat, logging it and printing it to the console.
    """
    print(console_line) # for debugging
    error_message = "Error detected in NLP_Bot's output: " + console_line
    logger.error(error_message)
    send_message(DEV_CHAT_ID, error_message, watcher_bot)
    check_nlp_bot_status()

@watcher_app.route('/report-failure', methods=['POST'])
def backend_failure() -> tuple:
    error_message = request.json.get('error_message', '')
    handle_nlp_bot_error(error_message)

    return {'status': 'success'}, 200


