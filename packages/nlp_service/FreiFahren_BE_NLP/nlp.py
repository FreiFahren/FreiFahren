from nlp_service.FreiFahren_BE_NLP.verify_info import verify_direction, verify_line
from nlp_service.FreiFahren_BE_NLP.process_message import (
    find_line,
    find_direction,
    find_station,
    format_text,
    lines,
    check_for_spam,
)
from nlp_service.FreiFahren_BE_NLP.db_utils import insert_ticket_info
from nlp_service.logger import setup_logger
from nlp_service.FreiFahren_BE_NLP.db_utils import fetch_id

logger = setup_logger()

MINIMUM_MESSAGE_LENGTH = 3

class TicketInspector:
    def __init__(self, line, station, direction):
        self.line = line
        self.station = station
        self.direction = direction


def extract_ticket_inspector_info(unformatted_text):
    if len(unformatted_text) < MINIMUM_MESSAGE_LENGTH:
        return None
    found_line = find_line(unformatted_text, lines)
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


def process_new_message(timestamp, message_text):
    # Initial guards to avoid unnecessary processing
    if "?" in message_text or check_for_spam(message_text):
        logger.info("Message is not getting processed")
        return None

    info = extract_ticket_inspector_info(message_text)
    logger.info("Found information in the message: %s", info)

    if isinstance(info, dict) and any(
        info.get(key) for key in ["line", "station", "direction"]
    ):
        # Retrieve Ids from backend
        station_id = fetch_id(info.get("station"), "station")
        direction_id = fetch_id(info.get("direction"), "direction")

        insert_ticket_info(timestamp, info.get("line"), station_id, direction_id)
    else:
        logger.info("No valid information found in the message.")
