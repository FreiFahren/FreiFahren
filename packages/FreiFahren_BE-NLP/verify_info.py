from process_message import lines_with_stations, find_station, remove_direction_and_keyword, load_data


def handle_ringbahn(text):
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
    # If there is only one line traversing the station, set the line to that line
    if ticket_inspector.line is None and ticket_inspector.station is not None:
        stations_list_main = load_data('data/stations_list_main.json')
        check_for_line_through_station(ticket_inspector, stations_list_main)

    # If it the ring set to S41
    if handle_ringbahn(text.lower()) and ticket_inspector.line is None:
        ticket_inspector.line = 'S41'
    return ticket_inspector


def set_ringbahn_directionless(ticket_inspector):
    if ticket_inspector.line == 'S41' or ticket_inspector.line == 'S42':
        ticket_inspector.direction = None

    return ticket_inspector


def handle_get_off(text, ticket_inspector):
    getting_off_keywords = [
        'ausgestiegen',
        'raus',
        'aussteigen',
        'got off',
        'get off',
        'getting off',
        'steigen aus',
    ]

    # if any of the keywords are in the text return True
    for keyword in getting_off_keywords:
        if keyword in text:
            # When getting off, we only know they are at a station
            ticket_inspector.line = None
            ticket_inspector.direction = None
            return ticket_inspector


def verify_direction(ticket_inspector, text):
    if ticket_inspector.line is None:
        return ticket_inspector

    # Update ticket inspector with the corrected direction returned by correct_direction
    ticket_inspector = correct_direction(ticket_inspector, lines_with_stations)

    # Set direction to None if the line is S41 or S42
    set_ringbahn_directionless(ticket_inspector)

    # if station is mentioned directly after the line, it is the direction
    # example 'U8 Hermannstraße' is most likely 'U8 Richtung Hermannstraße'
    check_if_station_is_actually_direction(text, ticket_inspector)

    return ticket_inspector


def get_final_stations_of_line(line):
    final_stations_of_line = []
    final_stations_of_line.append(lines_with_stations[line][0])
    final_stations_of_line.append(lines_with_stations[line][-1])
    return final_stations_of_line


def get_words_after_line(text, line):
    line_index = text.rfind(line)
    after_line = text[line_index + len(line):].strip()
    return after_line.split()


def check_if_station_is_actually_direction(text, ticket_inspector):
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


def correct_direction(ticket_inspector, lines_with_stations):
    line = ticket_inspector.line
    direction = ticket_inspector.direction
    station = ticket_inspector.station

    stations_of_line = lines_with_stations[line]

    # If direction is a final station, return ticket_inspector
    if direction in [stations_of_line[0], stations_of_line[-1]]:
        return ticket_inspector

    # If station and direction are in the line, correct the direction
    if station in stations_of_line and direction in stations_of_line:
        station_index = stations_of_line.index(station)
        direction_index = stations_of_line.index(direction)

        # Correct the direction based on the station's position
        # For example: 'S7 jetzt Alexanderplatz richtung Ostkreuz' should be to Ahrensfelde
        if station_index < direction_index:
            ticket_inspector.direction = stations_of_line[-1]
        else:
            ticket_inspector.direction = stations_of_line[0]

        return ticket_inspector

    # If direction is not a final station, set direction to None
    ticket_inspector.direction = None
    return ticket_inspector


def check_for_line_through_station(ticket_inspector, stations_list_main):
    station_name = ticket_inspector.station.strip().lower().replace(' ', '')

    for _key, station_info in stations_list_main.items():
        if station_info['name'].strip().lower().replace(' ', '') == station_name:
            if len(station_info['lines']) == 1:
                ticket_inspector.line = station_info['lines'][0]
                return ticket_inspector

    return ticket_inspector
