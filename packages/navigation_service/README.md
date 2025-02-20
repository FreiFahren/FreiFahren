# Navigation Service

This microservice provides routing functionality with risk assessment for public transportation routes. It integrates with a routing engine and enriches the routes with risk data from a backend service.

## Features

-   Route calculation between stations
-   Risk assessment for each route segment
-   Returns safest route and up to 4 alternative routes

## Prerequisites

-   [Bun](https://bun.sh/) runtime
-   Access to the routing engine API
-   Access to the backend service for risk data

## Configuration

The service requires the following environment variables to be set in `.env`:

```env
BACKEND_URL=http://localhost:8080    # URL of the risk data backend
ENGINE_URL=https://api.transitous.org/api/v1    # URL of the routing engine
```

## Installation

```bash
# Install dependencies
bun install
```

## Running the Service

```bash
# Start the service
bun run dev
```

The service will run on port 7070 by default.

## API Endpoints

### POST /routes

Calculates routes between two stations, including risk assessment.

#### Request Format

```json
{
    "startStation": "station_id",
    "endStation": "station_id"
}
```

#### Example Request

```bash
curl -X POST http://localhost:7070/routes \
  -H "Content-Type: application/json" \
  -d '{
    "startStation": "station_id_1",
    "endStation": "station_id_2"
  }'
```

#### Response Format

The response includes:

-   The safest route as `safestRoute`
-   Up to 4 alternative routes as `alternativeRoutes`
-   Each route contains:
    -   Duration
    -   Start and end times
    -   Number of transfers
    -   Individual legs of the journey
    -   Calculated risk score

## Data Updates

The service automatically updates risk data every minute from the backend service. This ensures that route calculations always use the most current risk assessments.

## Required Files

The service expects a `stationsMap.prod.json` file in the root directory that maps between different station ID formats.
