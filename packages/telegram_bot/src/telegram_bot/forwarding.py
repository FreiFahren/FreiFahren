from __future__ import annotations

import logging
from dataclasses import dataclass
from html import escape

from aiohttp import web
from telegram import LinkPreviewOptions
from telegram.ext import Application

from telegram_bot.transit import TransitData

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ForwardedReport:
    line_id: str | None
    station_id: str
    direction_id: str | None


def validate_forwarded_report(payload: object) -> ForwardedReport:
    if not isinstance(payload, dict):
        raise ValueError('JSON body must be an object')

    line_id = payload.get('lineId')
    station_id = payload.get('stationId')
    direction_id = payload.get('directionId')

    if line_id is not None and not isinstance(line_id, str):
        raise ValueError('lineId must be a string or null')
    if not isinstance(station_id, str) or station_id == '':
        raise ValueError('stationId must be a non-empty string')
    if direction_id is not None and not isinstance(direction_id, str):
        raise ValueError('directionId must be a string or null')

    allowed_keys = {'lineId', 'stationId', 'directionId'}
    if set(payload) != allowed_keys:
        raise ValueError('body must contain exactly lineId, stationId, and directionId')

    return ForwardedReport(line_id=line_id, station_id=station_id, direction_id=direction_id)


def validate_transit_references(transit: TransitData, report: ForwardedReport) -> None:
    if report.station_id not in transit.stations:
        raise ValueError(f'unknown stationId: {report.station_id}')

    if report.direction_id is not None and report.direction_id not in transit.stations:
        raise ValueError(f'unknown directionId: {report.direction_id}')

    line_name = transit.line_name_for_id(report.line_id) if report.line_id is not None else None
    if report.line_id is not None and line_name is None:
        raise ValueError(f'unknown lineId: {report.line_id}')

    if line_name is not None and line_name not in transit.station_line_names(report.station_id):
        raise ValueError(f'stationId {report.station_id} is not served by lineId {report.line_id}')

    if (
        line_name is not None
        and report.direction_id is not None
        and line_name not in transit.station_line_names(report.direction_id)
    ):
        raise ValueError(f'directionId {report.direction_id} is not served by lineId {report.line_id}')


def format_forwarded_report(transit: TransitData, report: ForwardedReport, public_app_url: str) -> str:
    station = transit.stations[report.station_id]
    direction = transit.stations[report.direction_id] if report.direction_id is not None else None
    line_name = transit.line_name_for_id(report.line_id) if report.line_id is not None else None
    station_url = f'{public_app_url}/station/{report.station_id}'

    lines = [f'<b>Station:</b> {escape(station.name)}']

    if line_name is not None:
        lines.append(f'<b>Line:</b> {escape(line_name)}')
    if direction is not None:
        lines.append(f'<b>Direction:</b> {escape(direction.name)}')

    lines.append('')
    lines.append(f'Mehr Informationen auf <a href="{escape(station_url, quote=True)}">{public_app_url}</a>')
    return '\n'.join(lines)


async def send_forwarded_report(
    app: Application,
    *,
    chat_id: str,
    transit: TransitData,
    report: ForwardedReport,
    public_app_url: str,
) -> None:
    await app.bot.send_message(
        chat_id=chat_id,
        text=format_forwarded_report(transit, report, public_app_url),
        parse_mode='HTML',
        link_preview_options=LinkPreviewOptions(
            is_disabled=False,
            prefer_large_media=False,
            show_above_text=False,
        ),
    )


async def handle_report_forward_request(
    *,
    request: web.Request,
    app: Application,
    chat_id: str,
    password: str,
    transit: TransitData,
    public_app_url: str,
) -> web.Response:
    if request.headers.get('X-Password') != password:
        raise web.HTTPUnauthorized(text='{"error": "unauthorized"}', content_type='application/json')

    try:
        payload = await request.json()
        report = validate_forwarded_report(payload)
        validate_transit_references(transit, report)
    except ValueError as exc:
        return web.json_response({'error': 'bad_request', 'detail': str(exc)}, status=400)

    try:
        await send_forwarded_report(
            app,
            chat_id=chat_id,
            transit=transit,
            report=report,
            public_app_url=public_app_url,
        )
    except Exception:
        logger.exception('Failed to forward app report to Telegram')
        return web.json_response({'error': 'telegram_send_failed'}, status=502)

    return web.json_response({'status': 'success'})


async def start_report_http_server(
    *,
    host: str,
    port: int,
    app: Application,
    chat_id: str,
    password: str,
    transit: TransitData,
    public_app_url: str,
) -> web.AppRunner:
    async def post_report(request: web.Request) -> web.Response:
        return await handle_report_forward_request(
            request=request,
            app=app,
            chat_id=chat_id,
            password=password,
            transit=transit,
            public_app_url=public_app_url,
        )

    web_app = web.Application()
    web_app.router.add_post('/report', post_report)

    runner = web.AppRunner(web_app)
    await runner.setup()

    site = web.TCPSite(runner, host=host, port=port)
    await site.start()

    logger.info('Report forwarding HTTP server listening on %s:%d', host, port)
    return runner
