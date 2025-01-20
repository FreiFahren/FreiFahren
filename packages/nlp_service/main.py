from nlp_service.config import FREIFAHREN_CHAT_ID, SENTRY_DSN
from nlp_service.FreiFahren_BE_NLP.nlp import process_new_message
from nlp_service.logger import setup_logger
from telebot import TeleBot
from nlp_service.config import NLP_BOT_TOKEN, RESTART_PASSWORD

from flask import Flask, request
from datetime import datetime
from waitress import serve
import traceback
import pytz
import sys
import threading
import os

import sentry_sdk

sentry_sdk.init(
    dsn=SENTRY_DSN,
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,
    # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,
)

app = Flask(__name__)
logger = setup_logger()

nlp_bot = TeleBot(NLP_BOT_TOKEN)

def send_message(chat_id: str, message: str, bot, parse_mode='HTML') -> None:
    """Send a message to a user or chat id.

    Args:
        user_id (int): The Id of the user or chat id.
        message (str): The message to send.
        bot (telebot.TeleBot): The bot to use to send the message.
    """

    try:
        bot.send_message(chat_id, message, parse_mode=parse_mode)
    except Exception as e:
        logger.error(f'Failed to send message to user {chat_id}: {e}')
        

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


@app.route("/report-inspector", methods=["POST"])
def report_inspector() -> tuple:
    line = request.json.get("line", None)
    station = request.json.get("station", None)
    direction = request.json.get("direction", None)
    message = request.json.get("message", None)

    logger.info(
        f"Received a report from an inspector: Line: {line}, Station: {station}, Direction: {direction}, Message: {message}"
    )

    telegram_message = "Über app.freifahren.org gab es folgende Meldung:"
    telegram_message += "\n"
    telegram_message += f"\n<b>Station</b>: {station}"
    if line:
        telegram_message += f"\n<b>Line</b>: {line}"
    if direction:
        telegram_message += f"\n<b>Richtung</b>: {direction}"
    if message:
        telegram_message += f"\n<b>Beschreibung</b>: {message}"

    send_message(FREIFAHREN_CHAT_ID, telegram_message, nlp_bot)

    return {"status": "success"}, 200

@app.route("/restart", methods=["POST"])
def restart():
    if RESTART_PASSWORD == request.headers.get("X-Password"):
        logger.info("Restarting the natural language processing bot...")
        os.execv(sys.executable, ['python3', '-m', 'nlp_service.main'])
    else:
        return {"status": "error", "message": "Invalid password"}, 401

if __name__ == "__main__":
    try:
       
        logger.info("Starting the natural language processing bot...")

        def bot_error_handler(exception):
            logger.error(f"NLP Bot Error: {str(exception)}")
            logger.error(traceback.format_exc())

        # Register error handler for the bot
        nlp_bot.logger = logger
        nlp_bot.exception_handler = bot_error_handler

        # Start the NLP bot polling in a thread
        bot_thread = threading.Thread(target=lambda: nlp_bot.polling(non_stop=True, timeout=60))
        bot_thread.daemon = True  # This ensures the thread will be killed when the main program exits
        bot_thread.start()

        # Run the Flask app in the main thread
        logger.info("Starting the Flask server...")
        serve(app, host="0.0.0.0", port=6000)

    except Exception as e:
        error_message = f"Error in natural language processing bot: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_message)
        sys.exit(1)



