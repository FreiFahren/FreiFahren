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
from telegram_bots.watcher.app import handle_nlp_bot_error
import traceback
import requests
import sys
import threading
from telegram_bots.config import WATCHER_URL


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


def process_new_message(timestamp, message):
    info = extract_ticket_inspector_info(message.text)
    if type(info) is dict:
        found_items = []
        if info.get("line"):
            found_items.append("line")
        if info.get("station"):
            found_items.append("station")
        if info.get("direction"):
            found_items.append("direction")

        # Avoid logging the actual data to avoid storing data with which the user could be identified
        if found_items:
            logger.info("Found Info: %s", ", ".join(found_items))

            insert_ticket_info(
                timestamp,
                info.get("line"),
                info.get("station"),
                info.get("direction"),
            )
    else:
        logger.info("No line, station or direction found in the message")
