from nlp_service.utils.logger import setup_logger

logger = setup_logger()

"""
Preparation functions
"""

def process_matches(matches_per_word):
    logger.debug("processing matches")

    # Decide what to return based on the collected matches
    if len(matches_per_word) == 1:
        return sorted(
            matches_per_word[list(matches_per_word.keys())[0]], key=len, reverse=True
        )[0]
    elif any(len(matches) > 1 for matches in matches_per_word.values()):
        for _word, matches in matches_per_word.items():
            if len(matches) > 1:
                return sorted(matches, key=len, reverse=True)[0]
    return None

def format_text_for_line_search(text):
    logger.debug("formatting text for line search")

    # Replace commas, dots, dashes, and slashes with spaces
    text = text.replace(",", " ").replace(".", " ").replace("-", " ").replace("/", " ")
    words = text.split()

    # When 's' or 'u' are followed by a number, combine them
    formatted_words = []
    for i, word in enumerate(words):
        lower_word = word.lower()
        if (lower_word == "s" or lower_word == "u") and i + 1 < len(words):
            combined_word = lower_word + words[i + 1]
            formatted_words.append(combined_word)
        else:
            formatted_words.append(word)

    return " ".join(formatted_words)


def find_line(text: str, lines: dict) -> str | None:
    logger.debug("finding the line")

    formatted_text = format_text_for_line_search(text)
    if formatted_text is None:
        return None

    words = formatted_text.split()
    sorted_lines = sorted(lines.keys(), key=len, reverse=True)
    matches_per_word = {}

    for i, word in enumerate(words):
        for line in sorted_lines:
            # For numeric-only lines, require "Tram" prefix
            # as these lines are unlikely make sure the user is not referring to a number
            if line.isdigit():
                if i > 0 and words[i-1].lower() == "tram" and line == word:
                    matches_per_word.setdefault(word, []).append(line)
            elif line.lower() == word.lower():
                matches_per_word.setdefault(word, []).append(line)
            elif word.lower() == "u12": # temporary fix for u12, which is not in the lines dict
                matches_per_word.setdefault(word, []).append("U2")

    return process_matches(matches_per_word)