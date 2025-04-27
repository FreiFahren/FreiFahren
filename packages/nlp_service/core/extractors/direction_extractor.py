from nlp_service.utils.logger import setup_logger
from nlp_service.config.language_rules import direction_keywords, remove_direction_and_keyword
from nlp_service.core.extractors.station_extractor import find_station 

import re

logger = setup_logger()

"""
Preparation functions
"""

def format_text(text):
    logger.debug("formatting text")

    text = text.lower().replace(".", " ").replace(",", " ")
    # Remove all isolated 's' and 'u' to reduce noise
    text = re.sub(r"\b(s|u)\b", "", text)
    return text

"""
Extraction functions
"""

def find_direction(text, ticket_inspector):
    logger.debug("finding the direction")

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
