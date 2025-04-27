from nlp_service.utils.logger import setup_logger
from nlp_service.core.dataloader import lines, stations_with_synonyms
from nlp_service.core.NER.TransportInformationRecognizer import (
    TextProcessor,
)

from typing import Optional, List
from fuzzywuzzy import process

logger = setup_logger()

"""
Preparation functions
"""

def get_all_stations(line: Optional[str] = None) -> List[str]:
    logger.debug("Getting all stations for the line: %s", line)

    all_stations = []
    line = line.upper() if line is not None else None

    if line is not None:
        # If a specific line is provided, add stations and synonyms from that line
        stations_of_line = lines.get(line, [])
        all_stations.extend([station.lower() for station in stations_of_line])
        logger.info("Stations of line: %s", all_stations)

        # Add synonyms for the stations on the specified line
        for station in stations_of_line:
            if station in stations_with_synonyms:
                synonyms = stations_with_synonyms[station]
                all_stations.extend([synonym.lower() for synonym in synonyms])
    else:
        # If no line is specified, add all stations and synonyms
        for station, synonyms in stations_with_synonyms.items():
            all_stations.append(station.lower())
            all_stations.extend([synonym.lower() for synonym in synonyms])

    return all_stations

def get_best_match(text, items, threshold=75):
    logger.debug("getting the best match")

    match = process.extractOne(text, items)
    best_match, score = match
    if score >= threshold:
        return best_match
    return None

def find_match_in_stations(
    best_match: str, stations_with_synonyms: dict
) -> Optional[str]:
    logger.debug("finding the match in stations for the best match: %s", best_match)

    for station, synonyms in stations_with_synonyms.items():
        if best_match in [station.lower()] + [synonym.lower() for synonym in synonyms]:
            return station
    return None

"""
Extraction functions
"""

def find_station(text, ticket_inspector, threshold=75):
    logger.debug("finding the station")

    all_stations = get_all_stations(ticket_inspector.line)

    # Use the NER Model to get the unrecognized stations from the text
    ner_results = TextProcessor.process_text(text)
    logger.info("NER results: %s", ner_results)

    for ner_result in ner_results:
        # Get the fuzzy match of the NER result with the stations
        best_match = get_best_match(ner_result, all_stations, threshold)
        if best_match:
            # Find the correct station name for the best match
            found_station_name = find_match_in_stations(
                best_match, stations_with_synonyms
            )
            if found_station_name:
                # Catch secret direction, as the next station
                # This is triggered when the direction could not be found via direction keywords
                if ticket_inspector.direction is None and len(ner_results) > 1:
                    best_match = get_best_match(ner_results[1], all_stations, threshold)
                    if best_match:
                        direction = find_match_in_stations(
                            best_match, stations_with_synonyms
                        )
                        if direction:
                            ticket_inspector.direction = direction
                return found_station_name
    return None