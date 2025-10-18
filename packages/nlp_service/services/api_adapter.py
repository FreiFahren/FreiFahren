from flask import Flask, request, send_from_directory
from nlp_service.config.config import FREIFAHREN_CHAT_ID, RESTART_PASSWORD
from nlp_service.services.telegram_adapter import send_message, send_webapp_button
from nlp_service.utils.logger import setup_logger
from nlp_service.services.telegram_adapter import nlp_bot
import json
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
        telegram_message += f"\n<b>Beschreibung</b>: hier einsehbar <a href='https://app.freifahren.org/station/{stationId}'>app.freifahren.org</a>"
    else:
        telegram_message += f"\n\nMehr Informationen auf <a href='https://app.freifahren.org/station/{stationId}'>app.freifahren.org</a>"

    station_url = f"https://app.freifahren.org/station/{stationId}" # allow telegram to automatically create a preview card


   # send_message(FREIFAHREN_CHAT_ID, telegram_message, station_url, nlp_bot)

    return {"status": "success"}, 200

@flask_app.route("/restart", methods=["POST"])
def restart():
    if RESTART_PASSWORD == request.headers.get("X-Password"):
        logger.info("Restarting the natural language processing bot...")
        os.execv(sys.executable, ['python3', '-m', 'nlp_service.main'])
    else:
        return {"status": "error", "message": "Invalid password"}, 401

@flask_app.route("/mini-app", methods=["GET"])
def serve_mini_app():
    """Serve the Telegram Mini App HTML file"""
    static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
    return send_from_directory(static_dir, "mini_app.html")

@flask_app.route("/mini-app/report", methods=["POST"])
def handle_mini_app_data():
    """Handle data submitted from the Mini App"""
    try:
        # Get the telegram init data for validation
        init_data = request.headers.get("X-Telegram-Init-Data", "")
        
        # Parse the submitted data
        data = request.json
        line = data.get("line", "")
        station = data.get("station", "")
        direction = data.get("direction", "")
        message = data.get("message", "")
        stationId = data.get("stationId", "")
        
        logger.info(f"Received Mini App data: {data}")
        
        
        # Format the report message
        telegram_message = ""
        telegram_message += f"\n<b>Station</b>: {station}"
        if line:
            telegram_message += f"\n<b>Line</b>: {line}"
        if direction:
            telegram_message += f"\n<b>Richtung</b>: {direction}"
        if message:
            telegram_message += f"\n<b>Beschreibung</b>: hier einsehbar <a href='https://app.freifahren.org/station/{stationId}'>app.freifahren.org</a>"
        else:
            telegram_message += f"\nMehr Informationen auf <a href='https://app.freifahren.org/station/{stationId}'>app.freifahren.org</a>"
        telegram_message += f"\n\nDas ist eine Meldung aus der <b>Telegram Mini App</b>. \n"
        telegram_message += f"Um auch in Telegram zu melden: \nTippe auf mein Profilbild und dann auf \"App öffnen\""


        
        # Send the message to the FreiFahren chat
        station_url = f"https://app.freifahren.org/station/{stationId}" # allow telegram to automatically create a preview card
        send_message(FREIFAHREN_CHAT_ID, telegram_message, station_url, nlp_bot)
        
        return {"status": "success"}, 200
    
    except Exception as e:
        logger.error(f"Error handling Mini App data: {str(e)}")
        return {"status": "error", "message": str(e)}, 500

@flask_app.route("/send-mini-app", methods=["POST"])
def send_mini_app():
    """Send a Mini App button to a user"""
    try:
        chat_id = request.json.get("chat_id")
        if not chat_id:
            return {"status": "error", "message": "chat_id is required"}, 400
        
        # The URL where your Mini App is hosted
        webapp_url = request.json.get("webapp_url", request.url_root + "mini-app")
        button_text = request.json.get("button_text", "Open Mini App")
        message_text = request.json.get("message_text", "Click the button below to report inspectors:")
        
        # Send the Mini App button
        send_webapp_button(chat_id, message_text, button_text, webapp_url)
        
        return {"status": "success"}, 200
    
    except Exception as e:
        logger.error(f"Error sending Mini App: {str(e)}")
        return {"status": "error", "message": str(e)}, 500