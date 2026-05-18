import logging
from dataclasses import dataclass

import httpx

from telegram_bot.extractor import ExtractionResult, extraction_to_log
from telegram_bot.transit import TransitData, resolve_line_variant

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ReportClient:
    client: httpx.AsyncClient
    headers: dict[str, str]


def build_report_payload(
    *,
    station_id: str,
    line_id: str | None,
    direction_id: str | None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        'stationId': station_id,
        'source': 'telegram',
    }
    if line_id is not None:
        payload['lineId'] = line_id
    if direction_id is not None:
        payload['directionId'] = direction_id
    return payload


def report_identifiers(transit: TransitData, extraction: ExtractionResult) -> tuple[str, str | None, str | None] | None:
    if extraction.is_empty:
        logger.info('LLM returned no inspector report for this message')
        return None

    if extraction.station_id is None:
        # Backend requires at least one identifier and our pipeline keys off the station.
        logger.info('Extraction lacked stationId; skipping (%s)', extraction_to_log(extraction))
        return None

    line_id = (
        resolve_line_variant(transit, extraction.line_name, extraction.station_id)
        if extraction.line_name is not None
        else None
    )
    return extraction.station_id, line_id, extraction.direction_id


async def submit_report(
    reports: ReportClient,
    *,
    station_id: str,
    line_id: str | None,
    direction_id: str | None,
) -> bool:
    payload = build_report_payload(station_id=station_id, line_id=line_id, direction_id=direction_id)

    try:
        response = await reports.client.post('/v0/reports', json=payload, headers=reports.headers)
    except httpx.HTTPError:
        logger.exception('POST /v0/reports failed')
        return False

    if response.is_success:
        return True

    logger.error('POST /v0/reports returned %s: %s', response.status_code, response.text)
    return False


async def close_report_client(reports: ReportClient) -> None:
    await reports.client.aclose()
