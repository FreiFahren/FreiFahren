from flask import Flask, request
from nlp_service.config.config import FREIFAHREN_CHAT_ID, RESTART_PASSWORD
from nlp_service.services.telegram_adapter import send_message
from nlp_service.utils.logger import setup_logger
from nlp_service.services.telegram_adapter import nlp_bot

import os, sys

logger = setup_logger()

flask_app = Flask(__name__)

@flask_app.route("/report-inspector", methods=["POST"])
def report_inspector() -> tuple:
    line = request.json.get("line", None)
    station = request.json.get("station", None)
    direction = request.json.get("direction", None)
    message = request.json.get("message", None)
    stationId = request.json.get("stationId", None)

    logger.info(
        f"Received a report from an inspector: Line: {line}, Station: {station}, Direction: {direction}, Message: {message}"
    )
    telegram_message = ""

    telegram_message += f"\n<b>Station</b>: {station}"
    if line:
        telegram_message += f"\n<b>Line</b>: {line}"
    if direction:
        telegram_message += f"\n<b>Richtung</b>: {direction}"
    if message:
        telegram_message += f"\nBeschreibung hier einsehbar: <a href='app.freifahren.org/?stationId={stationId}'>app.freifahren.org</a>"
    else:
        telegram_message += f"\n\nMehr Informationen auf <a href='app.freifahren.org/?stationId={stationId}'>app.freifahren.org</a>"

    send_message(FREIFAHREN_CHAT_ID, telegram_message, nlp_bot)

    return {"status": "success"}, 200

@flask_app.route("/restart", methods=["POST"])
def restart():
    if RESTART_PASSWORD == request.headers.get("X-Password"):
        logger.info("Restarting the natural language processing bot...")
        os.execv(sys.executable, ['python3', '-m', 'nlp_service.main'])
    else:
        return {"status": "error", "message": "Invalid password"}, 401