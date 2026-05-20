from __future__ import annotations

import asyncio
import logging
import signal

import httpx
from mistralai.client import Mistral

from telegram_bot import config
from telegram_bot.extractor import (
    StationIndex,
    build_line_pattern,
    build_system_prompt,
    extract,
    extraction_to_log,
)
from telegram_bot.forwarding import start_report_http_server
from telegram_bot.reporting import ReportClient, close_report_client, report_identifiers, submit_report
from telegram_bot.spam import is_spam
from telegram_bot.telegram import build_telegram_app
from telegram_bot.transit import load_transit_data

logger = logging.getLogger(__name__)


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s %(levelname)s %(name)s — %(message)s',
    )
    # python-telegram-bot polls every ~10s; silence the per-request httpx noise.
    logging.getLogger('httpx').setLevel(logging.WARNING)


async def run() -> None:
    transit = await load_transit_data(config.BACKEND_URL)
    logger.info(
        'Loaded transit data: %d stations, %d line variants, %d distinct line names',
        len(transit.stations),
        len(transit.line_variants),
        len(transit.line_names),
    )

    mistral = Mistral(api_key=config.MISTRAL_API_KEY)
    line_pattern = build_line_pattern(transit.line_names)
    station_index = StationIndex.build(transit)
    system_prompt = build_system_prompt(transit)
    reports = ReportClient(
        client=httpx.AsyncClient(base_url=config.BACKEND_URL, timeout=15.0),
        headers={'X-Password': config.REPORT_PASSWORD},
    )

    async def handle_text(text: str) -> None:
        if is_spam(text):
            logger.info('Skipped as spam: %r', text[:80])
            return

        extraction = await extract(
            message=text,
            transit=transit,
            client=mistral,
            model=config.MISTRAL_MODEL,
            line_pattern=line_pattern,
            station_index=station_index,
            system_prompt=system_prompt,
        )
        if extraction is None:
            logger.info('No extraction produced (LLM error or unparseable)')
            return

        identifiers = report_identifiers(transit, extraction)
        if identifiers is None:
            return

        station_id, line_id, direction_id = identifiers
        logger.info(
            'Submitting report: %s',
            extraction_to_log(extraction)
        )
        await submit_report(
            reports,
            station_id=station_id,
            line_id=line_id,
            direction_id=direction_id,
        )

    app = build_telegram_app(
        token=config.TELEGRAM_BOT_TOKEN,
        handle_text=handle_text,
    )

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    async with app:
        await app.start()
        report_http_server = await start_report_http_server(
            host=config.REPORT_HTTP_HOST,
            port=config.REPORT_HTTP_PORT,
            app=app,
            chat_id=config.TELEGRAM_REPORT_CHAT_ID,
            password=config.REPORT_PASSWORD,
            transit=transit,
            public_app_url=config.PUBLIC_APP_URL,
        )
        await app.updater.start_polling()
        logger.info('Telegram polling started')
        try:
            await stop_event.wait()
        finally:
            logger.info('Shutting down')
            await report_http_server.cleanup()
            await app.updater.stop()
            await app.stop()
            await close_report_client(reports)


def main() -> None:
    configure_logging()
    asyncio.run(run())


if __name__ == '__main__':
    main()
