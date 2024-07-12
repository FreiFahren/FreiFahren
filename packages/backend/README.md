# FreiFahren

## Overview

This repository is the backend that powers the Freifahren web application and API. The backend is responsible for handling requests from the frontend, processing data, and interacting with the database. It also includes a risk model that predicts the likelihood of ticket inspectors appearing at different locations based on current reports.

## Getting Started

### Prerequisites

- [Docker with Docker Compose](https://docs.docker.com/desktop/install/mac-install/)
- [just](https://github.com/casey/just)

### Installation

1. Simply clone the repository
   ```sh
   git clone https://github.com/brandesdavid/FreiFahren
    ```

### Running the application

1. Create a `.env` file in the root directory and add the following environment variables
    ```sh
    DB_URL=/app/db.sqlite3 # The path to the database file inside the container
    HOST_DB_URL=/path/to/host/db/file # The actual location you want the db file to be on your system
    ```
If you want to run tests locally, you also need a `.env.test` file with overrides for the above values (or just an empty file if you want to use the same values)

For prod, `.env.prod` should contain the overrides.

2. Run the application for development, with hot reloading
    ```sh
    just dev
    ```
3. Run tests
   ```sh
   just test
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
```

When commenting the ````//go:embed ...```  lines, go will compile these bytes into the binary too.
To get the json data from the binary, you should extract it like a normal file using JSON.unmarshal (take a look at ```ReadStationsAndLinesListFromBytes```) etc...
Go treats those binaries like files in the working directory.
It is recommended to write a helper function to unmarshal the json or other binaries, that can be used in other projects, like ```GetStationsList()```.
