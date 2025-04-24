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
    """Create segments between consecutive stations."""
    # handle split lines: generate segments for each branch
    if isinstance(merged_line, MultiLineString):
        segments_all: List[Dict[str, Any]] = []
        for branch in merged_line.geoms:
            segments_all.extend(
                create_segments(line_id, branch, line_stations, line_color)
            )
        return segments_all
    station_points = line_stations.geometry.values
    snapped_station_points: List[Point] = []
    station_distances: List[float] = []

    for station_point in station_points:
        dist = merged_line.project(station_point)
        snapped_station_points.append(merged_line.interpolate(dist))
        station_distances.append(dist)

    line_stations["snapped_geometry"] = snapped_station_points
    line_stations["distance_along_line"] = station_distances
    sorted_stations = line_stations.sort_values("distance_along_line")

    segments: List[Dict[str, Any]] = []
    records = sorted_stations.to_dict("records")
    for i in range(len(records) - 1):
        a, b = records[i], records[i + 1]
        start, end = a["distance_along_line"], b["distance_along_line"]
        if start > end:
            start, end = end, start
        seg_line = cut_line(merged_line, start, end)
        if seg_line.is_empty:
            continue
        segments.append(
            {
                "geometry": seg_line,
                "sid": f"{line_id}.{a['station_id']}:{b['station_id']}",
                "line_color": line_color,
            }
        )
    return segments


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
