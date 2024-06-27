import re
import json
from fuzzywuzzy import process
from NER.TransportInformationRecognizer import TextProcessor
from logging_utils import setup_logger
import os

logger = setup_logger()


def load_data(filename):
    logger.debug('loading data from file: %s', filename)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, filename)
    with open(file_path, 'r') as f:
        return json.load(f)


lines_with_stations = load_data('data/stations_and_lines.json')
if lines_with_stations is None:
    logger.error('Failed to load the stations and lines data')
    raise Exception('Failed to load the stations and lines data')
stations_with_synonyms = load_data('data/synonyms.json')
if stations_with_synonyms is None:
    logger.error('Failed to load the synonyms data')
    raise Exception('Failed to load the synonyms data')
   

def format_text_for_line_search(text):
    logger.debug('formatting text for line search')

    # Replace commas, dots, dashes, and slashes with spaces
    text = text.replace(',', ' ').replace('.', ' ').replace('-', ' ').replace('/', ' ')
    words = text.split()

    # When 's' or 'u' are followed by a number, combine them
    formatted_words = []
    for i, word in enumerate(words):
        lower_word = word.lower()
        if (lower_word == 's' or lower_word == 'u') and i + 1 < len(words):
            combined_word = lower_word + words[i + 1]
            formatted_words.append(combined_word)
        else:
            formatted_words.append(word)

    return ' '.join(formatted_words)


def process_matches(matches_per_word):
    logger.debug('processing matches')

    # Decide what to return based on the collected matches
    if len(matches_per_word) == 1:
        return sorted(matches_per_word[list(matches_per_word.keys())[0]], key=len, reverse=True)[0]
    elif any(len(matches) > 1 for matches in matches_per_word.values()):
        for _word, matches in matches_per_word.items():
            if len(matches) > 1:
                return sorted(matches, key=len, reverse=True)[0]
    return None


def find_line(text, lines):
    logger.debug('finding the line')

    formatted_text = format_text_for_line_search(text)
    if formatted_text is None:
        return None

    words = formatted_text.split()
    sorted_lines = sorted(lines.keys(), key=len, reverse=True)
    matches_per_word = {}

    for word in set(words):
        for line in sorted_lines:
            if line.lower() in word.lower():
                matches_per_word.setdefault(word, []).append(line)

    return process_matches(matches_per_word)


def format_text(text):
    logger.debug('formatting text')

    text = text.lower().replace('.', ' ').replace(',', ' ')
    # Remove all isolated 's' and 'u' to reduce noise
    text = re.sub(r'\b(s|u)\b', '', text)
    return text


def get_all_stations(line=None):
    logger.debug('Getting all stations for the line: %s', line)

    all_stations = []
    line = line.upper() if line is not None else None

    if line is not None:
        # If a specific line is provided, add stations and synonyms from that line
        stations_of_line = lines_with_stations.get(line, [])
        all_stations.extend([station.lower() for station in stations_of_line])
        
        # Add synonyms for the stations on the specified line
        for station in stations_of_line:
            for station_type in stations_with_synonyms.values():
                if station in station_type:
                    synonyms = station_type[station]
                    all_stations.extend([synonym.lower() for synonym in synonyms])
                    break
    else:
        # If no line is specified, add all stations and synonyms
        for station_type in stations_with_synonyms.values():
            for station, synonyms in station_type.items():
                all_stations.append(station.lower())
                all_stations.extend([synonym.lower() for synonym in synonyms])

    return all_stations


def get_best_match(text, items, threshold=75):
    logger.debug('getting the best match')

    match = process.extractOne(text, items)
    best_match, score = match
    if score >= threshold:
        return best_match
    return None


def find_match_in_stations(best_match, stations_with_synonyms):
    logger.debug('finding the match in stations for the best match: %s', best_match)

    for station_type in stations_with_synonyms.values():
        for station, synonyms in station_type.items():
            if best_match in [station.lower()] + [synonym.lower() for synonym in synonyms]:
                return station
    return None


def find_station(text, ticket_inspector, threshold=75):
    logger.debug('finding the station')

    all_stations = get_all_stations(ticket_inspector.line)
    
    # Use the NER Model to get the unrecognized stations from the text
    ner_results = TextProcessor.process_text(text)
    logger.info('NER results: %s', ner_results)

    for ner_result in ner_results:
        # Get the fuzzy match of the NER result with the stations
        best_match = get_best_match(ner_result, all_stations, threshold)
        if best_match:
            # Find the correct station name for the best match
            found_station_name = find_match_in_stations(best_match, stations_with_synonyms)
            if found_station_name:
                # Catch secret direction, as the next station
                # This is triggered when the direction could not be found via direction keywords
                if ticket_inspector.direction is None and len(ner_results) > 1:
                    best_match = get_best_match(ner_results[1], all_stations, threshold)
                    if best_match:
                        direction = find_match_in_stations(best_match, stations_with_synonyms)
                        if direction:
                            ticket_inspector.direction = direction
                return found_station_name
    return None


def check_for_spam(text):
    logger.debug('checking for spam')

    if len(text) > 250:
        return True

    if 'http' in text:
        return True
        
    emoji_pattern = re.compile(
        '['
        u'\U0001F600-\U0001F64F'  # emojis
        ']+', flags=re.UNICODE
    )

    # Find all emojis in the text
    emojis = emoji_pattern.findall(text)
    # Split emojis into individual characters
    emojis = [char for emoji in emojis for char in emoji]

    if len(emojis) > 5:
        return True

    # If no spam indicators were found
    return False


def remove_direction_and_keyword(text, direction_keyword, direction):
    logger.debug('removing direction and keyword for the keyword: %s and direction: %s', direction_keyword, direction)

    replace_segment = f'{direction_keyword} {direction}'.strip()
    if replace_segment in text:
        # If the exact match is found, replace it
        return text.replace(replace_segment, '').strip()
    else:
        # If only the direction_keyword is found, attempt to remove it and any trailing spaces
        replace_keyword_only = f'{direction_keyword}'.strip()
        if replace_keyword_only in text:
            # Remove the keyword and any single trailing space (if present)
            text = text.replace(replace_keyword_only, '', 1).strip()
        return text


direction_keywords = ['nach', 'richtung', 'bis', 'zu', 'to', 'towards', 'direction', 'ri', 'richtig']


def find_direction(text, ticket_inspector):
    logger.debug('finding the direction')
    
    words = text.split()
    word_after_keyword = None  # Because we want to use it outside the loop

    for word in words:
        if word in direction_keywords:
            found_direction_keyword = word
            parts = text.split(word, 1)
            if len(parts) > 1:
                after_keyword = parts[1].strip()
                words_after_keyword = after_keyword.split()

                for word_after_keyword in words_after_keyword:
                    found_direction = find_station(word_after_keyword, ticket_inspector)
                    if found_direction:
                        text_without_direction = remove_direction_and_keyword(
                            text, found_direction_keyword, word_after_keyword
                        )
                        return found_direction, text_without_direction

                # If no station found after keyword, check the word directly before the keyword
                index = words.index(found_direction_keyword)
                if index > 0:
                    previous_word = words[index - 1]
                    found_direction = find_station(previous_word, ticket_inspector)
                    if found_direction:
                        text_without_direction = remove_direction_and_keyword(
                            text, found_direction_keyword, word_after_keyword
                        )
                        return found_direction, text_without_direction

    return None, text
