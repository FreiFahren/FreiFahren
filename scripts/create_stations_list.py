import json
import sys
from collections import defaultdict
from typing import Dict, List, Set

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
                code = (
                    tags.get("ref:ds100")
                    or tags.get("railway:ref")
                    or tags.get("ref")
                    or f"n{el['id']}"
                )
                stations[el["id"]] = {
                    "code": code,
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

        dataset[s["code"]] = {
            "coordinates": s["coordinates"],
            "lines": sorted(agg_lines),
            "name": s["name"],
        }

    # 4) Debug statistics
    empties = [k for k, v in dataset.items() if not v["lines"]]
    print(
        f"Stations total: {len(dataset)} | "
        f"with lines: {len(dataset) - len(empties)} | "
        f"without lines: {len(empties)}",
        file=sys.stderr,
    )

    return dataset


def postprocess_dataset(data: Dict[str, dict]) -> Dict[str, dict]:
    return data


def main() -> None:
    elements = fetch_elements()
    data = build_dataset(elements)
    data = postprocess_dataset(data)

    # Save to root json file
    with open("StationsList.json", "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


if __name__ == "__main__":
    main()
