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
