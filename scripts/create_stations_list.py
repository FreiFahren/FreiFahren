import json
import math
import re
import sys
from collections import defaultdict
from typing import Dict, List, Set

import requests
from config import CITY, ADMIN_LEVEL, LINES
from geo import haversine

# Regex that exactly matches any of the wanted refs, e.g.: ^(S1|S2|U1)$
line_regex = "^(" + "|".join(map(re.escape, LINES)) + ")$"

QUERY = rf"""
[out:json][timeout:1200];

// 2.1  {CITY} administrative area
area["name"="{CITY}"]["boundary"="administrative"]["admin_level"~"{ADMIN_LEVEL}"]->.a;

// 2.2  Route relations for the lines we want
relation
  ["type"="route"]
  ["route"~"^(train|subway|tram|light_rail)$"]
  ["ref"~"{line_regex}"]
  (area.a)
  ->.routes;

// 2.3  All member nodes (platforms, stop_positions, etc.)
(.routes; >>;)->.routeNodes;

// 2.4  stop_area relations that contain any of those nodes
rel
  ["public_transport"="stop_area"]
  (bn.routeNodes)
  ->.stopAreas;

// 2.5  All nodes inside those stop_areas (incl. station nodes)
(.stopAreas; >>;)->.stopNodes;

// 2.6  For completeness, also pull any station node referenced directly
node.routeNodes["railway"="station"]->.directStations;
node.routeNodes["public_transport"="station"]->.directStationsPT;

// 2.7  Union everything we need and output
(
  .routes;
  .stopAreas;
  .routeNodes;
  .stopNodes;
  .directStations;
  .directStationsPT;
);
out body;
"""


def fetch_elements() -> List[dict]:
    """
    Fetch the elements from the Overpass API.
    """
    print("[INFO] Fetching from Overpass …", file=sys.stderr, flush=True)
    OVERPASS_URL = "https://overpass-api.de/api/interpreter"
    r = requests.post(OVERPASS_URL, data={"data": QUERY}, timeout=180)
    r.raise_for_status()
    print(f"[INFO] Received {len(r.content)//1024} kB", file=sys.stderr)
    return r.json()["elements"]


def build_dataset(elements: List[dict]) -> Dict[str, dict]:
    """
    Build a dataset of stations from the elements fetched from the Overpass API.
    This will return a dictionary with station IDs as keys and station information as values.
    Something like this:
    {
        "SUM-n30731497": {
            "coordinates": {
                "latitude": 52.52158155454545,
                "longitude": 13.413028718181819
        },
        "lines": [
            "M2",
            "M4",
            "M5",
            "M6",
            "S3",
            "S5",
            "S7",
            "S9",
            "U2",
            "U5",
            "U8"
        ],
            "name": "Alexanderplatz"
        },
    }
    """
    stations: Dict[int, dict] = {}  # node id -> station meta
    node_to_lines: Dict[int, Set[str]] = defaultdict(set)  # node id -> {line}
    station_to_members: Dict[int, Set[int]] = defaultdict(
        set
    )  # station node id -> {member node ids}

    # Iterate once, gather info
    for el in elements:
        if el["type"] == "node":
            tags = el.get("tags", {})

            is_station = tags.get("railway") in (
                "station",
                "halt",
                "tram_stop",
                "platform",
            ) or tags.get("public_transport") in (
                "station",
                "stop_position",
                "platform",
            )
            if not is_station:
                continue

            code = (
                tags.get("ref:ds100")
                or tags.get("railway:ref")
                or tags.get("ref")
                or f"n{el['id']}"  # fallback
            )
            stations[el["id"]] = {
                "code": code,
                "name": tags.get("name", ""),
                "coordinates": {"latitude": el["lat"], "longitude": el["lon"]},
            }

        elif el["type"] == "relation":
            t = el.get("tags", {})
            if t.get("public_transport") == "stop_area":
                member_nodes = [m["ref"] for m in el["members"] if m["type"] == "node"]
                station_nodes = [
                    m["ref"]
                    for m in el["members"]
                    if m["type"] == "node"
                    and m.get("role") in ("station", "")
                    and m["ref"] in stations
                ]
                if not station_nodes:  # fallback
                    station_nodes = [mid for mid in member_nodes if mid in stations]
                for st in station_nodes:
                    station_to_members[st].update(member_nodes)

            elif t.get("type") == "route":
                ref = t.get("ref") or t.get("name")
                if ref not in LINES:  # keep only whitelisted lines
                    continue
                for m in el.get("members", []):
                    if m["type"] == "node":
                        node_to_lines[m["ref"]].add(ref)

    # Aggregate lines per station
    dataset: Dict[str, dict] = {}
    for st_id, s in stations.items():
        lines: Set[str] = set(node_to_lines.get(st_id, []))
        for n in station_to_members.get(st_id, []):
            lines.update(node_to_lines.get(n, []))
        lines &= set(LINES)  # enforce whitelist
        if not lines:
            print(f"[INFO] Dropping station {s['code']} without relevant lines")
            continue  # drop stations without relevant lines
        dataset[s["code"]] = {
            "coordinates": s["coordinates"],
            "lines": sorted(lines),
            "name": s["name"],
        }

    print(f"[STAT] Stations kept: {len(dataset)}", file=sys.stderr)
    return dataset


def merge_proximate(data: Dict[str, dict], threshold: float = 250.0) -> Dict[str, dict]:
    """
    OSM will sometimes have multiple stations that are in reality the same station.
    For example the Berlin Hauptbahnhof is devided into three stations (trams, S-Bahn,
    and Ubahn).
    This function merges stations that are close to each other. As Inspectors could just
    walk between the platforms, eg. from the Tram to the Ubahn, we merge them to reflect this.
    """
    merged: Dict[str, dict] = {}
    used: Set[str] = set()
    ids = list(data.keys())

    for i, sid in enumerate(ids):
        if sid in used:
            continue
        group = [sid]
        for oid in ids[i + 1 :]:
            if oid in used:
                continue
            if (
                haversine(data[sid]["coordinates"], data[oid]["coordinates"])
                <= threshold
            ):
                group.append(oid)
        used.update(group)
        # representative
        rep = group[0]
        merged[rep] = {
            "coordinates": {
                "latitude": sum(data[g]["coordinates"]["latitude"] for g in group)
                / len(group),
                "longitude": sum(data[g]["coordinates"]["longitude"] for g in group)
                / len(group),
            },
            "lines": sorted({ln for g in group for ln in data[g]["lines"]}),
            "name": data[rep]["name"],
        }
    print(
        f"[STAT] After merge (<{threshold}\u00a0m): {len(merged)} stations",
        file=sys.stderr,
    )
    return merged


def prefix_station_ids(data: Dict[str, dict]) -> Dict[str, dict]:
    """
    Add ID prefix based on lines served.
    This will make it easier to construct subgraphs for each transport mode.
    And also makes lookups more efficient as it would allow configuring index
    lookups for each transport mode.
    """
    prefixed: Dict[str, dict] = {}
    for station_id, station_info in data.items():
        lines = station_info["lines"]
        has_s: bool = any(l.startswith("S") for l in lines)
        has_u: bool = any(l.startswith("U") for l in lines)
        has_m: bool = any(l.startswith("M") or l.isdigit() for l in lines)
        if has_s and has_u and has_m:
            prefix = "SUM-"
        elif has_s and has_u:
            prefix = "SU-"
        elif has_s and has_m:
            prefix = "SM-"
        elif has_u and has_m:
            prefix = "UM-"
        elif has_s:
            prefix = "S-"
        elif has_u:
            prefix = "U-"
        elif has_m:
            prefix = "M-"
        else:
            prefix = ""
        prefixed[f"{prefix}{station_id}"] = station_info
    return prefixed


def main() -> None:
    """
    This script fetches the stations from the Overpass API and builds a list of stations.
    It then merges stations that are close to each other and adds a prefix to the station IDs
    based on the lines served. This is the first step to set up FreiFahren.
    """
    elements = fetch_elements()
    data = build_dataset(elements)
    data = merge_proximate(data)
    data = prefix_station_ids(data)

    with open("StationsList.json", "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    print("[DONE] StationsList.json written", file=sys.stderr)


if __name__ == "__main__":
    main()
