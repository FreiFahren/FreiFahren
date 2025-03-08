import requests
from nlp_service.config.config import BACKEND_URL
from nlp_service.utils.logger import setup_logger

import os
import json

logger = setup_logger()

"""
Data models
"""

class TicketInspector:
    def __init__(self, line, station, direction):
        self.line = line
        self.station = station
        self.direction = direction

"""
Functions for loading and preparing stations and lines data
"""

def load_data(filename):
    logger.debug("loading data from file: %s", filename)

    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, filename)
    with open(file_path, "r") as f:
        return json.load(f)


def create_lines_with_station_names(lines_with_ids, stations):
    lines_with_names = {}
    for line, station_ids in lines_with_ids.items():
        station_names = []
        for station_id in station_ids:
            if station_id in stations:
                station_names.append(stations[station_id]["name"])
            else:
                logger.error(f"Station ID {station_id} not found in stations data")
                station_names.append(station_id)  # Fallback to ID if name not found
        lines_with_names[line] = station_names
    return lines_with_names


"""
Calls for loading and preparing stations and lines data
"""

# Fetch lines data
response = requests.get(f"{BACKEND_URL}/v0/lines")
lines_with_stations_as_ids = response.json()

# Fetch stations data
stations_response = requests.get(f"{BACKEND_URL}/stations")
stations = stations_response.json()

# Create lines object with station names
lines = create_lines_with_station_names(lines_with_stations_as_ids, stations)

if lines is None:
    logger.error("Failed to load the stations and lines data")
    raise Exception("Failed to load the stations and lines data")

stations_with_synonyms = load_data("data/synonyms.json")
if stations_with_synonyms is None:
    logger.error("Failed to load the synonyms data")
    raise Exception("Failed to load the synonyms data")