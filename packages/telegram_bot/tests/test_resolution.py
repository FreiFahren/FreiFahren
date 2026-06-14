"""Unit tests for the deterministic resolution stage.

These exercise the seam below the LLM adapter: raw extracted strings (a
``StationNameExtraction``) + a detected line in, resolved station/direction ids out.
They build a tiny synthetic ``TransitData`` so they run in milliseconds with no backend
and no Mistral API key — the edge cases that previously only the eval harness covered.
"""

from __future__ import annotations

import pytest

from telegram_bot.extractor import (
    StationIndex,
    StationNameExtraction,
    normalize_name,
    pick_direction,
    pick_station,
    resolve_extraction,
)
from telegram_bot.transit import LineVariant, Station, TransitData


def _make_transit() -> TransitData:
    """A handful of real Berlin stations chosen to hit the disambiguation edge cases."""
    stations = {
        s.id: s
        for s in [
            Station(id='S-suedkreuz', name='Südkreuz', line_names=('S41', 'S42')),
            Station(id='U-turmstrasse', name='Turmstraße', line_names=('U9',)),
            Station(id='U-leinestrasse', name='Leinestraße', line_names=('U8',)),
            Station(id='U-rudow', name='Rudow', line_names=('U7',)),
            Station(id='U-rathaus-neukoelln', name='Rathaus Neukölln', line_names=('U7',)),
            Station(id='U-hermannplatz', name='Hermannplatz', line_names=('U7', 'U8')),
        ]
    }
    variants = (
        LineVariant(id='S41-v', name='S41', is_circular=True, stations=('S-suedkreuz',)),
        LineVariant(id='S42-v', name='S42', is_circular=True, stations=('S-suedkreuz',)),
        LineVariant(id='U9-v', name='U9', is_circular=False, stations=('U-turmstrasse',)),
        LineVariant(id='U8-v', name='U8', is_circular=False, stations=('U-leinestrasse', 'U-hermannplatz')),
        LineVariant(
            id='U7-v',
            name='U7',
            is_circular=False,
            stations=('U-rudow', 'U-rathaus-neukoelln', 'U-hermannplatz'),
        ),
    )
    variants_by_name: dict[str, list[LineVariant]] = {}
    for variant in variants:
        variants_by_name.setdefault(variant.name, []).append(variant)
    return TransitData(
        stations=stations,
        line_variants=variants,
        line_names=tuple(sorted(variants_by_name)),
        variants_by_name={name: tuple(vs) for name, vs in variants_by_name.items()},
        circular_line_names=('S41', 'S42'),
    )


@pytest.fixture(scope='module')
def index() -> StationIndex:
    return StationIndex.build(_make_transit())


# --- normalize_name ----------------------------------------------------------


@pytest.mark.parametrize(
    ('raw', 'expected'),
    [
        ('Südkreuz', 'sudkreuz'),  # diacritic folded to base letter
        ('sudkreuz', 'sudkreuz'),  # ascii input already matches
        ('  Südkreuz  ', 'sudkreuz'),  # surrounding whitespace stripped
        ('S Südkreuz', 'sudkreuz'),  # "S " prefix stripped
        ('U Turmstraße', 'turmstrasse'),  # "U " prefix + ß -> ss
        ('Leinestr.', 'leinestrasse'),  # "str." abbreviation expanded
        ('Leinestr', 'leinestrasse'),  # bare "str" suffix expanded
    ],
)
def test_normalize_name(raw: str, expected: str) -> None:
    assert normalize_name(raw) == expected


# --- pick_station ------------------------------------------------------------


def test_pick_station_resolves_diacritic_typo(index: StationIndex) -> None:
    picked = pick_station(index, 'sudkreuz', None)
    assert picked == ('S-suedkreuz', False)


def test_pick_station_on_line_match_is_flagged(index: StationIndex) -> None:
    assert pick_station(index, 'Rudow', 'U7') == ('U-rudow', True)


def test_pick_station_drops_line_when_station_is_off_it(index: StationIndex) -> None:
    """'u6 turmstr' — Turmstraße is on U9, so trust the station and drop the wrong line."""
    picked = pick_station(index, 'turmstr', 'U6')
    assert picked == ('U-turmstrasse', False)


def test_pick_station_rejects_generic_non_station_word(index: StationIndex) -> None:
    assert pick_station(index, 'Bahnhof', None) is None


def test_pick_station_returns_none_for_empty_query(index: StationIndex) -> None:
    assert pick_station(index, None, None) is None
    assert pick_station(index, '', None) is None


# --- pick_direction ----------------------------------------------------------


def test_pick_direction_restricts_to_line(index: StationIndex) -> None:
    assert pick_direction(index, 'Rudow', 'U7') == 'U-rudow'


def test_pick_direction_none_for_missing_query(index: StationIndex) -> None:
    assert pick_direction(index, None, 'U7') is None


# --- resolve_extraction (the full resolution stage) --------------------------


def test_resolve_extraction_station_and_direction(index: StationIndex) -> None:
    parsed = StationNameExtraction(station_name='Rathaus Neukölln', direction_name='Rudow')
    result = resolve_extraction(station_index=index, parsed=parsed, detected_line='U7')
    assert result.station_id == 'U-rathaus-neukoelln'
    assert result.line_name == 'U7'
    assert result.direction_id == 'U-rudow'


def test_resolve_extraction_drops_line_for_off_line_station(index: StationIndex) -> None:
    parsed = StationNameExtraction(station_name='Turmstraße')
    result = resolve_extraction(station_index=index, parsed=parsed, detected_line='U6')
    assert result.station_id == 'U-turmstrasse'
    assert result.line_name is None  # U6 dropped because Turmstraße isn't on it


def test_resolve_extraction_empty_when_nothing_matches(index: StationIndex) -> None:
    parsed = StationNameExtraction(station_name=None, direction_name=None)
    result = resolve_extraction(station_index=index, parsed=parsed, detected_line=None)
    assert result.is_empty
