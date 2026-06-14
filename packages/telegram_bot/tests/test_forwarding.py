from __future__ import annotations

import httpx
import pytest

from telegram_bot.transit import TransitData
from tests.conftest import FakeApp, PickedStation


async def test_valid_request_sends_telegram_message(
    forwarding_server: tuple[str, FakeApp],
    picked_station: PickedStation,
    report_password: str,
    transit: TransitData,
) -> None:
    base_url, app = forwarding_server
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{base_url}/report',
            headers={'X-Password': report_password},
            json={
                'stationId': picked_station.station_id,
                'lineId': picked_station.line_id,
                'directionId': picked_station.direction_id,
            },
        )

    assert response.status_code == 200
    assert response.json() == {'status': 'success'}

    app.bot.send_message.assert_awaited_once()
    call_kwargs = app.bot.send_message.await_args.kwargs
    text = call_kwargs['text']
    assert transit.stations[picked_station.station_id].name in text
    assert picked_station.line_name in text
    assert transit.stations[picked_station.direction_id].name in text
    # The deep link must carry utm params so the app can attribute Telegram arrivals in analytics.
    # The & is HTML-escaped in the message (&amp;) and unescaped by the client on click.
    assert f'/station/{picked_station.station_id}?utm_source=telegram' in text
    assert 'utm_medium=bot' in text


async def test_request_without_password_is_rejected(
    forwarding_server: tuple[str, FakeApp],
    picked_station: PickedStation,
) -> None:
    base_url, app = forwarding_server
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{base_url}/report',
            json={
                'stationId': picked_station.station_id,
                'lineId': picked_station.line_id,
                'directionId': picked_station.direction_id,
            },
        )

    assert response.status_code == 401
    app.bot.send_message.assert_not_awaited()


async def test_request_with_wrong_password_is_rejected(
    forwarding_server: tuple[str, FakeApp],
    picked_station: PickedStation,
) -> None:
    base_url, app = forwarding_server
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{base_url}/report',
            headers={'X-Password': 'totally-wrong'},
            json={
                'stationId': picked_station.station_id,
                'lineId': picked_station.line_id,
                'directionId': picked_station.direction_id,
            },
        )

    assert response.status_code == 401
    app.bot.send_message.assert_not_awaited()


@pytest.mark.parametrize(
    ('label', 'body'),
    [
        ('missing_station', {'lineId': None, 'directionId': None}),
        ('empty_station_id', {'lineId': None, 'stationId': '', 'directionId': None}),
        ('extra_key', {'lineId': None, 'stationId': 'x', 'directionId': None, 'extra': 1}),
        ('wrong_type_line', {'lineId': 123, 'stationId': 'x', 'directionId': None}),
        ('wrong_type_direction', {'lineId': None, 'stationId': 'x', 'directionId': 5}),
    ],
)
async def test_schema_violations_return_400(
    label: str,
    body: dict,
    forwarding_server: tuple[str, FakeApp],
    report_password: str,
) -> None:
    base_url, app = forwarding_server
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{base_url}/report',
            headers={'X-Password': report_password},
            json=body,
        )

    assert response.status_code == 400, f'variant {label} unexpectedly succeeded'
    app.bot.send_message.assert_not_awaited()


async def test_unknown_station_id_returns_400(
    forwarding_server: tuple[str, FakeApp],
    report_password: str,
) -> None:
    base_url, app = forwarding_server
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{base_url}/report',
            headers={'X-Password': report_password},
            json={'lineId': None, 'stationId': 'DOES_NOT_EXIST', 'directionId': None},
        )

    assert response.status_code == 400
    assert response.json().get('error') == 'bad_request'
    app.bot.send_message.assert_not_awaited()


async def test_line_not_serving_station_returns_400(
    forwarding_server: tuple[str, FakeApp],
    picked_station: PickedStation,
    transit: TransitData,
    report_password: str,
) -> None:
    # Find a line that does NOT serve picked_station.station_id.
    bad_line_id = next(
        (
            v.id
            for v in transit.line_variants
            if picked_station.station_id not in v.stations
        ),
        None,
    )
    if bad_line_id is None:
        pytest.skip('No line variant exists that does not serve the picked station')

    base_url, app = forwarding_server
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{base_url}/report',
            headers={'X-Password': report_password},
            json={
                'lineId': bad_line_id,
                'stationId': picked_station.station_id,
                'directionId': None,
            },
        )

    assert response.status_code == 400
    app.bot.send_message.assert_not_awaited()


async def test_telegram_send_failure_returns_502(
    forwarding_server: tuple[str, FakeApp],
    picked_station: PickedStation,
    report_password: str,
) -> None:
    base_url, app = forwarding_server
    app.bot.send_message.side_effect = RuntimeError('boom')

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f'{base_url}/report',
            headers={'X-Password': report_password},
            json={
                'stationId': picked_station.station_id,
                'lineId': picked_station.line_id,
                'directionId': picked_station.direction_id,
            },
        )

    assert response.status_code == 502
    app.bot.send_message.assert_awaited_once()
