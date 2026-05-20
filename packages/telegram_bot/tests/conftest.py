from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from typing import Any
from unittest.mock import AsyncMock

import httpx
import pytest
import pytest_asyncio
from telegram import Bot, Update

from telegram_bot.extractor import ExtractionResult, StationIndex, build_line_pattern, build_system_prompt
from telegram_bot.forwarding import start_report_http_server
from telegram_bot.reporting import ReportClient
from telegram_bot.transit import LineVariant, Station, TransitData, load_transit_data

ALLOWED_CHAT_ID = '-1001'
PUBLIC_APP_URL = 'https://app.example.test'


@pytest.fixture(scope='session')
def backend_url() -> str:
    return os.environ.get('BACKEND_URL', 'http://localhost:3000').rstrip('/')


@pytest.fixture(scope='session')
def report_password() -> str:
    return os.environ.get('REPORT_PASSWORD', 'password')


@pytest.fixture(scope='session')
def allowed_chat_id() -> str:
    return ALLOWED_CHAT_ID


@pytest_asyncio.fixture(scope='session')
async def transit(backend_url: str) -> TransitData:
    return await load_transit_data(backend_url)


@dataclass(frozen=True)
class PickedStation:
    """A station chosen from real transit data so tests don't hardcode IDs."""

    station_id: str
    line_id: str
    line_name: str
    direction_id: str


@pytest.fixture(scope='session')
def picked_station(transit: TransitData) -> PickedStation:
    """Pick a real station+line+direction triple that the backend will accept.

    Strategy: find a line variant with at least two stations, take the first
    station as the report location and the last station as the direction.
    """
    for variant in transit.line_variants:
        if len(variant.stations) < 2:
            continue
        station_id = variant.stations[0]
        direction_id = variant.stations[-1]
        return PickedStation(
            station_id=station_id,
            line_id=variant.id,
            line_name=variant.name,
            direction_id=direction_id,
        )
    pytest.fail('No line variant with >=2 stations found in transit data')


@pytest.fixture(scope='session')
def extractor_context(transit: TransitData) -> tuple[Any, StationIndex, str]:
    return build_line_pattern(transit.line_names), StationIndex.build(transit), build_system_prompt(transit)


@pytest_asyncio.fixture
async def report_client(backend_url: str, report_password: str) -> ReportClient:
    client = httpx.AsyncClient(base_url=backend_url, timeout=15.0)
    try:
        yield ReportClient(client=client, headers={'X-Password': report_password})
    finally:
        await client.aclose()


@pytest.fixture
def recorded_requests() -> list[dict[str, Any]]:
    return []


@pytest_asyncio.fixture
async def recording_report_client(
    backend_url: str,
    report_password: str,
    recorded_requests: list[dict[str, Any]],
) -> ReportClient:
    """ReportClient that records every outgoing request for assertion.

    Requests still hit the real backend, so the round-trip validates the contract.
    """

    async def log_request(request: httpx.Request) -> None:
        recorded_requests.append(
            {
                'method': request.method,
                'url': str(request.url),
                'headers': dict(request.headers),
                'content': request.content.decode('utf-8') if request.content else '',
            }
        )

    client = httpx.AsyncClient(
        base_url=backend_url,
        timeout=15.0,
        event_hooks={'request': [log_request]},
    )
    try:
        yield ReportClient(client=client, headers={'X-Password': report_password})
    finally:
        await client.aclose()


@pytest.fixture
def fake_bot() -> Bot:
    return Bot(token='1:fake')


@dataclass
class FakeApp:
    """Minimal stand-in for telegram.ext.Application — only carries .bot.

    Avoids Application.initialize()'s getMe() network call. The forwarding
    code only ever touches `app.bot.send_message`.
    """

    bot: Any


@pytest.fixture
def telegram_app() -> FakeApp:
    bot = AsyncMock()
    bot.send_message = AsyncMock(return_value=None)
    return FakeApp(bot=bot)


def _pick_free_port() -> int:
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


@pytest_asyncio.fixture
async def forwarding_server(
    telegram_app: FakeApp,
    transit: TransitData,
    report_password: str,
    allowed_chat_id: str,
) -> tuple[str, FakeApp]:
    """Start the bot's /report HTTP server on a free port; yield (base_url, app)."""
    port = _pick_free_port()
    runner = await start_report_http_server(
        host='127.0.0.1',
        port=port,
        app=telegram_app,  # type: ignore[arg-type]
        chat_id=allowed_chat_id,
        password=report_password,
        transit=transit,
        public_app_url=PUBLIC_APP_URL,
    )
    try:
        yield f'http://127.0.0.1:{port}', telegram_app
    finally:
        await runner.cleanup()


def make_text_update(
    *,
    bot: Bot,
    text: str | None = None,
    caption: str | None = None,
    chat_id: int | str = int(ALLOWED_CHAT_ID),
    update_id: int = 1,
    message_id: int = 100,
    has_photo: bool = False,
) -> Update:
    """Build a synthetic telegram.Update without going through PTB's network stack."""
    message: dict[str, Any] = {
        'message_id': message_id,
        'date': 1_716_220_800,
        'chat': {'id': int(chat_id), 'type': 'supergroup', 'title': 'tests'},
        'from': {'id': 42, 'is_bot': False, 'first_name': 'Tester'},
    }
    if text is not None:
        message['text'] = text
    if caption is not None:
        message['caption'] = caption
    if has_photo:
        message['photo'] = [
            {'file_id': 'photo-1', 'file_unique_id': 'pu1', 'width': 100, 'height': 100},
        ]
    return Update.de_json({'update_id': update_id, 'message': message}, bot)


def make_extraction(picked: PickedStation) -> ExtractionResult:
    return ExtractionResult(
        station_id=picked.station_id,
        line_name=picked.line_name,
        direction_id=picked.direction_id,
    )


__all__ = [
    'ALLOWED_CHAT_ID',
    'PUBLIC_APP_URL',
    'FakeApp',
    'LineVariant',
    'PickedStation',
    'Station',
    'make_extraction',
    'make_text_update',
]
