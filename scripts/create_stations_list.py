import json
import sys
from collections import defaultdict
from typing import Dict, List, Set
import math

import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

QUERY = r"""
[out:json][timeout:1200];

// Berlin Boundary
area["name"="Berlin"]["boundary"="administrative"]["admin_level"~"^[4-6]$"]
  ->.a;

// Station nodes
(
  node["railway"="station"](area.a);
  node["public_transport"="station"](area.a);
)->.stations;

// stop_area relations
relation["public_transport"="stop_area"](bn.stations)->.stopAreas;

// All station & stop_area members
(.stations; .stopAreas;);
>> -> .stopNodes;

// Routes containing any of these nodes
rel["type"="route"]["route"~"^(train|subway|tram|light_rail)$"](area.a)(bn.stopNodes)
  ->.routes;

// Output everything
(.stations; .stopAreas; .routes;);
out body;
"""


def fetch_elements() -> List[dict]:
    print("Fetching data from Overpass …", file=sys.stderr, flush=True)
    resp = requests.post(OVERPASS_URL, data={"data": QUERY}, timeout=180)
    resp.raise_for_status()
    print(f"Received {len(resp.content)//1024} kB", file=sys.stderr)
    return resp.json()["elements"]


def build_dataset(elements: List[dict]) -> Dict[str, dict]:
    # 1) Build the basic dataset
    stations: Dict[int, dict] = {}
    node_to_lines: Dict[int, Set[str]] = defaultdict(set)
    station_to_members: Dict[int, Set[int]] = defaultdict(set)

    # 2) First loop – Stations, Stop‑Areas, Routes
    for el in elements:
        if el["type"] == "node":
            tags = el.get("tags", {})
            if (
                tags.get("railway") == "station"
                or tags.get("public_transport") == "station"
            ):
                station_id = (
                    tags.get("ref:ds100")  # code for german railways
                    or tags.get("railway:ref")
                    or tags.get("ref")
                    or f"n{el['id']}"
                )
                stations[el["id"]] = {
                    "station_id": station_id,
                    "name": tags.get("name", ""),
                    "coordinates": {"latitude": el["lat"], "longitude": el["lon"]},
                }

        elif el["type"] == "relation":
            t = el.get("tags", {})
            if t.get("public_transport") == "stop_area":
                # Collect members
                member_nodes = [m["ref"] for m in el["members"] if m["type"] == "node"]
                # Find station nodes within the stop_area
                station_nodes = [
                    m["ref"]
                    for m in el["members"]
                    if m["type"] == "node"
                    and m.get("role") in ("station", "")
                    and m["ref"] in stations
                ]
                if not station_nodes:
                    # Fallback: any member node is a station
                    station_nodes = [mid for mid in member_nodes if mid in stations]
                for st in station_nodes:
                    station_to_members[st].update(member_nodes)

            elif t.get("type") == "route":
                ref = t.get("ref") or t.get("name")
                if not ref:
                    continue
                for m in el.get("members", []):
                    if m["type"] == "node":
                        node_to_lines[m["ref"]].add(ref)

    # 3) Propagate lines to stations
    dataset: Dict[str, dict] = {}
    for st_id, s in stations.items():
        agg_lines: Set[str] = set()

        # a) Lines directly at the station node
        agg_lines.update(node_to_lines.get(st_id, []))

        # b) Lines at all stop_area members
        for n in station_to_members.get(st_id, []):
            agg_lines.update(node_to_lines.get(n, []))

        dataset[s["station_id"]] = {
            "coordinates": s["coordinates"],
            "lines": sorted(agg_lines),
            "name": s["name"],
        }

    # 4) Debug statistics
    print(
        f"Stations total: {len(dataset)}",
        file=sys.stderr,
    )

    return dataset


def _haversine_distance(coord1: Dict[str, float], coord2: Dict[str, float]) -> float:
    """Return the great-circle distance between two coordinates in meters."""
    lat1, lon1 = math.radians(coord1["latitude"]), math.radians(coord1["longitude"])
    lat2, lon2 = math.radians(coord2["latitude"]), math.radians(coord2["longitude"])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    return 6371000 * c


def postprocess_dataset(data: Dict[str, dict]) -> Dict[str, dict]:
    # Step 1: remove stations with empty 'lines'
    filtered_data: Dict[str, dict] = {
        station_id: station_info
        for station_id, station_info in data.items()
        if station_info.get("lines")
    }
    # Step 2: merge stations within 250 meters
    merged_data: Dict[str, dict] = {}
    processed_ids: Set[str] = set()
    for station_id, station_info in filtered_data.items():
        if station_id in processed_ids:
            continue
        # find nearby stations
        group_ids: List[str] = [station_id]
        for other_id, other_info in filtered_data.items():
            if other_id not in processed_ids and other_id != station_id:
                distance = _haversine_distance(
                    station_info["coordinates"],
                    other_info["coordinates"],
                )
                if distance <= 250.0:
                    group_ids.append(other_id)
        processed_ids.update(group_ids)
        # representative station
        rep_id = group_ids[0]
        # combine lines
        combined_lines = sorted(
            {
                line
                for station_id in group_ids
                for line in filtered_data[station_id]["lines"]
            }
        )
        # pick name from representative
        name = filtered_data[rep_id]["name"]
        # average coordinates
        average_lat = sum(
            filtered_data[station_id]["coordinates"]["latitude"]
            for station_id in group_ids
        ) / len(group_ids)
        average_lon = sum(
            filtered_data[station_id]["coordinates"]["longitude"]
            for station_id in group_ids
        ) / len(group_ids)
        merged_data[rep_id] = {
            "coordinates": {"latitude": average_lat, "longitude": average_lon},
            "lines": combined_lines,
            "name": name,
        }
    return merged_data


def main() -> None:
    elements = fetch_elements()
    data = build_dataset(elements)
    data = postprocess_dataset(data)

    # Save to root json file
    with open("StationsList.json", "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


if __name__ == "__main__":
    main()
