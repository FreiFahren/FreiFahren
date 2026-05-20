import re

MINIMUM_MESSAGE_LENGTH = 3
MAXIMUM_MESSAGE_LENGTH = 250
MAX_EMOJIS = 5

_EMOJI_PATTERN = re.compile(
    "[\U0001f600-\U0001f64f]+",
    flags=re.UNICODE,
)


def is_spam(text: str) -> bool:
    if len(text) < MINIMUM_MESSAGE_LENGTH:
        return True

    if "?" in text:
        return True

    if len(text) > MAXIMUM_MESSAGE_LENGTH:
        return True

    if "http" in text:
        return True

    emojis = [char for match in _EMOJI_PATTERN.findall(text) for char in match]
    return len(emojis) > MAX_EMOJIS
