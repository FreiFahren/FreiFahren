from telegram_bots.FreiFahren_BE_NLP.process_message import find_station, remove_direction_and_keyword, lines
from telegram_bots.logger import setup_logger

logger = setup_logger()


def handle_ringbahn(text):
    logger.debug('handling ringbahn')
    
    ring_keywords = ['ring', 'ringbahn']
    # remove commas and dots from the text
    text = text.replace(',', '').replace('.', '')
    # split the text into individual words
    words = text.lower().split()
    # check if any word in the text matches the ring keywords
    for word in words:
        if word in ring_keywords:
            return True
    return False


def verify_line(ticket_inspector, text):
    logger.debug('verifying line')

    # If it the ring set to S41
    if handle_ringbahn(text.lower()) and ticket_inspector.line is None:
        ticket_inspector.line = 'S41'
    return ticket_inspector


def set_ringbahn_directionless(ticket_inspector):
    logger.debug('setting ringbahn directionless')

    if ticket_inspector.line == 'S41' or ticket_inspector.line == 'S42':
        ticket_inspector.direction = None

    return ticket_inspector


def verify_direction(ticket_inspector, text):
    logger.debug('verifying direction')

    if ticket_inspector.line is None:
        return ticket_inspector

    # Set direction to None if the line is S41 or S42
    set_ringbahn_directionless(ticket_inspector)

    # if station is mentioned directly after the line, it is the direction
    # example 'U8 Hermannstraße' is most likely 'U8 Richtung Hermannstraße'
    check_if_station_is_actually_direction(text, ticket_inspector)

    return ticket_inspector


def get_final_stations_of_line(line):
    logger.debug('getting final stations of line')

    final_stations_of_line = []
    final_stations_of_line.append(lines[line][0])
    final_stations_of_line.append(lines[line][-1])
    return final_stations_of_line


def get_words_after_line(text, line):
    logger.debug('getting words after line')

    line_index = text.rfind(line)
    after_line = text[line_index + len(line):].strip()
    return after_line.split()


def check_if_station_is_actually_direction(text, ticket_inspector):
    logger.debug('checking if station is actually direction')

    if ticket_inspector.direction is None or ticket_inspector.station is None:
        return ticket_inspector

    line = ticket_inspector.line
    final_stations_of_line = get_final_stations_of_line(line)

    line = line.lower()  # convert to lowercase because text is in lowercase
    after_line_words = get_words_after_line(text, line)

    if not after_line_words:
        return ticket_inspector

    # Get the word directly after the line
    found_station_after_line = find_station(after_line_words[0], ticket_inspector)

    if not found_station_after_line or found_station_after_line not in final_stations_of_line:
        return ticket_inspector

    # Remove the word after line from the text to find the new station
    text_without_direction = remove_direction_and_keyword(text, line, after_line_words[0])
    new_station = find_station(text_without_direction, ticket_inspector)

    if new_station is None:
        return ticket_inspector

    ticket_inspector.direction = found_station_after_line
    ticket_inspector.station = new_station

    return ticket_inspector
