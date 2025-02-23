# Scripts

[Overpass Turbo](https://overpass-turbo.eu/) query to get the data for all lines:

```json
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
      relation(id:14981);   // S41
      relation(id:14983);   // S42
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
```

# Segments Generation 

## Overview
The `segments.py` script is responsible for converting raw transport line data into usable GeoJSON segments that represent sections of transport lines between stations. This is essential for:
- Visualizing transport lines on the map
- Calculating risk levels for different segments
- Managing overlapping line segments

## Quick Start


### Using the backend for the stations and lines data
If you use the (local) backend, uncomment in the `main()` function the following line to this:

```python
stations_json, lines = fetch_stations_and_lines_with_api("http://localhost:8080")

# stations_json, lines = fetch_stations_and_lines_with_file("stations.json", "lines.json")
```

Change the `url` parameter for the `fetch_stations_and_lines_with_api()` function to `http://localhost:8080` or your desired hosted backend url.


### Using the local files for stations and lines data
If you want to use the local files, uncomment in the `main()` function the following line to this:

```python
# stations_json, lines = fetch_stations_and_lines_with_api("http://localhost:8080")

stations_json, lines = fetch_stations_and_lines_with_file("stations.json", "lines.json")
```

Make sure to get the `stations.json` and `lines.json` files and place it into the `scripts/` folder, next to the `segments.py` file.

The `stations.json` -- which is also used in the backend inside the `data/` directory -- has this format:

```json
{
    "<station_id>": {
        "name": "<station_name>",
        "coordinates": {
            "latitude": <latitude>,
            "longitude": <longitude>
        },
        "lines": [
            "<line_id>",
            ...
        ]
    },
    "<station_id2>": {
        "name": "<station_name2>",
        "coordinates": {
            "latitude": <latitude2>,
            "longitude": <longitude2>
        },
        "lines": [
            "<line_id>",
            ...
        ]
    },
    ...
}
```

The `lines.json` has this format:

```json
{
    "<line_id>": [
        "<station_id>",
        "<station_id2>",
        ...
    ],
    "<line_id2>": [
        "<station_id>",
        "<station_id2>",
        ...
    ],
    ...
}
```

Then run the turbo query to get the data for all lines, and export it as a `geojson` file.
Also place that into the `scripts/` folder, next to the `segments.py` file.

Then you can run the script to generate the segments:
```bash
python segments.py
```

This will generate the `segments.geojson` file in the `scripts/` folder, which you can place into the `data/` folder of the backend.

## Detailed Process Flow

### 1. Line Cutting Utilities

```python
def cut(line: LineString, distance: float) -> List[LineString]:

def cut_line(line: LineString, start_distance: float, end_distance: float) -> LineString:
```

The script starts with two fundamental geometric operations:
- `cut()`: Splits a line at a specific distance point
- `cut_line()`: Extracts a segment between two points on a line

These functions use the Shapely library to handle geometric operations and ensure accurate line segmentation.

### 2. Data Fetching

```python
def fetch_stations_and_lines_with_api(url: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:

def fetch_stations_and_lines_with_file(stations_file: str, lines_file: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
```

The script can fetch data in two ways:
1. **API Mode**: Fetches directly from the FreiFahren API. The `url` parameter can be `http://localhost:8080`, which is from the backend
2. **File Mode**: Reads from local JSON files

Both methods return:
- Station data (coordinates, names, lines)
- Line data (route information)

### 3. Station Processing

```python
def process_stations_data(stations_json: Dict[str, Any]) -> gpd.GeoDataFrame:
```

The `process_stations_data` function:
1. Converts raw station JSON into a structured format
2. Creates a GeoDataFrame with:
   - Station coordinates
   - Line associations
   - Station metadata
3. Explodes multi-line stations into individual entries

### 4. Line Geometry Processing

```python
def process_line_geometry(line_gdf: gpd.GeoDataFrame) -> LineString:
```

`process_line_geometry`:
1. Handles both simple (LineString) and complex ([MultiLineString](https://wiki.openstreetmap.org/wiki/Relation:multilinestring)) geometries
2. Merges disconnected line segments
3. Selects the longest continuous segment if multiple exist

### 5. Segment Creation

```python
def create_segments(
    line_id: str,
    merged_line: LineString,
    line_stations: gpd.GeoDataFrame,
    line_color: str,
) -> List[Dict[str, Any]]:
```

The `create_segments` function:
1. Projects stations onto their lines
2. Sorts stations by their position along the line
3. Creates segments between consecutive stations
4. Assigns unique IDs and metadata to each segment

### 6. Main Process

```python
def main() -> None:
```

The main execution:
1. Reads OpenStreetMap data (from export.geojson)
2. Processes each transport line:
   - Extracts line geometry
   - Identifies stations on the line
   - Generates segments
3. Saves the final GeoJSON output

## Output Format
The script generates a GeoJSON file containing:
- Line segments with properties:
  - `sid`: Unique segment identifier
  - `line`: Transport line identifier
  - `line_color`: Visual styling information
  - `from_station_id` and `to_station_id`: Connected stations
  - Geometry data in GeoJSON format

## Usage in FreiFahren
The generated segments are used by the frontend component:

```typescript
const RiskLineLayer: React.FC<RiskLineLayerProps> = ({ lineSegments, preloadedRiskData }) => {
```

This component uses the segments to:
- Display transport lines on the map
- Apply risk-based coloring
- Handle segment interactions

## Dependencies
- `geopandas`: Geographic data processing
- `shapely`: Geometric operations
- `pandas`: Data manipulation
- `requests`: API communication

## Best Practices
1. Always validate input data format
2. Ensure consistent coordinate reference system (CRS)
3. Handle edge cases in line geometry
4. Maintain unique segment IDs
5. Consider overlapping segments for multi-line stations

This documentation should help developers understand how the segment generation process works and how it fits into the larger FreiFahren system.
