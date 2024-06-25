import os
import telebot
import pytz
from datetime import datetime
from dotenv import load_dotenv
from verify_info import verify_direction, verify_line
from process_message import (
    find_line,
    find_direction,
    find_station,
    format_text,
    lines_with_stations,
    load_data,
    check_for_spam
)
from db_utils import create_table_if_not_exists, insert_ticket_info
from logging_utils import setup_logger


class TicketInspector:
    def __init__(self, line, station, direction):
        self.line = line
        self.station = station
        self.direction = direction


def extract_ticket_inspector_info(unformatted_text):
    # Initial guards to avoid unnecessary processing
    if '?' in unformatted_text or check_for_spam(unformatted_text):
        ticket_inspector = TicketInspector(line=None, station=None, direction=None)
        logger.info('Message is not getting processed')
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


stations_dict = load_data('data/stations_list_main.json')

def process_new_message(timestamp, message):
    info = extract_ticket_inspector_info(message.text)
    if (type(info) is dict):
        if info.get('line') or info.get('station') or info.get('direction'):
            logger.info('Found Info:\nLine:\t\t%s\nStation:\t%s\nDirection:\t%s', info.get('line'), info.get('station'), info.get('direction'))

            insert_ticket_info(
                timestamp,
                info.get('line'),
                info.get('station'),
                info.get('direction'),
            )
    else:
        logger.info('No info found')


if __name__ == '__main__':
    logger = setup_logger()

    load_dotenv()
    BOT_TOKEN = os.getenv('BOT_TOKEN')
    BACKEND_URL = os.getenv('BACKEND_URL')

    utc = pytz.UTC
    
    bot = telebot.TeleBot(BOT_TOKEN)

    create_table_if_not_exists()

    logger.info('Bot is running...')
    print('Bot is running...')

    DEV_CHAT_ID = os.getenv('DEV_CHAT_ID')
    FREIFAHREN_BE_CHAT_ID = os.getenv('FREIFAHREN_BE_CHAT_ID')

    @bot.message_handler(func=lambda message: message)
    def get_info(message):
        logger.info('Message received')
        timestamp = datetime.fromtimestamp(message.date, utc)
        # Round the timestamp to the last minute
        timestamp = timestamp.replace(second=0, microsecond=0)
            
        process_new_message(timestamp, message)

    bot.infinity_polling()
