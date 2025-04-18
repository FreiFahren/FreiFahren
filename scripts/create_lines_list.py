import json
import sys
from typing import Dict, List, Set, Tuple

from config import LINES
from geo import haversine

STATIONS_JSON = "StationsList.json"
OUTPUT_JSON = "LinesList.json"


def build_mst(
    nodes: List[str], coords: Dict[str, Dict[str, float]]
) -> Dict[str, List[str]]:
    """Build a minimum spanning tree (adjacency list) over the nodes keyed by distance."""
    # initialize
    mst_adj: Dict[str, List[str]] = {n: [] for n in nodes}
    unvisited: Set[str] = set(nodes)
    visited: Set[str] = set()
    # start from first node
    current = nodes[0]
    visited.add(current)
    unvisited.remove(current)
    # best distances to visited
    best: Dict[str, Tuple[float, str]] = {}
    for u in unvisited:
        best[u] = (haversine(coords[current], coords[u]), current)
    while unvisited:
        # find nearest unvisited node
        u_min, (dist, v_min) = min(best.items(), key=lambda item: item[1][0])
        # add edge
        mst_adj[v_min].append(u_min)
        mst_adj[u_min].append(v_min)
        # update sets
        visited.add(u_min)
        unvisited.remove(u_min)
        del best[u_min]
        # update best distances
        for u in unvisited:
            d = haversine(coords[u_min], coords[u])
            if d < best[u][0]:
                best[u] = (d, u_min)
    return mst_adj


def order_path(adj: Dict[str, List[str]]) -> List[str]:
    """Traverse the tree to produce an ordered path from one end to the other."""
    # endpoints have degree 1
    ends = [n for n, neigh in adj.items() if len(neigh) == 1]
    if not ends:
        # fallback: return arbitrary order
        return list(adj.keys())
    start = ends[0]
    path: List[str] = []
    prev: str = ""  # type: ignore
    curr: str = start
    while True:
        path.append(curr)
        neighbors = adj[curr]
        # pick next neighbor that's not where we came from
        next_nodes = [n for n in neighbors if n != prev]
        if not next_nodes:
            break
        prev, curr = curr, next_nodes[0]
    return path


def build_line_order(stations: Dict[str, dict], line: str) -> List[str]:
    """Return the list of station IDs in travel order for a given line."""
    # filter stations on this line
    station_ids = [sid for sid, info in stations.items() if line in info["lines"]]
    if len(station_ids) <= 1:
        return station_ids
    coords = {sid: stations[sid]["coordinates"] for sid in station_ids}
    # build MST adjacency and derive path
    adj = build_mst(station_ids, coords)
    return order_path(adj)


def main() -> None:
    # load stations data
    with open(STATIONS_JSON, "r") as f:
        stations = json.load(f)
    # build lines listing
    lines_list: Dict[str, List[str]] = {}
    for line in LINES:
        order = build_line_order(stations, line)
        if order:
            lines_list[line] = order

    # write output
    with open(OUTPUT_JSON, "w") as f:
        json.dump(lines_list, f, ensure_ascii=False, indent=4)
    print(f"[DONE] {OUTPUT_JSON} written with {len(lines_list)} lines", file=sys.stderr)


if __name__ == "__main__":
    main()
