import pytz
from datetime import datetime
from telegram_bots.FreiFahren_BE_NLP.verify_info import verify_direction, verify_line
from telegram_bots.FreiFahren_BE_NLP.process_message import (
    find_line,
    find_direction,
    find_station,
    format_text,
    lines_with_stations,
    load_data,
    check_for_spam,
)
from telegram_bots.FreiFahren_BE_NLP.db_utils import insert_ticket_info
from telegram_bots.FreiFahren_BE_NLP.app import nlp_app
from telegram_bots.logger import setup_logger
from telegram_bots.FreiFahren_BE_NLP.bot import nlp_bot, start_bot
import traceback
import requests
import json
import sys
import threading
from telegram_bots.config import WATCHER_URL, BACKEND_URL


class TicketInspector:
    def __init__(self, line, station, direction):
        self.line = line
        self.station = station
        self.direction = direction


def extract_ticket_inspector_info(unformatted_text):
    # Initial guards to avoid unnecessary processing
    if "?" in unformatted_text or check_for_spam(unformatted_text):
        ticket_inspector = TicketInspector(line=None, station=None, direction=None)
        logger.info("Message is not getting processed")
        return ticket_inspector.__dict__

    found_line = find_line(unformatted_text, lines_with_stations)
    ticket_inspector = TicketInspector(line=found_line, station=None, direction=None)

    # Get the direction
    text = format_text(unformatted_text)
    found_direction = find_direction(text, ticket_inspector)[0]
    ticket_inspector.direction = found_direction

    # Pass the text without direction to avoid finding the direction again
    text_without_direction = find_direction(text, ticket_inspector)[1]
    found_station = find_station(text_without_direction, ticket_inspector)
    ticket_inspector.station = found_station

    # With the found info we can cross check the direction and line
    if found_line or found_station or found_direction:
        verify_direction(ticket_inspector, text)
        verify_line(ticket_inspector, text)

        return ticket_inspector.__dict__
    else:
        return None


stations_dict = load_data("data/stations_list_main.json")


def process_new_message(timestamp, message_text):
    info = extract_ticket_inspector_info(message_text)
    logger.info("Found information in the message: %s", info)

    if not isinstance(info, dict) or not any(info.get(key) for key in ["line", "station", "direction"]):
        logging.info("No valid information found in the message.")
        return
    
    # Retrieve IDs from backend
    station_id = fetch_id_from_backend(info.get("station"), "station")
    direction_id = fetch_id_from_backend(info.get("direction"), "direction")

    # Insert ticket information
    insert_ticket_info(timestamp, info.get("line"), station_id, direction_id)

def fetch_id_from_backend(name, entity_type):
    if not name:
        return None

    url = f"{BACKEND_URL}/data/id?name={name}"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
        
        data = response.json()
        station_id = data.get('id')
        
        if station_id:
            logger.info(f"Received {entity_type} id from the backend: {station_id}")
            return station_id
        else:
            logger.error(f"Unexpected response format from backend: {data}")
            return None

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            logger.info(f"Station not found: {e.response.json().get('error', 'No error message provided')}")
        else:
            logger.error(f"HTTP error occurred: {e}")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching {entity_type} id: {e}")
        return None
    except ValueError as e:  # Includes JSONDecodeError
        logger.error(f"Error decoding JSON response: {e}")
        return None


def handle_exception(exc_type, exc_value, exc_traceback):
    """Handle uncaught exceptions by sending a POST request with exception info."""
    error_message = "".join(
        traceback.format_exception(exc_type, exc_value, exc_traceback)
    )
    requests.post(WATCHER_URL, json={"error_message": error_message})
    logger.error("Unhandled exception", exc_info=(exc_type, exc_value, exc_traceback))


if __name__ == "__main__":
    logger = setup_logger()

    sys.excepthook = handle_exception
    utc = pytz.UTC

    logger.info("Bot is running...")

    @nlp_bot.message_handler(func=lambda message: message)
    def get_info(message):
        logger.info("------------------------")
        logger.info("MESSAGE RECEIVED")

        timestamp = datetime.fromtimestamp(message.date, utc)
        # Round the timestamp to the last minute
        timestamp = timestamp.replace(second=0, microsecond=0)

        process_new_message(timestamp, message.text)

    bot_thread = threading.Thread(target=start_bot)
    logger.info("Starting the nlp bot...")
    bot_thread.start()
    logger.info("Waitress serve NLP_BOT")

    from waitress import serve
    serve(nlp_app, host='0.0.0.0', port=6001)
    

