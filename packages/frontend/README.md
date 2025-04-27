# FreiFahren

## Overview

This repository contains the frontend code for the FreiFahren web application. The frontend is responsible for displaying the live map of ticket inspector locations, as well as providing a user-friendly interface for interacting with the data. The frontend communicates with the backend API to fetch real-time data and updates the map accordingly.

## Getting Started

### Prerequisites

-   [Node.js](https://nodejs.org/en/)

### Installation

1. Clone the repository

    ```sh
    git clone https://github.com/brandesdavid/FreiFahren
    ```

2. Install NPM packages

    ```sh
    npm install
    ```

3. Set up enviromental variables

    ```sh
    REACT_APP_JAWG_ACCESS_TOKEN=YOUR_JAWG_ACCESS_TOKEN
    REACT_APP_API_URL=http://localhost:8080

    // Map view. Default values are the Berlin view.
    REACT_APP_MAP_CENTER_LNG=13.388
    REACT_APP_MAP_CENTER_LAT=52.5162
    REACT_APP_MAP_BOUNDS_SW_LNG=12.8364646484805
    REACT_APP_MAP_BOUNDS_SW_LAT=52.23115511676795
    REACT_APP_MAP_BOUNDS_NE_LNG=14.00044556529124
    REACT_APP_MAP_BOUNDS_NE_LAT=52.77063424239867
    ```

    You can get a free access token from [Jawg](https://www.jawg.io/).

    You can get the map view bounds easier from [OpenStreetMap](https://www.openstreetmap.org/). Right click to center the map and the coordinates and zoom level will be shown in the URL. 
    
    Add routes by right clicking on the upper left corner and lower right corner of the map to get North East and South West bounds, shown in the URL as well.

4. Run the app
    ```sh
    npm start
    ```

## Markers and structure

To display the location on the map, inside the Map directory
are the markers. To display and organize the markers, `/components/Map/Markers/MarkerContainer.tsx` maintain, calculate and render multiple markers on the map.

1. `/Markers/Classes/LocationMarker/LocationMarker.tsx`, is called in `Map.tsx`. We use this marker to query for and display the current user's location
2. `/Markers/Classes/OpacityMarker/OpacityMarker.tsx` is called in `MarkerContainer.tsx`. They represent the unique user reports on inspectors and fade after a couple of minutes.

In hindsight, the Markers directory lays a foundation for other Markers with different features/
