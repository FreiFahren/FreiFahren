from dataclasses import dataclass

import httpx


@dataclass(frozen=True)
class Station:
    id: str
    name: str
    line_names: tuple[str, ...]


@dataclass(frozen=True)
class LineVariant:
    id: str
    name: str
    is_circular: bool
    stations: tuple[str, ...]


@dataclass(frozen=True)
class TransitData:
    stations: dict[str, Station]
    """All stations keyed by id."""

    line_variants: tuple[LineVariant, ...]
    """All line variants as returned by the backend."""

    line_names: tuple[str, ...]
    """Deduplicated public line names."""

    variants_by_name: dict[str, tuple[LineVariant, ...]]
    """Variants grouped by public name."""

    circular_line_names: tuple[str, ...]
    """Deduplicated public names for circular line variants."""

    def station_line_names(self, station_id: str) -> set[str]:
        names: set[str] = set()
        for variant in self.line_variants:
            if station_id in variant.stations:
                names.add(variant.name)
        return names

    def line_name_for_id(self, line_id: str) -> str | None:
        for variant in self.line_variants:
            if variant.id == line_id:
                return variant.name
        return None

    def is_endpoint_of_line(self, line_name: str, station_id: str) -> bool:
        return any(station_id in variant.stations for variant in self.variants_by_name.get(line_name, ()))


async def load_transit_data(backend_url: str) -> TransitData:
    async with httpx.AsyncClient(base_url=backend_url, timeout=15.0) as client:
        stations_resp = await client.get("/v0/transit/stations")
        stations_resp.raise_for_status()
        raw_stations: dict[str, dict] = stations_resp.json()

        lines_resp = await client.get("/v0/transit/lines")
        lines_resp.raise_for_status()
        raw_lines: list[dict] = lines_resp.json()

    variants = tuple(
        LineVariant(
            id=line["id"],
            name=line["name"],
            is_circular=bool(line.get("isCircular", False)),
            stations=tuple[str, ...](line["stations"]),
        )
        for line in raw_lines
    )

    variants_by_name: dict[str, list[LineVariant]] = {}
    for variant in variants:
        variants_by_name.setdefault(variant.name, []).append(variant)

    stations = {
        station_id: Station(
            id=station_id,
            name=props["name"],
            line_names=tuple(props.get("lines", ())),
        )
        for station_id, props in raw_stations.items()
    }

    return TransitData(
        stations=stations,
        line_variants=variants,
        line_names=tuple(sorted(variants_by_name.keys())),
        variants_by_name={name: tuple(vs) for name, vs in variants_by_name.items()},
        circular_line_names=tuple(sorted({variant.name for variant in variants if variant.is_circular})),
    )


def resolve_line_variant(transit: TransitData, line_name: str, station_id: str | None) -> str | None:
    """Pick a concrete variant id for a public line name.

    Mirrors the frontend's longest-variant fallback: of the variants whose name matches
    (and which contain the station, if given), return the id of the one with the most stations.
    """

    candidates = transit.variants_by_name.get(line_name, ())
    if not candidates:
        return None

    if station_id is not None:
        with_station = tuple(v for v in candidates if station_id in v.stations)
        if with_station:
            candidates = with_station

    return max(candidates, key=lambda v: len(v.stations)).id
