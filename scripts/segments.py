import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import linemerge
import json

"""
This script is used to generate the segments.json file, which is used to generate the segments GeoJSON file.
It will take the overpass output and the stationsList.json file and generate the segments.json file.
This is done by cutting the line between consecutive stations and forming segments out of them.
"""


def cut(line, distance):
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


def cut_line(line, start_distance, end_distance):
    """Returns the segment of a line between two distances along the line."""
    if start_distance >= end_distance:
        return LineString()
    first_cut = cut(line, start_distance)
    second_cut = cut(first_cut[1], end_distance - start_distance)
    return second_cut[0]


# Read the overpass output GeoJSON
overpass_gdf = gpd.read_file("export.geojson")

# Filter features with 'ref' property (tram lines)
overpass_gdf = overpass_gdf[overpass_gdf["ref"].notnull()]

# Read stationsList.json
with open("../packages/backend/data/stationsList.json", "r") as f:
    stations_json = json.load(f)

stations_data = []
for station_id, station_info in stations_json.items():
    latitude = station_info["coordinates"]["latitude"]
    longitude = station_info["coordinates"]["longitude"]
    lines = station_info["lines"]  # a list
    name = station_info["name"]
    stations_data.append(
        {
            "station_id": station_id,
            "latitude": latitude,
            "longitude": longitude,
            "lines": lines,
            "name": name,
        }
    )

stations_df = pd.DataFrame(stations_data)

# Convert stations_df to GeoDataFrame
stations_gdf = gpd.GeoDataFrame(
    stations_df,
    geometry=gpd.points_from_xy(stations_df.longitude, stations_df.latitude),
    crs="EPSG:4326",
)

# Explode the 'lines' column so that each station appears once per line
stations_exploded = stations_gdf.explode("lines").reset_index(drop=True)
stations_exploded.rename(columns={"lines": "line_id"}, inplace=True)

# Get the list of unique lines
lines = overpass_gdf["ref"].unique()

segments_list = []

for line_id in lines:
    # Get the line geometry
    line_gdf = overpass_gdf[overpass_gdf["ref"] == line_id]

    # Flatten geometries to ensure all are LineStrings
    line_geoms = []
    for geom in line_gdf.geometry:
        if isinstance(geom, LineString):
            line_geoms.append(geom)
        elif isinstance(geom, MultiLineString):
            line_geoms.extend(geom.geoms)
        else:
            # Handle other geometry types if necessary
            pass

    # Merge all the geometries into one LineString
    merged_line = linemerge(line_geoms)

    # Ensure merged_line is a LineString
    if isinstance(merged_line, MultiLineString):
        # If still MultiLineString, take the longest LineString
        merged_line = max(merged_line.geoms, key=lambda ls: ls.length)

    # Get the stations for this line
    line_stations = stations_exploded[stations_exploded["line_id"] == line_id].copy()
    station_points = line_stations.geometry.values

    # Snap the station points to the line geometry
    snapped_station_points = []
    station_distances = []
    for station_point in station_points:
        nearest_distance = merged_line.project(station_point)
        nearest_point = merged_line.interpolate(nearest_distance)
        snapped_station_points.append(nearest_point)
        station_distances.append(nearest_distance)

    line_stations["snapped_geometry"] = snapped_station_points
    line_stations["distance_along_line"] = station_distances

    # Sort the stations along the line
    line_stations_sorted = line_stations.sort_values("distance_along_line")

    # Get line color
    line_color = (
        line_gdf.iloc[0]["colour"] if "colour" in line_gdf.columns else "#000000"
    )

    # Extract segments between consecutive stations
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

        segment_properties = {
            "sid": f"{line_id}-{i+1}",
            "line": line_id,
            "line_color": line_color,
            "from_station_id": start_station["station_id"],
            "to_station_id": end_station["station_id"],
        }

        segments_list.append({"geometry": segment, **segment_properties})

# Create GeoDataFrame from segments_list
segments_gdf = gpd.GeoDataFrame(segments_list, crs="EPSG:4326")

# Save to GeoJSON
segments_gdf.to_file("segments.geojson", driver="GeoJSON")
