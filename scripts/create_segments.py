import geopandas as gpd
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import linemerge
import json
import requests
from typing import List, Tuple, Dict, Any, Union
import os
import sys
from config import CITY, ADMIN_LEVEL, LINES

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def cut(line: LineString, distance: float) -> List[LineString]:
    """Cuts a line at a specified distance from its starting point."""
    if distance <= 0.0:
        return [LineString(), LineString(line)]
    elif distance >= line.length:
        return [LineString(line), LineString()]

    coords = list(line.coords)
    accumulated_distance = 0.0
    for i in range(len(coords) - 1):
        p1 = Point(coords[i])
        p2 = Point(coords[i + 1])
        seg_length = p1.distance(p2)
        accumulated_distance += seg_length
        if accumulated_distance == distance:
            return [LineString(coords[: i + 2]), LineString(coords[i + 1 :])]
        elif accumulated_distance > distance:
            ratio = (distance - (accumulated_distance - seg_length)) / seg_length
            x = coords[i][0] + ratio * (coords[i + 1][0] - coords[i][0])
            y = coords[i][1] + ratio * (coords[i + 1][1] - coords[i][1])
            cut_point = (x, y)
            return [
                LineString(coords[: i + 1] + [cut_point]),
                LineString([cut_point] + coords[i + 1 :]),
            ]
    return [LineString(line), LineString()]


def cut_line(
    line: LineString, start_distance: float, end_distance: float
) -> LineString:
    """Returns the segment of a line between two distances along the line."""
    if start_distance >= end_distance:
        return LineString()
    first_cut = cut(line, start_distance)
    second_cut = cut(first_cut[1], end_distance - start_distance)
    return second_cut[0]


def fetch_line_geometry(line_id: str) -> Union[LineString, MultiLineString]:
    """Fetch and merge OSM ways for the given line via Overpass API."""
    # 1) find the City-specific relation ID using the area filter
    id_query = rf"""
    [out:json][timeout:60];
    area["name"="{CITY}"]["boundary"="administrative"]["admin_level"~"{ADMIN_LEVEL}"]->.area;
    relation
      ["type"="route"]
      ["route"~"^(train|subway|tram|light_rail)$"]
      ["ref"="{line_id}"](area.area);
    out ids;
    """
    resp = requests.post(OVERPASS_URL, data={"data": id_query}, timeout=60)
    resp.raise_for_status()
    elements = resp.json().get("elements", [])
    if not elements:
        print(f"[WARN] No relation found for line {line_id}", file=sys.stderr)
        return LineString()
    rel_id = elements[0]["id"]

    # 2) fetch full geometry by relation ID without area filter
    geom_query = rf"""
    [out:json][timeout:360];
    relation({rel_id});
    way(r);
    (._;>;);
    out geom;
    """
    resp = requests.post(OVERPASS_URL, data={"data": geom_query}, timeout=360)
    resp.raise_for_status()
    elements = resp.json().get("elements", [])
    geoms: List[LineString] = []
    for el in elements:
        if el.get("type") == "way" and "geometry" in el:
            coords = [(pt["lon"], pt["lat"]) for pt in el["geometry"]]
            geoms.append(LineString(coords))
    merged = linemerge(geoms)
    # preserve all branches in case the line splits
    return merged


def fetch_line_api_tags(line_id: str) -> Dict[str, Any]:
    """Fetch tags for the given line via Overpass API."""
    id_query = rf"""
    [out:json][timeout:60];
    area["name"="{CITY}"]["boundary"="administrative"]["admin_level"~"{ADMIN_LEVEL}"]->.area;
    relation
      ["type"="route"]
      ["route"~"^(train|subway|tram|light_rail)$"]
      ["ref"="{line_id}"](area.area);
    out tags;
    """
    resp = requests.post(OVERPASS_URL, data={"data": id_query}, timeout=60)
    resp.raise_for_status()
    elements = resp.json().get("elements", [])
    if not elements:
        print(f"[WARN] No relation found for line {line_id}", file=sys.stderr)
        return {}
    tags = elements[0].get("tags", {})
    return tags


def create_segments(
    line_id: str,
    merged_line: Union[LineString, MultiLineString],
    line_stations: gpd.GeoDataFrame,
    line_color: str,
) -> List[Dict[str, Any]]:
    """Create segments between consecutive stations, handling potential line splits."""

    # 1. Snap stations to the line geometry (or its closest component)
    # Regardless of LineString or MultiLineString, project finds the nearest point
    station_points = line_stations.geometry.values
    snapped_station_points: List[Point] = []
    station_distances: List[float] = []

    for station_point in station_points:
        dist = merged_line.project(station_point)
        snapped_station_points.append(merged_line.interpolate(dist))
        station_distances.append(dist)

    line_stations["snapped_geometry"] = snapped_station_points
    line_stations["distance_along_line"] = station_distances
    # Sort stations based on the overall projected distance along the potentially complex line
    sorted_stations = line_stations.sort_values("distance_along_line")
    records = sorted_stations.to_dict("records")

    # 2. Handle segment creation based on geometry type
    if isinstance(merged_line, LineString):
        # Original logic for single LineString
        segments: List[Dict[str, Any]] = []
        for i in range(len(records) - 1):
            a, b = records[i], records[i + 1]
            # Use the pre-calculated distances along the single line
            start, end = a["distance_along_line"], b["distance_along_line"]

            # Basic check for valid distances
            if start > end:
                # This might indicate issues with projection or complex line shapes
                print(
                    f"[WARN] Station distances out of order for {line_id}: {a['station_id']} ({start}) -> {b['station_id']} ({end}). Skipping segment.",
                    file=sys.stderr,
                )
                continue
            if start == end:
                print(
                    f"[WARN] Zero distance between stations for {line_id}: {a['station_id']} and {b['station_id']}. Skipping segment.",
                    file=sys.stderr,
                )
                continue

            seg_line = cut_line(merged_line, start, end)
            # Add length check for robustness against tiny segments
            if seg_line.is_empty or seg_line.length < 1e-6:
                continue
            segments.append(
                {
                    "geometry": seg_line,
                    "sid": f"{line_id}.{a['station_id']}:{b['station_id']}",
                    "line_color": line_color,
                }
            )
        return segments

    elif isinstance(merged_line, MultiLineString):
        # Logic for MultiLineString: Find the best segment from available branches
        final_segments: List[Dict[str, Any]] = []

        # Iterate through station pairs based on the overall distance sort
        for i in range(len(records) - 1):
            a_record, b_record = records[i], records[i + 1]
            station_id_a = a_record["station_id"]
            station_id_b = b_record["station_id"]
            point_a = a_record["snapped_geometry"]  # Use snapped points
            point_b = b_record["snapped_geometry"]

            best_segment_geom = None
            min_off_track_dist = float("inf")

            for branch in merged_line.geoms:
                # Project this specific station pair onto this specific branch
                try:
                    # Project the SNAPPED points onto the current branch
                    d_a_branch = branch.project(point_a)
                    d_b_branch = branch.project(point_b)
                except Exception as e:
                    # This can happen if a station is very far from a specific branch
                    continue

                start_d = min(d_a_branch, d_b_branch)
                end_d = max(d_a_branch, d_b_branch)

                # Avoid zero-distance cuts
                if abs(start_d - end_d) < 1e-9:  # Use tolerance
                    continue

                candidate_geom = cut_line(branch, start_d, end_d)

                if candidate_geom.is_empty or candidate_geom.length < 1e-6:
                    continue

                # Quality check: How far is this segment from the snapped points?
                try:
                    off_track = point_a.distance(candidate_geom) + point_b.distance(
                        candidate_geom
                    )
                except Exception as e:
                    print(
                        f"[WARN] Error calculating distance between points and candidate segment for {station_id_a}-{station_id_b} on line {line_id}: {e}",
                        file=sys.stderr,
                    )
                    continue  # Skip this candidate if distance calc fails

                if off_track < min_off_track_dist:
                    min_off_track_dist = off_track
                    best_segment_geom = candidate_geom

            # After checking all branches, add the best segment found (if any)
            if best_segment_geom is not None:
                final_segments.append(
                    {
                        "geometry": best_segment_geom,
                        "sid": f"{line_id}.{station_id_a}:{station_id_b}",  # Keep original order in sid
                        "line_color": line_color,
                    }
                )
            else:
                print(
                    f"[WARN] Could not find suitable segment geometry between {station_id_a} and {station_id_b} for line {line_id} from any branch. Skipping segment.",
                    file=sys.stderr,
                )

        return final_segments

    else:
        # Should not happen if fetch_line_geometry returns LineString or MultiLineString
        print(
            f"[WARN] Unexpected geometry type for line {line_id}: {type(merged_line)}",
            file=sys.stderr,
        )
        return []


def main() -> None:
    """
    Main function to process and generate segments using Overpass API and local JSON.
    """
    # Load station and line definitions
    if not os.path.exists("StationsList.json"):
        raise FileNotFoundError(
            "StationsList.json not found. Run create_stations_list.py first."
        )
    if not os.path.exists("LinesList.json"):
        raise FileNotFoundError(
            "LinesList.json not found. Run create_lines_list.py first."
        )
    with open("StationsList.json") as f:
        stations_json = json.load(f)
    with open("LinesList.json") as f:
        lines_json = json.load(f)

    # Process segments for each line
    segments_list = []
    for line_id in LINES:
        print(f"[INFO] Processing line {line_id}")
        merged_line = fetch_line_geometry(line_id)

        # build station GeoDataFrame from precomputed JSON
        station_ids = lines_json.get(line_id)
        if not station_ids:
            print(f"[WARN] No stations for line {line_id}", file=sys.stderr)
            continue
        rows = []
        for sid in station_ids:
            info = stations_json.get(sid)
            if not info:
                raise ValueError(f"Station {sid} not found in StationsList.json")
            rows.append(
                {
                    "station_id": sid,
                    "geometry": Point(
                        info["coordinates"]["longitude"],
                        info["coordinates"]["latitude"],
                    ),
                }
            )
        line_stations = gpd.GeoDataFrame(rows, geometry="geometry", crs="EPSG:4326")
        api_tags = fetch_line_api_tags(line_id)

        # set correct line color based on API tags or rules
        api_color = api_tags.get("colour") or api_tags.get("color")
        route_type = api_tags.get("route", "")
        if line_id.startswith("S"):
            line_color = "#007734"
        elif route_type == "subway":
            line_color = api_color or "#000000"
        elif route_type in ("tram", "light_rail"):
            line_color = "#be1414"
        else:
            line_color = api_color or "#000000"

        line_segments = create_segments(line_id, merged_line, line_stations, line_color)
        segments_list.extend(line_segments)

    # Create and save final GeoDataFrame
    segments_gdf = gpd.GeoDataFrame(segments_list, crs="EPSG:4326")
    segments_gdf.to_file("segments.geojson", driver="GeoJSON")
    print(f"[DONE] Saved segments to segments.geojson")


if __name__ == "__main__":
    main()
