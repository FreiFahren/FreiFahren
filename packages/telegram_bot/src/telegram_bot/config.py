import os

from dotenv import load_dotenv

load_dotenv()


def _required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


BACKEND_URL = _required("BACKEND_URL").rstrip("/")
MISTRAL_API_KEY = _required("MISTRAL_API_KEY")
REPORT_PASSWORD = _required("REPORT_PASSWORD")
TELEGRAM_BOT_TOKEN = _required("TELEGRAM_BOT_TOKEN")
TELEGRAM_REPORT_CHAT_ID = _required("TELEGRAM_REPORT_CHAT_ID")

MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "mistral-small-latest")
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "https://app.freifahren.org").rstrip("/")
REPORT_HTTP_HOST = os.getenv("REPORT_HTTP_HOST", "127.0.0.1")
REPORT_HTTP_PORT = int(os.getenv("REPORT_HTTP_PORT", "6010"))


# --- City / language profile -------------------------------------------------
# Everything below here is what you'd swap when porting the bot to a new city.
# Keep extractor code generic and read from these constants.

CITY_NAME = os.getenv("CITY_NAME", "Berlin")

# Free-text used inside the prompt to remind the model what a circular line is
# called locally. Empty string = no circular line.
CIRCULAR_LINE_ALIAS = os.getenv("CIRCULAR_LINE_ALIAS", "Ringbahn")

# Regex that recognizes user shorthand for the circular line.
# Berlin: \"Ring\", \"Ringbahn\", \"S-Ring\". Empty = no circular line.
CIRCULAR_LINE_PATTERN = os.getenv(
    "CIRCULAR_LINE_PATTERN",
    r"(?<![A-Za-z])(?:s[-\s]?)?ring(?:bahn)?",
)

# Language-specific letter folding for normalization. Pairs of "from:to".
# Berlin/German: umlauts -> ascii digraphs.
LANGUAGE_LETTER_MAP: dict[str, str] = {
    # Collapse umlauts to their base letter rather than the digraph form: when users type on
    # ASCII keyboards they almost always write "u"/"o"/"a" (sudkreuz, mockern, bulow), not the
    # "ue"/"oe"/"ae" expansion that German spelling rules call for. Mapping to the base letter
    # makes user input line up with normalized station names. ß remains "ss" because that's
    # the universally typed substitute.
    "ä": "a", "ö": "o", "ü": "u", "ß": "ss",
    "Ä": "a", "Ö": "o", "Ü": "u",
}

# Pairs (regex_pattern, replacement) applied to station names during normalization
# so user-typed abbreviations match the canonical names.
# Berlin/German: \"str.\"/\"straße\" -> \"strasse\", \"pl.\" -> \"platz\", etc.
LANGUAGE_ABBREVIATIONS: list[tuple[str, str]] = [
    (r"straße", "strasse"),
    (r"str\.?(?=\s|$|/|,|\)|-)", "strasse"),
    (r"str$", "strasse"),
    (r"\bbhf\.?\b", "bahnhof"),
    (r"\bhbf\.?\b", "hauptbahnhof"),
    (r"\bpl\.?\b", "platz"),
]

# Prefixes the user often writes before a station name that aren't part of the name.
# Berlin: "S Alexanderplatz", "U Mehringdamm", "Bhf X".
STATION_NAME_PREFIX_PATTERN = os.getenv(
    "STATION_NAME_PREFIX_PATTERN",
    r"^(?:bahnhof\s+|bhf\s+|s\s+|u\s+|s-bahn\s+|u-bahn\s+)+",
)

# Words the LLM might emit as a station name that really refer to platforms,
# vehicles, or the generic word "station". Always rejected.
GENERIC_NON_STATION_WORDS: frozenset[str] = frozenset({
    # German
    "bahnsteig", "bahnsteige", "bahnhof", "gleis", "gleise", "zug", "zuege",
    "ubahn", "sbahn", "tram", "strassenbahn", "haltestelle",
    # English / shared
    "platform", "bus", "station", "stop",
})

# Inspector-report vocabulary the prompt should highlight to the model.
INSPECTOR_KEYWORDS = os.getenv(
    "INSPECTOR_KEYWORDS",
    'Kontrolleur, BVG-Kontrolle, BOS, BW, Blauwesten, Zivilkontrolle, blaue Westen',
)


# Few-shot examples appended to the prompt. Tuned to teach disambiguation patterns the
# model gets wrong: slang names, direction-vs-station, all-clear messages, and the
# implicit-direction case ("Line + Terminal Name + other station").
# Keep these in the local language since the prompt and chat are mixed German/English
# in the source city. Empty string disables few-shot.
PROMPT_EXAMPLES = os.getenv(
    "PROMPT_EXAMPLES",
    '''Message: "U2 alex hab in dem bahnstation gesehen"
{"stationName": "Alex", "directionName": null}

Message: "3x kotti u3 am Gleis"
{"stationName": "Kottbusser Tor", "directionName": null}

Message: "gorli u1/u3 3 Männer"
{"stationName": "Görlitzer Bahnhof", "directionName": null}

Message: "U7 Rathaus Spandau Richt Rudow Höhe sbhf Neukölln 4 Mann BOS"
{"stationName": "Neukölln", "directionName": "Rudow"}

Message: "u 8 wittenau in blauen westen höhe osloer"
{"stationName": "osloer", "directionName": "wittenau"}

Message: "Gesundbrunnen clean on u8"
{"stationName": "Gesundbrunnen", "directionName": null}

Message: "M29 bus moritzplatz"
{"stationName": "Moritzplatz", "directionName": null}

Message: "3 Bos Jacken M29 Anhalter Bahnhof Richtung Hermannplatz"
{"stationName": "Anhalter Bahnhof", "directionName": "Hermannplatz"}

Message: "S3 nach ostbahnof"
{"stationName": null, "directionName": "Ostbahnhof"}

Message: "To Rathaus SPANDAU"
{"stationName": null, "directionName": "Rathaus Spandau"}

Message: "U7 Rathaus Neukölln 3x BOS just got off the train"
{"stationName": "Rathaus Neukölln", "directionName": null}

Message: "U6 Kaiserin Augusta 2x bos"
{"stationName": "Kaiserin-Augusta-Straße", "directionName": null}

Message: "Zoo Richtung Steglitz"
{"stationName": "Zoo", "directionName": "Steglitz"}

Message: "Hi, kann mir wer ein Ticket verkaufen?"
{"stationName": null, "directionName": null}
''',
)
