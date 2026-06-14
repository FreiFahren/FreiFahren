from __future__ import annotations

import asyncio
import json
import logging
import re
import unicodedata
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from difflib import SequenceMatcher

from mistralai.client import Mistral
from mistralai.client.errors.sdkerror import SDKError
from pydantic import BaseModel, Field

from telegram_bot import config
from telegram_bot.transit import TransitData

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ExtractionResult:
    station_id: str | None
    line_name: str | None
    direction_id: str | None

    @property
    def is_empty(self) -> bool:
        return self.station_id is None and self.line_name is None and self.direction_id is None


def extraction_to_log(extraction: ExtractionResult) -> str:
    return json.dumps(
        {
            'stationId': extraction.station_id,
            'lineName': extraction.line_name,
            'directionId': extraction.direction_id,
        }
    )


_RESPONSE_FORMAT = {'type': 'json_object'}
_CIRCULAR_LINE_PATTERN = (
    re.compile(config.CIRCULAR_LINE_PATTERN, re.IGNORECASE) if config.CIRCULAR_LINE_PATTERN else None
)


def is_rate_limit_error(error: SDKError) -> bool:
    return 'Status 429' in str(error) or 'rate_limited' in str(error)


def build_line_pattern(line_names: tuple[str, ...]) -> re.Pattern[str]:
    alternatives: list[str] = []
    for line_name in sorted(line_names, key=len, reverse=True):
        if line_name.isdigit():
            continue
        # Match common chat variants like "U6", "u 6", "M 10" while avoiding words like "Uhr".
        parts = re.fullmatch(r'([A-Za-z]+)(\d+)', line_name)
        alternatives.append(
            rf'{re.escape(parts.group(1))}\s*{re.escape(parts.group(2))}' if parts else re.escape(line_name)
        )
    return re.compile(rf'(?<![A-Za-z0-9])({"|".join(alternatives)})(?![A-Za-z0-9])', re.IGNORECASE)


def detect_line_name(
    message: str,
    line_names: tuple[str, ...],
    line_pattern: re.Pattern[str],
    circular_line_names: tuple[str, ...] = (),
) -> str | None:
    normalized_lines = {re.sub(r'\s+', '', line_name).upper(): line_name for line_name in line_names}
    for match in line_pattern.finditer(message):
        normalized_match = re.sub(r'\s+', '', match.group(1)).upper()
        if normalized_match in normalized_lines:
            return normalized_lines[normalized_match]
    if circular_line_names and _CIRCULAR_LINE_PATTERN is not None and _CIRCULAR_LINE_PATTERN.search(message):
        return circular_line_names[0]
    return None


def build_system_prompt(transit: TransitData) -> str:
    tracked = ', '.join(sorted(transit.line_names))
    examples = config.PROMPT_EXAMPLES.strip()
    return (
        f'This is a {config.CITY_NAME} public-transit chat where users report ticket-inspector '
        f'sightings ({config.INSPECTOR_KEYWORDS}, etc.). Almost every message is a sighting report.\n'
        '\n'
        'Respond with ONLY a JSON object — no prose, no markdown — exactly matching this shape:\n'
        '{"stationName": <string or null>, "directionName": <string or null>}\n'
        '\n'
        'Rules:\n'
        '- Extract from sighting reports. Messages with just a station name, just a line, or vague '
        'phrasing like "waiting at X", "got out at X", "now at X", "chilling at X", or "X clean" '
        'are reports. Typos, slang, and language mixing are normal.\n'
        '- For clear non-reports (spam/ads, questions, ticket sales, social chitchat with no '
        'location, off-topic banter), set both fields to null.\n'
        '- stationName: the station the user is currently at. Copy it as written, including typos. '
        'If the user gives a CURRENT station and a DIRECTION ("U7 Rathaus Spandau Richtung Rudow '
        'höhe Neukölln" / "u8 wittenau höhe osloer"), the CURRENT station is the one near a word '
        'like "höhe", "at", "now", "gerade", "jetzt", or simply the LATER one in the sentence. '
        'A line\'s terminus mentioned without "Richtung" but at the start of the message is often '
        'still the direction. Set null if only a line and/or a direction phrase appear, with no '
        'current station.\n'
        '- directionName: the destination after words like "Richtung", "nach", "to", "towards", '
        '"->", "bis", "Ri.", or a line\'s well-known terminus mentioned alongside another '
        'station ("U7 Rudow ... Neukölln" -> direction Rudow, station Neukölln). NEVER repeat '
        'the current station here. Null if no direction is given.\n'
        f'- We track these lines: {tracked}. Sightings on OTHER lines (local buses M19/M29/M41, '
        'X-lines, three-digit lines, etc.) are still reports if a station name is mentioned — '
        'extract the station (bus stops are named after the nearby U/S station).\n'
        '- Never return generic words as a stationName (platform, station, vehicle types). If '
        'only generic words appear, set stationName=null.\n' + (f'\nExamples:\n{examples}\n' if examples else '')
    )


class StationNameExtraction(BaseModel):
    station_name: str | None = Field(default=None, alias='stationName')
    direction_name: str | None = Field(default=None, alias='directionName')

    model_config = {'populate_by_name': True}


_LETTER_MAP = str.maketrans(config.LANGUAGE_LETTER_MAP)
_ABBREVIATIONS: tuple[tuple[re.Pattern[str], str], ...] = tuple(
    (re.compile(pat), repl) for pat, repl in config.LANGUAGE_ABBREVIATIONS
)
_PREFIX_PATTERN = re.compile(config.STATION_NAME_PREFIX_PATTERN, re.IGNORECASE)
_NON_STATION_WORDS = config.GENERIC_NON_STATION_WORDS


def normalize_name(name: str) -> str:
    n = name.strip().lower()
    n = _PREFIX_PATTERN.sub('', n)
    n = n.translate(_LETTER_MAP)
    # Strip diacritics that survived the letter map.
    n = ''.join(c for c in unicodedata.normalize('NFKD', n) if not unicodedata.combining(c))
    for pat, repl in _ABBREVIATIONS:
        n = pat.sub(repl, n)
    n = re.sub(r'[^a-z0-9]+', '', n)
    return n


def _similarity(query_norm: str, candidate_norm: str) -> float:
    """Hybrid score: prefix and substring win first, otherwise difflib ratio."""
    if not query_norm or not candidate_norm:
        return 0.0
    if query_norm == candidate_norm:
        return 1.0
    if candidate_norm.startswith(query_norm) or query_norm.startswith(candidate_norm):
        return 0.95
    if query_norm in candidate_norm or candidate_norm in query_norm:
        # Reward containment but cap below prefix; longer overlap relative to candidate scores higher.
        return 0.85 + 0.05 * (len(query_norm) / max(len(candidate_norm), 1))
    return SequenceMatcher(None, query_norm, candidate_norm).ratio()


@dataclass
class StationIndex:
    by_norm: dict[str, list[str]]  # normalized name -> station ids
    lines_by_id: dict[str, frozenset[str]]

    @classmethod
    def build(cls, transit: TransitData) -> StationIndex:
        by_norm: dict[str, list[str]] = {}
        lines_by_id: dict[str, frozenset[str]] = {}
        # Derive lines per station from variants so we get PUBLIC line names ("S85") rather than
        # variant names ("S85-a") that the /stations endpoint sometimes returns directly.
        for station in transit.stations.values():
            n = normalize_name(station.name)
            by_norm.setdefault(n, []).append(station.id)
            lines_by_id[station.id] = frozenset(transit.station_line_names(station.id))
        return cls(by_norm=by_norm, lines_by_id=lines_by_id)

    def candidates(self, query: str, line_name: str | None, *, min_score: float = 0.6) -> list[tuple[str, float]]:
        full = normalize_name(query)
        if not full:
            return []
        # Tier 1: score on full normalized query.
        scored: list[tuple[str, float]] = []
        for cand_norm in self.by_norm:
            sc = _similarity(full, cand_norm)
            if sc >= min_score:
                scored.append((cand_norm, sc))
        # Tier 2: only if Tier 1 found no strong match, fall back to per-word scoring.
        # This keeps "Rathaus Tiergarten" matchable as "Tiergarten" without letting common
        # tail words ("Markt", "Platz", "Str") hijack longer queries.
        if not scored or max(sc for _, sc in scored) < 0.75:
            word_queries = [
                normalize_name(p) for p in re.split(r'[\s\-/,]+', query) if p.strip() and len(p.strip()) > 4
            ]
            word_queries = [w for w in word_queries if w and w != full]
            for cand_norm in self.by_norm:
                for w in word_queries:
                    sc = _similarity(w, cand_norm) * 0.9  # slight penalty so full-query wins ties
                    if sc >= min_score:
                        scored.append((cand_norm, sc))
        if not scored:
            return []
        scored.sort(key=lambda x: x[1], reverse=True)

        results: list[tuple[str, float]] = []
        for norm, sc in scored:
            for station_id in self.by_norm[norm]:
                if line_name is not None and line_name not in self.lines_by_id[station_id]:
                    continue
                results.append((station_id, sc))
        return results


def pick_station(
    index: StationIndex,
    query: str | None,
    line_name: str | None,
    *,
    allow_off_line: bool = True,
) -> tuple[str, bool] | None:
    """Return (station_id, station_is_on_line) or None.

    The bool tells callers whether the picked station is on `line_name`. When the user
    types a station that isn't on the line they mentioned (e.g. "u6 turmstr" — Turmstraße
    is on U9), we'd rather trust the station and drop the line than pick a wrong same-line
    station with worse fuzzy score.
    """
    if not query:
        return None
    if normalize_name(query) in _NON_STATION_WORDS:
        return None
    on_line = index.candidates(query, line_name) if line_name is not None else []
    off_line: list[tuple[str, float]] = []
    if allow_off_line and (not on_line or (line_name is not None and on_line[0][1] < 0.92)):
        # Only compare against an unfiltered search when the line-filtered match isn't already
        # near-exact. Otherwise we'd risk swapping in a slightly higher-scoring off-line station.
        off_line = index.candidates(query, None)

    if not on_line and not off_line:
        return None
    if not on_line:
        return (off_line[0][0], False)
    if not off_line:
        return (on_line[0][0], True)
    # If the off-line top score beats the on-line top by a clear margin, prefer it and drop the line.
    if off_line[0][1] >= on_line[0][1] + 0.1:
        return (off_line[0][0], False)
    return (on_line[0][0], True)


def pick_direction(index: StationIndex, query: str | None, line_name: str | None) -> str | None:
    """Pick a direction station id, preferring stations on the user's line for disambiguation.
    Backend handles terminus snapping and same-as-station clearing.

    When a line is known, restrict to that line — without this, nonsense direction words
    ("Norden", "süd") fuzzy-match to far-away stations, and ambiguous names like "Spandau"
    or "Potsdam" pick the wrong same-named station.
    """
    if not query:
        return None
    picked = pick_station(index, query, line_name, allow_off_line=line_name is None)
    return picked[0] if picked is not None else None


async def request_station_name_extraction(
    *,
    client: Mistral,
    model: str,
    system_prompt: str,
    message: str,
) -> StationNameExtraction | None:
    attempts = 5
    backoff = 1.0
    response = None
    for attempt in range(1, attempts + 1):
        try:
            response = await client.chat.complete_async(
                model=model,
                messages=[
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': message},
                ],
                response_format=_RESPONSE_FORMAT,
                temperature=0.0,
            )
            break
        except SDKError as exc:
            if attempt == attempts:
                logger.warning('Mistral API error after %d attempts: %s', attempts, exc)
                return None
            if is_rate_limit_error(exc):
                backoff = max(backoff, 15.0)
            logger.info('retry %d/%d in %.1fs: %s', attempt, attempts, backoff, exc)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 90.0)

    assert response is not None
    raw = response.choices[0].message.content
    if not isinstance(raw, str):
        return None

    try:
        return StationNameExtraction.model_validate_json(raw)
    except Exception:
        logger.exception('parse failed: %s', raw)
        return None


# --- Resolution stage --------------------------------------------------------
# `resolve_extraction` is the deterministic resolution stage's interface, kept separate
# from however the raw strings were produced: raw extracted strings (a
# `StationNameExtraction`) plus a detected line go in, resolved station/direction ids come
# out. In production a Mistral call (see `mistral_llm` below) fills the `StationNameExtraction`;
# unit tests construct it directly, so every fuzzy-match edge case is testable without an LLM.
def resolve_extraction(
    *,
    station_index: StationIndex,
    parsed: StationNameExtraction,
    detected_line: str | None,
) -> ExtractionResult:
    picked = pick_station(station_index, parsed.station_name, detected_line)
    if picked is None:
        station_id = None
        station_on_line = False
    else:
        station_id, station_on_line = picked

    line_name = detected_line
    if line_name is not None and station_id is not None and not station_on_line:
        line_name = None

    return ExtractionResult(
        station_id=station_id,
        line_name=line_name,
        direction_id=pick_direction(station_index, parsed.direction_name, line_name),
    )


# --- LLM adapter -------------------------------------------------------------
# An LLM adapter sits in front of the resolution stage: a message goes in, the raw
# extracted strings (or None on failure) come out. Mistral is the production adapter;
# tests can supply any callable with this shape, or skip the adapter entirely and exercise
# `resolve_extraction` against canned `StationNameExtraction`s.
StationNameLLM = Callable[[str], Awaitable[StationNameExtraction | None]]


def mistral_llm(*, client: Mistral, model: str, system_prompt: str) -> StationNameLLM:
    """Production LLM adapter: a Mistral chat completion in front of the resolution stage."""

    async def call(message: str) -> StationNameExtraction | None:
        return await request_station_name_extraction(
            client=client,
            model=model,
            system_prompt=system_prompt,
            message=message,
        )

    return call


async def extract(
    *,
    message: str,
    transit: TransitData,
    client: Mistral,
    model: str,
    line_pattern: re.Pattern[str],
    station_index: StationIndex,
    system_prompt: str,
) -> ExtractionResult | None:
    detected_line = detect_line_name(
        message,
        transit.line_names,
        line_pattern,
        transit.circular_line_names,
    )
    llm = mistral_llm(client=client, model=model, system_prompt=system_prompt)
    parsed = await llm(message)
    return (
        None
        if parsed is None
        else resolve_extraction(
            station_index=station_index,
            parsed=parsed,
            detected_line=detected_line,
        )
    )
