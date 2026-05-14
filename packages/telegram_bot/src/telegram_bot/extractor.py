from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass

from mistralai.client import Mistral
from mistralai.client.errors.sdkerror import SDKError
from pydantic import BaseModel, Field

from telegram_bot.transit import TransitData

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = (
    "You extract ticket-inspector reports ('Kontrolleur', 'BVG-Kontrolle', etc.) from short German "
    "or English chat messages about Berlin public transit.\n"
    "\n"
    "Respond with ONLY a JSON object — no prose, no markdown — exactly matching this shape:\n"
    '{"stationId": <string or null>, "lineName": <string or null>, "directionId": <string or null>}\n'
    "\n"
    "Rules:\n"
    "- If the message does NOT describe an inspector sighting, return all three fields as null.\n"
    "- `stationId` MUST be picked verbatim from the station list below. Never invent ids.\n"
    "- Line names are detected outside the model. If a detected lineName is provided below and this is an inspector "
    "sighting, return that exact lineName. Otherwise return `lineName` as null.\n"
    "- `directionId` MUST be a station id from the list. If a detected lineName is provided, directionId must be a "
    "stop of that line.\n"
    "- Prefer null over guessing. It is better to leave a field empty than to fill it with a low-confidence guess.\n"
)


class Extraction(BaseModel):
    station_id: str | None = Field(default=None, alias="stationId")
    line_name: str | None = Field(default=None, alias="lineName")
    direction_id: str | None = Field(default=None, alias="directionId")

    model_config = {"populate_by_name": True}


@dataclass(frozen=True)
class ValidatedExtraction:
    station_id: str | None
    line_name: str | None
    direction_id: str | None

    @property
    def is_empty(self) -> bool:
        return self.station_id is None and self.line_name is None and self.direction_id is None


_RESPONSE_FORMAT = {"type": "json_object"}
_RING_PATTERN = re.compile(r"(?<![A-Za-z])(?:s[-\s]?)?ring(?:bahn)?", re.IGNORECASE)


def is_rate_limit_error(error: SDKError) -> bool:
    return "Status 429" in str(error) or "rate_limited" in str(error)


def build_line_pattern(line_names: tuple[str, ...]) -> re.Pattern[str]:
    alternatives: list[str] = []
    for line_name in sorted(line_names, key=len, reverse=True):
        if line_name.isdigit():
            continue
        # Match common chat variants like "U6", "u 6", "M 10" while avoiding words like "Uhr".
        parts = re.fullmatch(r"([A-Za-z]+)(\d+)", line_name)
        alternatives.append(
            rf"{re.escape(parts.group(1))}\s*{re.escape(parts.group(2))}" if parts else re.escape(line_name)
        )
    return re.compile(rf"(?<![A-Za-z0-9])({'|'.join(alternatives)})(?![A-Za-z0-9])", re.IGNORECASE)


def detect_line_name(
    message: str,
    line_names: tuple[str, ...],
    line_pattern: re.Pattern[str],
    circular_line_names: tuple[str, ...] = (),
) -> str | None:
    normalized_lines = {re.sub(r"\s+", "", line_name).upper(): line_name for line_name in line_names}
    for match in line_pattern.finditer(message):
        normalized_match = re.sub(r"\s+", "", match.group(1)).upper()
        if normalized_match in normalized_lines:
            return normalized_lines[normalized_match]
    if circular_line_names and _RING_PATTERN.search(message):
        return circular_line_names[0]
    return None


def build_station_table(transit: TransitData, line_name: str | None = None) -> str:
    """Compact lookup the model can ground on: `id<TAB>name<TAB>lines:U7,U6` per row."""

    station_ids: set[str] | None = None
    if line_name is not None:
        station_ids = {
            station_id
            for variant in transit.variants_by_name.get(line_name, ())
            for station_id in variant.stations
        }

    rows: list[str] = []
    for station in transit.stations.values():
        if station_ids is not None and station.id not in station_ids:
            continue
        line_names = ",".join(sorted(set(station.line_names))) or "-"
        rows.append(f"{station.id}\t{station.name}\tlines:{line_names}")
    rows.sort()
    return "\n".join(rows)


def build_system_content(transit: TransitData, line_name: str | None = None) -> str:
    """Build prompt context, optionally narrowed to one deterministic line."""

    detected_line = f"Detected lineName: {line_name}\n\n" if line_name is not None else ""
    station_heading = (
        "Stations on detected line (id<TAB>name<TAB>lines):\n"
        if line_name is not None
        else "Stations (id<TAB>name<TAB>lines):\n"
    )
    return (
        f"{SYSTEM_PROMPT}\n"
        f"{detected_line}"
        f"{station_heading}"
        f"{build_station_table(transit, line_name)}\n"
    )


class Extractor:
    def __init__(
        self,
        *,
        client: Mistral,
        model: str,
        transit: TransitData,
    ) -> None:
        self._client = client
        self._model = model
        self._transit = transit
        self._system_content = build_system_content(transit)
        self._line_pattern = build_line_pattern(transit.line_names)

    async def extract(self, message: str) -> ValidatedExtraction | None:
        """Run a single Mistral call and validate the result against the transit data.

        Returns None if the LLM response is unusable (parse error, hallucinated ids).
        Returns a ValidatedExtraction with all fields None if the message had no inspector report.
        """

        detected_line_name = detect_line_name(
            message,
            self._transit.line_names,
            self._line_pattern,
            self._transit.circular_line_names,
        )
        system_content = (
            build_system_content(self._transit, detected_line_name)
            if detected_line_name is not None
            else self._system_content
        )

        # Mistral can flap or rate-limit bursty eval runs; retry with stronger pacing for 429s.
        attempts = 5
        backoff = 1.0
        for attempt in range(1, attempts + 1):
            try:
                response = await self._client.chat.complete_async(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": system_content},
                        {"role": "user", "content": message},
                    ],
                    response_format=_RESPONSE_FORMAT,
                    temperature=0.0,
                )
                break
            except SDKError as exc:
                if attempt == attempts:
                    logger.warning("Mistral API error after %d attempts: %s", attempts, exc)
                    return None
                if is_rate_limit_error(exc):
                    backoff = max(backoff, 15.0)
                logger.info("Mistral API error (attempt %d/%d), retrying in %.1fs: %s",
                            attempt, attempts, backoff, exc)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 90.0)

        raw = response.choices[0].message.content
        usage = getattr(response, "usage", None)
        logger.info("Mistral raw output: %r (usage=%s)", raw, usage)

        if not isinstance(raw, str):
            logger.warning("Mistral returned non-string content: %r", raw)
            return None

        try:
            parsed = Extraction.model_validate_json(raw)
        except Exception:
            logger.exception("Failed to parse Mistral output: %s", raw)
            return None

        if detected_line_name is None:
            parsed.line_name = None
        elif not (parsed.station_id is None and parsed.line_name is None and parsed.direction_id is None):
            parsed.line_name = detected_line_name

        validated = self.validate(parsed)
        logger.info(
            "Validated extraction: parsed=%s -> validated=%s",
            parsed.model_dump(by_alias=True),
            None if validated is None else {
                "stationId": validated.station_id,
                "lineName": validated.line_name,
                "directionId": validated.direction_id,
            },
        )
        return validated

    def validate(self, parsed: Extraction) -> ValidatedExtraction | None:
        station_id = parsed.station_id
        line_name = parsed.line_name
        direction_id = parsed.direction_id

        if station_id is not None and station_id not in self._transit.stations:
            logger.warning("LLM returned unknown stationId %r — dropping", station_id)
            return None

        if line_name is not None:
            if line_name not in self._transit.variants_by_name:
                logger.warning("LLM returned unknown lineName %r — dropping line", line_name)
                line_name = None
            elif station_id is not None and line_name not in self._transit.station_line_names(station_id):
                logger.warning(
                    "LLM picked line %r that doesn't serve station %r — dropping line",
                    line_name,
                    station_id,
                )
                line_name = None

        if direction_id is not None:
            if direction_id not in self._transit.stations:
                logger.warning("LLM returned unknown directionId %r — dropping", direction_id)
                direction_id = None
            elif direction_id == station_id:
                logger.warning("LLM returned directionId equal to stationId %r — dropping direction", direction_id)
                direction_id = None
            elif line_name is not None and not self._transit.is_endpoint_of_line(line_name, direction_id):
                logger.warning(
                    "LLM directionId %r is not on line %r — dropping direction",
                    direction_id,
                    line_name,
                )
                direction_id = None

        return ValidatedExtraction(
            station_id=station_id,
            line_name=line_name,
            direction_id=direction_id,
        )


def extraction_to_log(extraction: ValidatedExtraction) -> str:
    return json.dumps(
        {
            "stationId": extraction.station_id,
            "lineName": extraction.line_name,
            "directionId": extraction.direction_id,
        }
    )
