import os
import telebot
import pytz
from datetime import datetime, timedelta
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
from verify_info import handle_get_off


class TicketInspector:
    def __init__(self, line, station, direction):
        self.line = line
        self.station = station
        self.direction = direction


def extract_ticket_inspector_info(unformatted_text):
    # Initial guards to avoid unnecessary processing
    if '?' in unformatted_text or check_for_spam(unformatted_text):
        ticket_inspector = TicketInspector(line=None, station=None, direction=None)
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
        # direction and line should be None if the ticket inspector got off the train
        handle_get_off(text, ticket_inspector)

        verify_direction(ticket_inspector, text)
        verify_line(ticket_inspector, text)

        return ticket_inspector.__dict__
    else:
        return None


stations_dict = load_data('data/stations_list_main.json')


def get_station_id(station_name):
    station_name = station_name.strip().lower().replace(' ', '')

    for station_code, station_info in stations_dict.items():
        if station_info['name'].strip().lower().replace(' ', '') == station_name:
            return station_code
    return None


def process_new_message(timestamp, message):
    info = extract_ticket_inspector_info(message.text)
    if (type(info) is dict):
        if info.get('line') or info.get('station') or info.get('direction'):
            print('Found Info:\nLine:\t\t', info.get('line'), '\nStation:\t', info.get('station'), '\nDirection:\t', info.get('direction'))

            insert_ticket_info(
                timestamp,
                info.get('line'),
                info.get('station'),
                info.get('direction'),
            )
    else:
        print('No valuable information found')


if __name__ == '__main__':
    load_dotenv()
    BOT_TOKEN = os.getenv('BOT_TOKEN')
    BACKEND_URL = os.getenv('BACKEND_URL')

    utc = pytz.UTC
    
    bot = telebot.TeleBot(BOT_TOKEN)

    create_table_if_not_exists()

    print('Bot is running...')
    DEV_CHAT_ID = os.getenv('DEV_CHAT_ID')
    FREIFAHREN_BE_CHAT_ID = os.getenv('FREIFAHREN_BE_CHAT_ID')

    @bot.message_handler(func=lambda message: message)
    def get_info(message):
        author_id = message.from_user.id
        timestamp = datetime.fromtimestamp(message.date, utc)
        if timestamp.second or timestamp.microsecond:
            timestamp = timestamp.replace(second=0, microsecond=0) + timedelta(minutes=1)
        else:
            timestamp = timestamp.replace(second=0, microsecond=0)
            
        process_new_message(timestamp, message)

    bot.infinity_polling()
