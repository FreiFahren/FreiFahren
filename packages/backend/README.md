# FreiFahren

## Overview

This repository is the backend that powers the Freifahren web application and API. The backend is responsible for handling requests from the frontend, processing data, and interacting with the database. It also includes a risk model that predicts the likelihood of ticket inspectors appearing at different locations based on current reports.

## Getting Started

### Prerequisites

- Go version 1.22 or later
- PostgreSQL 13 or later

### Installation

1. Clone the repository
   ```sh
   git clone https://github.com/brandesdavid/FreiFahren
    ```

2. Install Go packages
    ```sh
    go mod download
    ```

3. Set up the database

### Running the application

1. Create a `.env` file in the root directory and add the following environment variables
    ```sh
    DB_USER
    DB_PASSWORD
    DB_HOST
    DB_PORT
    DB_NAME
    DB_READER
    DB_READER_PASSWORD
    ```

2. Run the application
    ```sh
    go run main.go
    ```

  Or if you want to run the application with hot reloading of the server and swag documentation, you can use the following command:
    ```sh
    reflex -c reflex.conf
    ```


## Embedded Binary

When building this project, go compiles every external data like JSON files or executables into the same binary.
This helps us synchronize our data, when running the backend, as it is standalone and can be run anywhere, without needing external dependencies. 

# Add new data to the embedding:

In embedJSONFiles.go, take a look at 

```go
//go:embed StationsAndLinesList.json
var embeddedStationsAndLinesList []byte

//go:embed LinesList.json
var embeddedLinesList []byte

//go:embed StationsList.json
var embeddedStationsList []byte

//go:embed duplicateSegments.json
var embeddedDuplicateSegments []byte
```

When commenting the ````//go:embed ...```  lines, go will compile these bytes into the binary too.
To get the json data from the binary, you should extract it like a normal file using JSON.unmarshal (take a look at ```ReadStationsAndLinesListFromBytes```) etc...
Go treats those binaries like files in the working directory.
It is recommended to write a helper function to unmarshal the json or other binaries, that can be used in other projects, like ```GetStationsList()```.

## How it works

We have several API endpoints that allow users to interact with the application. The main endpoints are:

### Getting the id of a station

- `/id` - This endpoint is used to get the id of a station given its name. It is case and whitespace insensitive.

The request should be a `GET` request with the following query parameters:
    - `name` - The name of the station

**Example:**
```sh
curl -X GET "http://localhost:8080/id?name=alexanderplatz"
```

It will return the id as a text response.

**Response:**
```sh
"SU-A"
```

### Reporting a new inspector sighting

- `/newInspector` - This endpoint is used to add a new inspector sighting to the database.

The request should be a `POST` request with the following JSON body:
    - `line` - The line on which the inspector was sighted (optional)
    - `station` - The station at which the inspector was sighted (optional)
    - `direction` - The direction in which the inspector was headed (optional)
    - `message` - the entire message or the description comming from the app


Example:
```sh
curl -X POST http://localhost:8080/newInspector \
     -H "Content-Type: application/json" \
     -d '{"line":"S7","station":"Alexanderplatz","direction":"Ahrensfelde", "author":12345, "message":"Hello world"}'
```

It will return a json response with the content of the inspector sighting.

**Response:**
```json
{"line":"S7","station":{"id":"SU-A","name":"Alexanderplatz"},"direction":{"id":"S-Ah","name":"Ahrensfelde"}}
```

### Receive the last known stations

- `/recent` - This endpoint is used to get the last known stations. It uses if-Modified-Since to cache the response and only return a new response if the data has changed.
If the actual number of current stations are not enough we will add stations that are predicted. You can find out how the prediction works [here](https://github.com/FreiFahren/backend/docs/HistoricData.md).

The request should be a `GET` request, with this example, where the header timestamp is before the last known sighting of an inspector.:

**Example:**
```sh
curl -X GET http://localhost:8080/recent \
     -H "If-Modified-Since: 2024-03-19T18:07:40.893188Z"
```

**Response:**
```json
[
  {
    "timestamp": "2024-03-17T14:42:25.932507Z",
    "station": {
      "id": "SU-HMS",
      "name": "Hermannstraße",
      "coordinates": {
        "latitude": 52.467622,
        "longitude": 13.4309698
      }
    },
    "direction": {
      "id": "",
      "name": "",
      "coordinates": {
        "latitude": 0,
        "longitude": 0
      }
    },
    "line": "U8",
    "message": "Hello World"
  },
]

```

If there is no 'If-Modified-Since' header, it will return the same response as the previous example.

If the 'If-Modified-Since' header is after the last known sighting of an inspector, it will return a `304 Not Modified` response.


### Get lists of stations and lines

- `/list` - This endpoint is used to GET an overview of all stations and lines, and their connections.


The request should be a `GET` request, with this example:

**Example:**
```sh
curl -X GET http://localhost:8080/list \
     -H "Content-Type: application/json"
```

**Response:**
```json
{
  "lines": [
    {
      "U1": ["SU-WA", "etc.."]
    },


  ],
  "stations": {
    "U-Ado": {
      "name": "Adenauer Platz",
            "coordinates": {
                "latitude": 52.4998948,
                "longitude": 13.3071423
            },
            "lines": [
                "U7"
            ]
        },
    }
}
```

- `/list?station=true` - This endpoint is used to GET an overview of all stations and their connections


The request should be a `GET` request, with this example:

Example:
```sh
curl -X GET http://localhost:8080/list?station=true \
     -H "Content-Type: application/json"
```
It will return the station.json with this body:

```json
{
    "U-Ado": {
        "name": "Adenauer Platz",
        "coordinates": {
            "latitude": 52.4998948,
            "longitude": 13.3071423
        },
        "lines": [
            "U7"
        ]
    },
}
```

- `/list?lines=true` - This endpoint is used to GET an overview of all lines and their stations


The request should be a `GET` request, with this example:

Example:
```sh
curl -X GET http://localhost:8080/list?lines=true \
     -H "Content-Type: application/json"
```
It will return the station.json with this body:

```json
{
    "U1": [
        "SU-WA",
        "U-S",
        "U-Gr",
        "U-Kbo",
        "U-Pr",
        "U-HaT",
        "U-Mo",
        "U-Go",
        "U-Kus",
        "U-Nm",
        "U-Wt",
        "U-Kfu",
        "U-U"
    ],
}
```

### Get the station distance of two locations

- `/distance` - This endpoint is used to get the station distance in stops between two location

#### Process:
  1. We get the coordinates from our inspector's station id
  2. Calculate the distance of the user and the station, if it is less than 1 km, we return 1 station distance
        - Implying that the user is either at or near the station. Calculating the distance would be unnecessary because we can't such handle precision, while it is also not needed. Only for bus transit.
  3. If higher than 1, we calculate the nearest station to the user.
  4. Then we use dijkstra to create the shortest path possible and return the number of passed stations

**Params:**
The endpoint finds the nearest station to that location:
- ``inspectorStationId={string}`` for the inspector's current station id
- ``userLat={float64}`` and ``userLon={float64}`` for the user's location.


The request should be a `GET` request, with this example:

**Example:**

From Ernst-Reuter-Platz to Mehringdamm
```sh
curl -X GET 'http://localhost:8080/distance?inspectorStationId=U-Me&userLat=52.51188493793791&userLon=13.322164399678371'

```

**Response:**
```json
7

```

## Get usage statistics

- `/stats` - This endpoint is used to GET the number of reports made in the last 24 hours.


The request should be a `GET` request, with this example:

**Example:**
```sh
curl -X GET http://localhost:8080/stats
```

The response will be a number of reports made in the last 24 hours.
**Response:**
```text
{integer}
```

## Get the list of highlighted segments and their colors
- `/getSegmentColors` - This endpoint returns a list of transport segments and their respective colors based on the most recent risk model.

This endpoint uses the If-Modified-Since header to optimize network usage. If the data hasn't changed since the time provided in the header, the server will respond with 304 Not Modified

**Response:**
When there are updates, the response includes a list of segments with their corresponding color changes. It also provides the last modified timestamp of the risk model data.

**Example:**
```sh
curl -X GET http://localhost:8080/getSegmentColors \
     -H "If-Modified-Since: 2024-03-19T18:07:40.893188Z"
```

**Successful Response:**
```json
{
  "LastModified": "2024-03-19T18:07:40.893188Z",
  "SegmentColors": {
    "S1-1": "#FACB3F",
    "U4-7": "#F05044",
    ...
  }
}
```
If data not modified:
HTTP status 304 Not Modified.
The response will include detailed information about segments, such as their IDs and associated color changes, reflecting the latest risk assessments.
