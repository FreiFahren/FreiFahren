from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock

import pytest
from telegram import Bot

import telegram_bot.main as bot_main
from telegram_bot.extractor import ExtractionResult, StationIndex
from telegram_bot.reporting import ReportClient
from telegram_bot.telegram import telegram_text_callback
from telegram_bot.transit import TransitData
from tests.conftest import (
    ALLOWED_CHAT_ID,
    PickedStation,
    make_extraction,
    make_text_update,
)


def _build_handler(
    transit: TransitData,
    reports: ReportClient,
    extractor_context: tuple[Any, StationIndex, str],
):
    line_pattern, station_index, system_prompt = extractor_context
    return bot_main.build_handle_text(
        mistral=AsyncMock(),  # never called when extract() is stubbed
        transit=transit,
        reports=reports,
        model='unused',
        line_pattern=line_pattern,
        station_index=station_index,
        system_prompt=system_prompt,
    )


async def _invoke(callback, update) -> None:
    await callback(update, context=AsyncMock())


def _post_requests(recorded: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [r for r in recorded if r['method'] == 'POST' and '/v0/reports' in r['url']]


def _expect_single_post(recorded: list[dict[str, Any]]) -> dict[str, Any]:
    posts = _post_requests(recorded)
    assert len(posts) == 1, f'expected exactly one POST, got {len(posts)}'
    return json.loads(posts[0]['content'])


async def test_text_message_is_submitted_to_real_backend(
    monkeypatch: pytest.MonkeyPatch,
    fake_bot: Bot,
    transit: TransitData,
    picked_station: PickedStation,
    recording_report_client: ReportClient,
    recorded_requests: list[dict[str, Any]],
    extractor_context,
) -> None:
    extract_mock = AsyncMock(return_value=make_extraction(picked_station))
    monkeypatch.setattr(bot_main, 'extract', extract_mock)

    handle_text = _build_handler(transit, recording_report_client, extractor_context)
    callback = telegram_text_callback(handle_text, ALLOWED_CHAT_ID)
    update = make_text_update(bot=fake_bot, text='U2 alex 2x BOS')

    await _invoke(callback, update)

    assert extract_mock.await_count == 1
    body = _expect_single_post(recorded_requests)
    assert body['stationId'] == picked_station.station_id
    assert body['source'] == 'telegram'
    assert body['directionId'] == picked_station.direction_id
    assert body['lineId'] == picked_station.line_id


async def test_photo_with_caption_is_submitted(
    monkeypatch: pytest.MonkeyPatch,
    fake_bot: Bot,
    transit: TransitData,
    picked_station: PickedStation,
    recording_report_client: ReportClient,
    recorded_requests: list[dict[str, Any]],
    extractor_context,
) -> None:
    extract_mock = AsyncMock(return_value=make_extraction(picked_station))
    monkeypatch.setattr(bot_main, 'extract', extract_mock)

    handle_text = _build_handler(transit, recording_report_client, extractor_context)
    callback = telegram_text_callback(handle_text, ALLOWED_CHAT_ID)
    update = make_text_update(bot=fake_bot, caption='U2 alex 2x BOS', has_photo=True)

    await _invoke(callback, update)

    assert extract_mock.await_count == 1
    assert extract_mock.await_args.kwargs['message'] == 'U2 alex 2x BOS'
    _expect_single_post(recorded_requests)


async def test_sticker_without_text_or_caption_is_ignored(
    monkeypatch: pytest.MonkeyPatch,
    fake_bot: Bot,
    transit: TransitData,
    recording_report_client: ReportClient,
    recorded_requests: list[dict[str, Any]],
    extractor_context,
) -> None:
    extract_mock = AsyncMock()
    monkeypatch.setattr(bot_main, 'extract', extract_mock)

    handle_text = _build_handler(transit, recording_report_client, extractor_context)
    callback = telegram_text_callback(handle_text, ALLOWED_CHAT_ID)
    update = make_text_update(bot=fake_bot)

    await _invoke(callback, update)

    assert extract_mock.await_count == 0
    assert _post_requests(recorded_requests) == []


async def test_message_from_unallowed_chat_is_ignored(
    monkeypatch: pytest.MonkeyPatch,
    fake_bot: Bot,
    transit: TransitData,
    recording_report_client: ReportClient,
    recorded_requests: list[dict[str, Any]],
    extractor_context,
) -> None:
    extract_mock = AsyncMock()
    monkeypatch.setattr(bot_main, 'extract', extract_mock)

    handle_text = _build_handler(transit, recording_report_client, extractor_context)
    callback = telegram_text_callback(handle_text, ALLOWED_CHAT_ID)
    update = make_text_update(bot=fake_bot, text='U2 alex 2x BOS', chat_id=-9999)

    await _invoke(callback, update)

    assert extract_mock.await_count == 0
    assert _post_requests(recorded_requests) == []


@pytest.mark.parametrize(
    ('label', 'text'),
    [
        ('too_short', 'ok'),
        ('contains_question', 'is there a kontrolleur?'),
        ('too_long', 'a' * 251),
        ('contains_link', 'check http://x.example/foo'),
        ('too_many_emojis', '😀😀😀😀😀😀'),
    ],
)
async def test_spam_messages_are_dropped_before_extract(
    label: str,
    text: str,
    monkeypatch: pytest.MonkeyPatch,
    fake_bot: Bot,
    transit: TransitData,
    recording_report_client: ReportClient,
    recorded_requests: list[dict[str, Any]],
    extractor_context,
) -> None:
    extract_mock = AsyncMock()
    monkeypatch.setattr(bot_main, 'extract', extract_mock)

    handle_text = _build_handler(transit, recording_report_client, extractor_context)
    callback = telegram_text_callback(handle_text, ALLOWED_CHAT_ID)
    update = make_text_update(bot=fake_bot, text=text)

    await _invoke(callback, update)

    assert extract_mock.await_count == 0, f'spam variant {label} reached the extractor'
    assert _post_requests(recorded_requests) == [], f'spam variant {label} reached the backend'


async def test_empty_extraction_is_not_submitted(
    monkeypatch: pytest.MonkeyPatch,
    fake_bot: Bot,
    transit: TransitData,
    recording_report_client: ReportClient,
    recorded_requests: list[dict[str, Any]],
    extractor_context,
) -> None:
    extract_mock = AsyncMock(
        return_value=ExtractionResult(station_id=None, line_name=None, direction_id=None)
    )
    monkeypatch.setattr(bot_main, 'extract', extract_mock)

    handle_text = _build_handler(transit, recording_report_client, extractor_context)
    callback = telegram_text_callback(handle_text, ALLOWED_CHAT_ID)
    update = make_text_update(bot=fake_bot, text='this is fine')

    await _invoke(callback, update)

    assert extract_mock.await_count == 1
    assert _post_requests(recorded_requests) == []


async def test_extraction_without_station_id_is_not_submitted(
    monkeypatch: pytest.MonkeyPatch,
    fake_bot: Bot,
    transit: TransitData,
    picked_station: PickedStation,
    recording_report_client: ReportClient,
    recorded_requests: list[dict[str, Any]],
    extractor_context,
) -> None:
    extract_mock = AsyncMock(
        return_value=ExtractionResult(
            station_id=None,
            line_name=picked_station.line_name,
            direction_id=picked_station.direction_id,
        )
    )
    monkeypatch.setattr(bot_main, 'extract', extract_mock)

    handle_text = _build_handler(transit, recording_report_client, extractor_context)
    callback = telegram_text_callback(handle_text, ALLOWED_CHAT_ID)
    update = make_text_update(bot=fake_bot, text='somewhere with U2 toward Pankow')

    await _invoke(callback, update)

    assert extract_mock.await_count == 1
    assert _post_requests(recorded_requests) == []


async def test_extraction_with_only_station_id_is_submitted(
    monkeypatch: pytest.MonkeyPatch,
    fake_bot: Bot,
    transit: TransitData,
    picked_station: PickedStation,
    recording_report_client: ReportClient,
    recorded_requests: list[dict[str, Any]],
    extractor_context,
) -> None:
    extract_mock = AsyncMock(
        return_value=ExtractionResult(
            station_id=picked_station.station_id,
            line_name=None,
            direction_id=None,
        )
    )
    monkeypatch.setattr(bot_main, 'extract', extract_mock)

    handle_text = _build_handler(transit, recording_report_client, extractor_context)
    callback = telegram_text_callback(handle_text, ALLOWED_CHAT_ID)
    update = make_text_update(bot=fake_bot, text='alex 2x BOS')

    await _invoke(callback, update)

    body = _expect_single_post(recorded_requests)
    assert body['stationId'] == picked_station.station_id
    assert body['source'] == 'telegram'
    assert 'lineId' not in body
    assert 'directionId' not in body
