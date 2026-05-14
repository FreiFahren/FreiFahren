from __future__ import annotations

import asyncio
import logging
import signal

from mistralai.client import Mistral
from telegram.ext import Application, filters
from telegram.ext import MessageHandler as TgMessageHandler

from telegram_bot import config
from telegram_bot.extractor import Extractor
from telegram_bot.reporting import ReportClient
from telegram_bot.telegram import MessageHandler
from telegram_bot.transit import load_transit_data

logger = logging.getLogger(__name__)


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s — %(message)s",
    )
    # python-telegram-bot polls every ~10s; silence the per-request httpx noise.
    logging.getLogger("httpx").setLevel(logging.WARNING)


async def run() -> None:
    transit = await load_transit_data(config.BACKEND_URL)
    logger.info(
        "Loaded transit data: %d stations, %d line variants, %d distinct line names",
        len(transit.stations),
        len(transit.line_variants),
        len(transit.line_names),
    )

    mistral = Mistral(api_key=config.MISTRAL_API_KEY)
    extractor = Extractor(
        client=mistral,
        model=config.MISTRAL_MODEL,
        transit=transit,
    )
    reports = ReportClient(backend_url=config.BACKEND_URL, report_password=config.REPORT_PASSWORD)

    handler = MessageHandler(transit=transit, extractor=extractor, reports=reports)

    app = Application.builder().token(config.TELEGRAM_BOT_TOKEN).build()
    app.add_handler(TgMessageHandler(filters.TEXT & ~filters.COMMAND, handler.handle))

    stop_event = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    async with app:
        await app.start()
        await app.updater.start_polling()
        logger.info("Telegram polling started")
        try:
            await stop_event.wait()
        finally:
            logger.info("Shutting down")
            await app.updater.stop()
            await app.stop()
            await reports.aclose()


def main() -> None:
    configure_logging()
    asyncio.run(run())


if __name__ == "__main__":
    main()
