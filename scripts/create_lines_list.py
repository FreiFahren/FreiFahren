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
    """Return the station IDs in travel order for a given line, merging any split segments."""
    # filter stations on this line
    station_ids = [sid for sid, info in stations.items() if line in info["lines"]]
    # return early for zero or single station
    if len(station_ids) <= 1:
        return station_ids
    coords = {sid: stations[sid]["coordinates"] for sid in station_ids}
    # build MST adjacency and derive path
    adj = build_mst(station_ids, coords)
    # detect branching stations (degree > 2)
    branch_nodes = [n for n, neigh in adj.items() if len(neigh) > 2]
    if not branch_nodes:
        # simple path
        return order_path(adj)
    # split into segments at the branching node
    branch_node = branch_nodes[0]
    segments: List[List[str]] = []
    for neighbor in adj[branch_node]:
        visited: Set[str] = set()
        stack = [neighbor]
        comp_nodes: Set[str] = set()
        while stack:
            cur = stack.pop()
            if cur in visited or cur == branch_node:
                continue
            visited.add(cur)
            comp_nodes.add(cur)
            for nb in adj[cur]:
                if nb != branch_node and nb not in visited:
                    stack.append(nb)
        comp_with_branch = comp_nodes.union({branch_node})
        comp_adj: Dict[str, List[str]] = {
            n: [m for m in adj[n] if m in comp_with_branch] for n in comp_with_branch
        }
        path = order_path(comp_adj)
        if path[0] != branch_node:
            path = list(reversed(path))
        segments.append(path)
    # merge all segments at the branching node, dropping duplicate
    merged: List[str] = segments[0]
    for seg in segments[1:]:
        merged += seg[1:]
    return merged


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
