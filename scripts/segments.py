import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import linemerge
import json
import requests
from typing import List, Tuple, Dict, Any


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


def fetch_api_data() -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Fetch stations and lines data from the API."""
    stations_json = requests.get("https://api.freifahren.org/stations").json()
    lines_json = requests.get("https://api.freifahren.org/v0/lines").json()
    lines = [line for line in lines_json]
    return stations_json, lines


def process_stations_data(stations_json: Dict[str, Any]) -> gpd.GeoDataFrame:
    """Process stations data into a GeoDataFrame."""
    stations_data = []
    for station_id, station_info in stations_json.items():
        stations_data.append(
            {
                "station_id": station_id,
                "latitude": station_info["coordinates"]["latitude"],
                "longitude": station_info["coordinates"]["longitude"],
                "lines": station_info["lines"],
                "name": station_info["name"],
            }
        )

    stations_df = pd.DataFrame(stations_data)
    stations_gdf = gpd.GeoDataFrame(
        stations_df,
        geometry=gpd.points_from_xy(stations_df.longitude, stations_df.latitude),
        crs="EPSG:4326",
    )

    stations_exploded = stations_gdf.explode("lines").reset_index(drop=True)
    stations_exploded.rename(columns={"lines": "line_id"}, inplace=True)
    return stations_exploded


def process_line_geometry(line_gdf: gpd.GeoDataFrame) -> LineString:
    """Process line geometry into a single LineString."""
    line_geoms = []
    for geom in line_gdf.geometry:
        if isinstance(geom, LineString):
            line_geoms.append(geom)
        elif isinstance(geom, MultiLineString):
            line_geoms.extend(geom.geoms)

    merged_line = linemerge(line_geoms)
    if isinstance(merged_line, MultiLineString):
        merged_line = max(merged_line.geoms, key=lambda ls: ls.length)
    return merged_line


def create_segments(
    line_id: str,
    merged_line: LineString,
    line_stations: gpd.GeoDataFrame,
    line_color: str,
) -> List[Dict[str, Any]]:
    """Create segments between consecutive stations."""
    station_points = line_stations.geometry.values
    snapped_station_points = []
    station_distances = []

    for station_point in station_points:
        nearest_distance = merged_line.project(station_point)
        nearest_point = merged_line.interpolate(nearest_distance)
        snapped_station_points.append(nearest_point)
        station_distances.append(nearest_distance)

    line_stations["snapped_geometry"] = snapped_station_points
    line_stations["distance_along_line"] = station_distances
    line_stations_sorted = line_stations.sort_values("distance_along_line")

    segments = []
    station_list = line_stations_sorted.to_dict("records")
    num_stations = len(station_list)

    for i in range(num_stations - 1):
        start_station = station_list[i]
        end_station = station_list[i + 1]

        start_distance = start_station["distance_along_line"]
        end_distance = end_station["distance_along_line"]

        if start_distance > end_distance:
            start_distance, end_distance = end_distance, start_distance

        segment = cut_line(merged_line, start_distance, end_distance)
        if segment.is_empty:
            continue

        segments.append(
            {
                "geometry": segment,
                "sid": f"{line_id}.{start_station['station_id']}:{end_station['station_id']}",
                "line_color": (
                    "#018A47"
                    if "S" in line_id
                    else (
                        "#BE1414" if "M" in line_id else line_color
                    )  # avoid giving each line a different color to avoid overwhelming the map
                ),
            }
        )

    return segments


def main() -> None:
    """
        Main function to process and generate segments. It will read the overpass export and create segments for all lines.
        In order to run this script, you need to have the overpass turbo query in the export.geojson file.
        Run this query to create the data for all lines:

        [out:json][timeout:25];
    // Define the area of Berlin
    {{geocodeArea:Berlin}}->.searchArea;
    (
      relation(id:1929070); // S1
      relation(id:2269238); // S2
      relation(id:2343465); // S3
      relation(id:2015959); // S5
      relation(id:2017023); // S7
      relation(id:2269252); // S8
      relation(id:2389946); // S9
      relation(id:2422951); // S25
      relation(id:7794031); // S26
      relation(id:14981); // S41
      relation(id:14983); // S42
      relation(id:2422929); // S46
      relation(id:2413846); // S47
      relation(id:2174798); // S75
      relation(id:2979451); // S85
      relation(id:2669205); // U1
      relation(id:2669184); // U2
      relation(id:2669208); // U3
      relation(id:2676945); // U4
      relation(id:2227744); // U5
      relation(id:2679164); // U6
      relation(id:2678986); // U7
      relation(id:2679014); // U8
      relation(id:2679017); // U9
      relation(id:2076230); // M1
      relation(id:1981932); // M2
      relation(id:2012424); // M4
      relation(id:5829220); // M5
      relation(id:2076355); // M6
      relation(id:5829222); // M8
      relation(id:2077032); // M10
      relation(id:2077077); // M13
      relation(id:2077162); // M17

    );

    out body;
    >;
    out skel qt;

    Using the relation id is important to get the line in only one direction.

    When creating the segments it is important to optimize for space efficiency as the json can easily become too large.
    """
    # Read the overpass output GeoJSON
    overpass_gdf = gpd.read_file("export.geojson")
    overpass_gdf = overpass_gdf[overpass_gdf["ref"].notnull()]

    # Fetch API data
    stations_json, lines = fetch_api_data()

    # Process stations data
    stations_exploded = process_stations_data(stations_json)

    # Get unique lines
    lines = overpass_gdf["ref"].unique()

    # Process segments for each line
    segments_list = []
    for line_id in lines:
        line_gdf = overpass_gdf[overpass_gdf["ref"] == line_id]
        merged_line = process_line_geometry(line_gdf)

        line_stations = stations_exploded[
            stations_exploded["line_id"] == line_id
        ].copy()
        line_color = (
            line_gdf.iloc[0]["colour"] if "colour" in line_gdf.columns else "#000000"
        )

        line_segments = create_segments(line_id, merged_line, line_stations, line_color)
        segments_list.extend(line_segments)

    # Create and save final GeoDataFrame
    segments_gdf = gpd.GeoDataFrame(segments_list, crs="EPSG:4326")
    segments_gdf.to_file("segments.geojson", driver="GeoJSON")


if __name__ == "__main__":
    main()
