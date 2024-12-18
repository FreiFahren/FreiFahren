from telegram_bots.config import FREIFAHREN_CHAT_ID
from telegram_bots.bot_utils import send_message
from telegram_bots.restart_utils import (
    RestartableThread,
    MAX_RESTARTS,
    run_safely,
    thread_exception_handler,
)
from telegram_bots.FreiFahren_BE_NLP.nlp import process_new_message
from telegram_bots.logger import setup_logger
from telegram_bots.bots import nlp_bot

from flask import Flask, request
from datetime import datetime
from waitress import serve
import traceback
import threading
import time
import pytz
import sys


app = Flask(__name__)
logger = setup_logger()


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


@app.route("/report-inspector", methods=["POST"])
def report_inspector() -> tuple:
    line = request.json.get("line", None)
    station = request.json.get("station", None)
    direction = request.json.get("direction", None)
    message = request.json.get("message", None)

    logger.info(
        f"Received a report from an inspector: Line: {line}, Station: {station}, Direction: {direction}, Message: {message}"
    )

    telegram_message = "Über app.freifahren.org/invite gab es folgende Meldung:"
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


if __name__ == "__main__":
    try:
        logger.info("Starting the combined bot...")

        # Set up global exception handler for threads
        threading.excepthook = thread_exception_handler

        # Start the NLP bot polling in a separate thread
        nlp_thread = RestartableThread(
            target=lambda: run_safely(nlp_bot.polling, "NLP Bot"), name="NLP Bot"
        )
        nlp_thread.start()

        # Run the Flask app
        logger.info("Starting the Flask server...")
        serve(app, host="0.0.0.0", port=6000)

    except Exception as e:
        error_message = f"Error in combined bot: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_message)
        sys.exit(1)  # Exit with error code

    # Keep the main thread running and monitor other threads
    while True:
        time.sleep(10)
        if not nlp_thread.is_alive() and nlp_thread.restart_count >= MAX_RESTARTS:
            logger.critical(
                f"Thread {nlp_thread.name} is dead and cannot be restarted. Exiting program."
            )
            sys.exit(1)
