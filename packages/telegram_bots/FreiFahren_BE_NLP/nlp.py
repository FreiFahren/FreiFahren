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
from telegram_bots.logger import setup_logger

logger = setup_logger()


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
        station_id = fetch_id(info.get("station"), "station")
        direction_id = fetch_id(info.get("direction"), "direction")

        insert_ticket_info(
            timestamp,
            info.get("line"),
            info.get("station"),
            info.get("direction")
        )
    else:
        logger.info("No line, station or direction found in the message")
