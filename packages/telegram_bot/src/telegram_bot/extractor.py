from __future__ import annotations

import asyncio
import json
import logging
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
    "- `lineName` MUST be picked verbatim from the line names below (e.g. 'U8', 'S41', 'M10'). Never include "
    "  a variant suffix.\n"
    "- `directionId` MUST be a station id from the list AND must be an endpoint/intermediate stop of the chosen line.\n"
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


def build_station_table(transit: TransitData) -> str:
    """Compact lookup the model can ground on: `id<TAB>name<TAB>lines:U7,U6` per row."""

    rows: list[str] = []
    for station in transit.stations.values():
        line_names = ",".join(sorted(set(station.line_names))) or "-"
        rows.append(f"{station.id}\t{station.name}\tlines:{line_names}")
    rows.sort()
    return "\n".join(rows)


def build_static_prefix(transit: TransitData) -> str:
    """The cacheable system context: instructions + station table + line names."""

    line_names = ", ".join(transit.line_names)
    return (
        f"{SYSTEM_PROMPT}\n"
        f"Available line names: {line_names}\n"
        "\n"
        "Stations (id<TAB>name<TAB>lines):\n"
        f"{build_station_table(transit)}\n"
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
        self._system_content = build_static_prefix(transit)

    async def extract(self, message: str) -> ValidatedExtraction | None:
        """Run a single Mistral call and validate the result against the transit data.

        Returns None if the LLM response is unusable (parse error, hallucinated ids).
        Returns a ValidatedExtraction with all fields None if the message had no inspector report.
        """

        # Mistral 5xx flaps on bursty days; retry transient errors with light backoff.
        attempts = 3
        backoff = 1.0
        for attempt in range(1, attempts + 1):
            try:
                response = await self._client.chat.complete_async(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": self._system_content},
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
                logger.info("Mistral API error (attempt %d/%d), retrying in %.1fs: %s",
                            attempt, attempts, backoff, exc)
                await asyncio.sleep(backoff)
                backoff *= 2

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
