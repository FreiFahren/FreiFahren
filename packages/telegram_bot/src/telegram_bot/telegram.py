import logging

from telegram import Update
from telegram.ext import ContextTypes

from telegram_bot.extractor import Extractor, extraction_to_log
from telegram_bot.reporting import ReportClient
from telegram_bot.spam import is_spam
from telegram_bot.transit import TransitData, resolve_line_variant

logger = logging.getLogger(__name__)


class MessageHandler:
    """Wires a Telegram message through spam filter → extractor → backend report."""

    def __init__(
        self,
        *,
        transit: TransitData,
        extractor: Extractor,
        reports: ReportClient,
    ) -> None:
        self.transit = transit
        self.extractor = extractor
        self.reports = reports

    async def handle(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        del context  # Required by the Telegram callback signature.

        message = update.effective_message
        if message is None or not message.text:
            return

        text = message.text
        chat = message.chat
        logger.info(
            "Received message from chat %s (%s): %r",
            chat.id if chat else None,
            chat.title or chat.username if chat else None,
            text,
        )
        if is_spam(text):
            logger.info("Skipped as spam: %r", text[:80])
            return

        extraction = await self.extractor.extract(text)
        if extraction is None:
            logger.info("No extraction produced (LLM error or unparseable)")
            return
        if extraction.is_empty:
            logger.info("LLM returned no inspector report for this message")
            return

        if extraction.station_id is None:
            # Backend requires at least one identifier and our pipeline keys off the station.
            logger.info("Extraction lacked stationId; skipping (%s)", extraction_to_log(extraction))
            return

        line_id: str | None = None
        if extraction.line_name is not None:
            line_id = resolve_line_variant(self.transit, extraction.line_name, extraction.station_id)

        logger.info(
            "Submitting report: %s (lineId=%s)",
            extraction_to_log(extraction),
            line_id,
        )

        await self.reports.submit(
            station_id=extraction.station_id,
            line_id=line_id,
            direction_id=extraction.direction_id,
        )
