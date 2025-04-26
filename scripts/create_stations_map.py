import json
import math
import argparse
import sys
from pathlib import Path
from typing import TypedDict, Dict, Literal, cast
from config import CITY

import requests

# Define script directory relative to this script's location
script_dir = Path(__file__).parent


class Coordinates(TypedDict):
    latitude: float
    longitude: float


class StationInfo(TypedDict):
    name: str
    coordinates: Coordinates


StationList = Dict[str, StationInfo]


class EngineStationCoordinates(TypedDict):
    lat: float
    lon: float


class StationIdMapEntry(TypedDict):
    name: str
    engineId: str
    coordinates: EngineStationCoordinates


StationsMap = Dict[str, StationIdMapEntry]

ProductionStationMap = Dict[str, str]


# note: this has to be adjusted for each city, berlin specifig logic
def get_station_type_prefix(station_id: str) -> str:
    """Determines the station type prefix (e.g., 'S+U ') from the ID."""
    prefix = station_id.split("-")[0]
    if "S" in prefix and "U" in prefix:
        return "S+U "
    elif "S" in prefix:
        return "S "
    elif "U" in prefix:
        return "U "
    return ""


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the distance between two lat/lon points in kilometers."""
    R = 6371  # Earth's radius in kilometers
    dLat = math.radians(lat2 - lat1)
    dLon = math.radians(lon2 - lon1)
    a = math.sin(dLat / 2) * math.sin(dLat / 2) + math.cos(
        math.radians(lat1)
    ) * math.cos(math.radians(lat2)) * math.sin(dLon / 2) * math.sin(dLon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def create_stations_map(stations: StationList) -> None:
    """
    Creates a development stations map by matching FreiFahren stations
    to engine stations using the transitous.org geocode API.
    Saves the result to stationsMap.json in the project root.
    """
    # Initialize as a single dictionary
    output: StationsMap = {}
    geocode_url_template = "https://api.transitous.org/api/v1/geocode?text={}"
    headers = {"Content-Type": "application/json"}
    max_distance_km = 0.5

    total_stations = len(stations)
    print(f"Processing {total_stations} stations...")

    for i, (freifahren_id, station) in enumerate(stations.items()):
        print(
            f"  ({i + 1}/{total_stations}) Processing: {station['name']} ({freifahren_id})",
            end="\r",
        )
        try:
            # Germany/Berlin based logic replace with city specific logic
            prefix = get_station_type_prefix(freifahren_id)
            station_name = station["name"].replace("straße", "str")
            encoded_name = requests.utils.quote(f"{prefix}{station_name} ({CITY})")
            url = geocode_url_template.format(encoded_name)

            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()  # Raise an exception for bad status codes

            data = response.json()

            matching_stations = []
            if isinstance(data, list):
                for s in data:
                    if (
                        isinstance(s, dict)
                        and s.get("type") == "STOP"
                        and "lat" in s
                        and "lon" in s
                    ):
                        distance = calculate_distance(
                            station["coordinates"]["latitude"],
                            station["coordinates"]["longitude"],
                            s["lat"],
                            s["lon"],
                        )
                        if distance <= max_distance_km:
                            matching_stations.append(s)

            if matching_stations:
                # Simple approach: take the first match (API returns sorted by relevance)
                best_match = matching_stations[0]
                # Assign directly to the output map
                output[freifahren_id] = {
                    "name": station["name"],
                    "engineId": best_match["id"],
                    "coordinates": {
                        "lat": best_match["lat"],
                        "lon": best_match["lon"],
                    },
                }
            else:
                # Assign unmatched station with empty engineId directly to the output map
                output[freifahren_id] = {
                    "name": station["name"],
                    "engineId": "",
                    "coordinates": {
                        "lat": station["coordinates"]["latitude"],
                        "lon": station["coordinates"]["longitude"],
                    },
                }

        except requests.exceptions.RequestException as e:
            print(
                f"\nError processing station {station['name']} ({freifahren_id}): API Request failed: {e}"
            )
            # Assign error station with empty engineId directly to the output map
            output[freifahren_id] = {
                "name": station["name"],
                "engineId": "",
                "coordinates": {
                    "lat": station["coordinates"]["latitude"],
                    "lon": station["coordinates"]["longitude"],
                },
            }
        except Exception as e:
            print(
                f"\nError processing station {station['name']} ({freifahren_id}): {e}"
            )
            # Assign error station with empty engineId directly to the output map
            output[freifahren_id] = {
                "name": station["name"],
                "engineId": "",
                "coordinates": {
                    "lat": station["coordinates"]["latitude"],
                    "lon": station["coordinates"]["longitude"],
                },
            }

    print("\n" + "=" * 30)  # Newline after progress indicator
    num_entries = len(output)
    num_unmatched = sum(1 for entry in output.values() if not entry["engineId"])
    num_matched = num_entries - num_unmatched
    print(
        f"Created map with {num_entries} total entries."
        f" ({num_matched} matched, {num_unmatched} needing manual input)."
    )

    output_path = script_dir / "stationsMap.json"
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"Development stations map saved to {output_path}")
    except IOError as e:
        print(
            f"Error saving development stations map to {output_path}: {e}",
            file=sys.stderr,
        )
        sys.exit(1)


def post_process_stations_map() -> None:
    """
    Reads the development stationsMap.json, creates a simplified
    production map (freifahrenId -> engineId), and saves it to
    stationsMap.prod.json in the script's directory.
    """
    input_path = script_dir / "stationsMap.json"
    output_path = script_dir / "stationsMap.prod.json"

    try:
        print(f"Reading development map from: {input_path}")
        with open(input_path, "r", encoding="utf-8") as f:
            # Load the simplified map structure
            dev_map = cast(StationsMap, json.load(f))

        production_map: ProductionStationMap = {}

        # Process all stations from the dev map
        for freifahren_id, station_data in dev_map.items():
            if isinstance(station_data, dict) and "engineId" in station_data:
                engine_id = station_data["engineId"]
                # Only include entries with a non-empty engineId in the production map
                if (
                    isinstance(engine_id, str) and engine_id
                ):  # Check if string and not empty
                    production_map[freifahren_id] = engine_id
            else:
                print(
                    f"Warning: Invalid data format for station {freifahren_id}. Skipping.",
                    file=sys.stderr,
                )

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(production_map, f, indent=2, ensure_ascii=False)

        print(f"Production version of stations map saved to {output_path}")
        print(f"Total mappings in production map: {len(production_map)}")

    except FileNotFoundError:
        print(
            f"Error: Development stations map not found at {input_path}.",
            file=sys.stderr,
        )
        print("Please run the script without 'post-process' first.", file=sys.stderr)
        sys.exit(1)
    except (IOError, json.JSONDecodeError) as e:
        print(f"Error processing stations map: {e}", file=sys.stderr)
        sys.exit(1)


def main() -> None:
    """Main function to parse arguments and run selected mode."""
    parser = argparse.ArgumentParser(
        description="""
        Create or post-process a map between FreiFahren station IDs and engine station IDs.
        Reads stations data from 'StationsList.json' in the script's directory.
        Requires the 'requests' library (pip install requests).
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "mode",
        nargs="?",
        choices=["create", "post-process"],
        default="create",
        help=(
            "Mode of operation: 'create' (default) generates the initial stationsMap.json "
            "using the geocode API. 'post-process' reads stationsMap.json and creates "
            "stationsMap.prod.json."
        ),
    )

    args = parser.parse_args()

    if args.mode == "post-process":
        post_process_stations_map()
    else:  # create mode
        stations_file_path = script_dir / "StationsList.json"
        try:
            print(f"Reading stations data from: {stations_file_path}")
            with open(stations_file_path, "r", encoding="utf-8") as f:
                # Cast assumed structure
                stations_data = cast(StationList, json.load(f))
            if not isinstance(stations_data, dict):
                raise TypeError(
                    "StationsList.json should contain a JSON object (dictionary)."
                )
            print(f"Successfully read {len(stations_data)} stations.")
            create_stations_map(stations_data)
        except FileNotFoundError:
            print(
                f"Error: Stations data file not found at {stations_file_path}",
                file=sys.stderr,
            )
            sys.exit(1)
        except (IOError, json.JSONDecodeError, TypeError) as e:
            print(f"Error reading or parsing stations data: {e}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"An unexpected error occurred during creation: {e}", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()
