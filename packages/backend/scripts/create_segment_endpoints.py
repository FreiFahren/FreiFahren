import json
from math import sqrt

def load_data(geojson_path, stations_path):
    basepath = '../'
    with open(basepath + geojson_path) as f:
        segments = json.load(f)
    with open(basepath + stations_path) as f:
        stations = json.load(f)
    return segments, stations


def find_closest_station(coord, stations):
    closest_station = None
    min_distance = float('inf')
    for sid, data in stations.items():
        lat, lon = data['coordinates']['latitude'], data['coordinates']['longitude']
        distance = sqrt((lat - coord[1]) ** 2 + (lon - coord[0]) ** 2)
        if distance < min_distance:
            min_distance = distance
            closest_station = sid
    return closest_station


def assign_stations_to_segments(segments, stations):
    results = {}
    for feature in segments['features']:
        sid = feature['properties']['sid']
        start_coord = feature['geometry']['coordinates'][0]
        end_coord = feature['geometry']['coordinates'][-1]
        start_station = find_closest_station(start_coord, stations)
        end_station = find_closest_station(end_coord, stations)
        results[sid] = [start_station, end_station]
    return results


def find_duplicate_segments(results):
    duplicates = {}
    segment_to_tuple_map = {}
    
    # Map sorted station tuple to segment IDs
    for sid, stations in results.items():
        stations_tuple = tuple(sorted(stations))  # Sort inorder to avoid issues with different order but same stations
        if stations_tuple not in duplicates:
            duplicates[stations_tuple] = []
        duplicates[stations_tuple].append(sid)
        segment_to_tuple_map[sid] = stations_tuple

    # Map each segment to all segments sharing the same station tuple
    segment_duplicates = {}
    for sid, stations_tuple in segment_to_tuple_map.items():
        # Avoid adding unique segments to the results
        if len(duplicates[stations_tuple]) > 1:
            segment_duplicates[sid] = duplicates[stations_tuple]

    return segment_duplicates


def main():
    segments, stations = load_data('Rstats/segments_v4.geojson', 'data/StationsList.json')
    results = assign_stations_to_segments(segments, stations)
    
    # save results to a file
    with open('../data/segmentEndpoints.json', 'w') as f:
        json.dump(results, f)

    duplicate_results = find_duplicate_segments(results)
    with open('../data/duplicateSegments.json', 'w') as f:
        json.dump(duplicate_results, f)


if __name__ == "__main__":
    main()
