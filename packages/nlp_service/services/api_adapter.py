from flask import Flask, request
from nlp_service.config.config import FREIFAHREN_CHAT_ID, REPORT_PASSWORD, RESTART_PASSWORD
from nlp_service.services.telegram_adapter import send_message
from nlp_service.utils.logger import get_logger
from nlp_service.services.telegram_adapter import nlp_bot

import os, sys

logger = get_logger()

flask_app = Flask(__name__)

@flask_app.route("/report-inspector", methods=["POST"])
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

@flask_app.route("/restart", methods=["POST"])
def restart():
    if RESTART_PASSWORD == request.headers.get("X-Password"):
        logger.info("Restarting the natural language processing bot...")
        os.execv(sys.executable, ['python3', '-m', 'nlp_service.main'])
    else:
        return {"status": "error", "message": "Invalid password"}, 401