package inspectors

import (
	"strings"

	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	structs "github.com/FreiFahren/backend/utils"
)

func postProcessInspectorData(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers) error {
	logger.Log.Debug().Msg("Filling missing columns using provided data")

	var stations = data.GetStationsList()
	var lines = data.GetLinesList()

	if dataToInsert.Line == "" && (dataToInsert.Station.ID != "" || dataToInsert.Direction.ID != "") {
		if err := AssignLineIfSingleOption(dataToInsert, pointers, stations[dataToInsert.Station.ID], stations[dataToInsert.Direction.ID]); err != nil {
			logger.Log.Error().Err(err).Msg("Error assigning line if single option in postInspector")
			return err
		}
	}

	if dataToInsert.Station.ID == "" && dataToInsert.Line != "" {
		stationsOnLine := lines[dataToInsert.Line]
		if err := guessStation(dataToInsert, pointers, stationsOnLine); err != nil {
			logger.Log.Error().Err(err).Msg("Error guessing station ID in postInspector")
			return err
		}
	}

	if dataToInsert.Direction.ID == "" && dataToInsert.Line != "" && dataToInsert.Station.ID != "" {
		if err := DetermineDirectionIfImplied(dataToInsert, pointers, lines[dataToInsert.Line], dataToInsert.Station.ID, stations); err != nil {
			logger.Log.Error().Err(err).Msg("Error determining direction if implied in postInspector")
			return err
		}
	}

	// If the direction is the same as the station, remove the direction
	if dataToInsert.Direction.ID == dataToInsert.Station.ID {
		dataToInsert.Direction = structs.Station{}
		pointers.DirectionIDPtr = nil
		pointers.DirectionNamePtr = nil

		if dataToInsert.Line != "" {
			// in case the direction was the same as the station, but the line was provided, we can determine the correct direction
			// e.g. Line: U6, Station: Alt-Mariendorf, Direction: Alt-Mariendorf it should be removed and reset to Kurt-Schumacher-Platz
			if err := DetermineDirectionIfImplied(dataToInsert, pointers, lines[dataToInsert.Line], dataToInsert.Station.ID, stations); err != nil {
				logger.Log.Error().Err(err).Msg("Error determining direction if implied in postInspector")
				return err
			}
		}

		logger.Log.Debug().Msg("Removed direction because it was the same as the station")
	}

	// if Station is not on the given line, remove the line
	if dataToInsert.Station.ID != "" && !structs.StringInSlice(dataToInsert.Line, stations[dataToInsert.Station.ID].Lines) {
		dataToInsert.Line = ""
		pointers.LinePtr = nil

		// try to assign the line if the station is uniquely served by one line
		if err := AssignLineIfSingleOption(dataToInsert, pointers, stations[dataToInsert.Station.ID], stations[dataToInsert.Direction.ID]); err != nil {
			logger.Log.Error().Err(err).Msg("Error assigning line if single option in postInspector")
			return err
		}
		// try to determine the direction if the line was found
		if dataToInsert.Line != "" {
			if err := DetermineDirectionIfImplied(dataToInsert, pointers, lines[dataToInsert.Line], dataToInsert.Station.ID, stations); err != nil {
				logger.Log.Error().Err(err).Msg("Error determining direction if implied in postInspector")
				return err
			}
		}

		logger.Log.Debug().Msg("Removed line because the station was not on it")
	}

	// If Direction is not on the same given line, remove the direction
	if dataToInsert.Direction.ID != "" && !structs.StringInSlice(dataToInsert.Line, stations[dataToInsert.Station.ID].Lines) {
		dataToInsert.Direction = structs.Station{}
		pointers.DirectionIDPtr = nil
		pointers.DirectionNamePtr = nil
		logger.Log.Debug().Msg("Removed direction because it was not on the same line")
	}

	return nil
}

// Given a request with a line but no station, guess the station based on the most common station on the line.
//
// Parameters:
// 		- dataToInsert: The data to insert into the database.
// 		- pointers: The pointers to the fields necessary for inserting data into the database.
// 		- stationsOnLine: The list of stations on the line.
//
// Returns:
//		- An error if there was a problem querying the database.
//
// This function queries the database to find the most common station on the line and assigns it to the dataToInsert. 
// This is being done to avoid storing useless data, as we would otherwise serve historic data to the users, which is not very accurate.
func guessStation(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers, stationsOnLine []string) error {
	logger.Log.Debug().Msg("Guessing station ID based on line")

	// Query the database to find the most common station on this line
	mostCommonStation, err := database.GetMostCommonStationId(stationsOnLine)
	if err != nil {
		logger.Log.Error().Err(err).Str("line", dataToInsert.Line).Msg("Error querying for most common station")
		return err
	}

	if mostCommonStation != "" {
		dataToInsert.Station.ID = mostCommonStation
		pointers.StationIDPtr = &mostCommonStation

		// Get the station name from the stations list
		stations := data.GetStationsList()
		if station, found := stations[mostCommonStation]; found {
			dataToInsert.Station.Name = station.Name
			pointers.StationNamePtr = &station.Name
		}

		logger.Log.Info().Str("line", dataToInsert.Line).Str("guessedStation", mostCommonStation).Msg("Guessed station ID based on line")
	}

	return nil
}

// If a station is uniquely served by one line, assign it.
func AssignLineIfSingleOption(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers, station structs.StationListEntry, direction structs.StationListEntry) error {
	logger.Log.Debug().Msg("Assigning line if single option")

	// If there is only one line for the station, assign it
	if len(station.Lines) == 1 {
		dataToInsert.Line = station.Lines[0]
		pointers.LinePtr = &dataToInsert.Line

		logger.Log.Debug().Msg("Assigned line because it was the only option for the station")
		return nil // returning early to avoid overwriting the line if station and direction dont match
	}

	// if there is only one line for the direction, assign it
	if len(direction.Lines) == 1 {
		dataToInsert.Line = direction.Lines[0]
		pointers.LinePtr = &dataToInsert.Line
		logger.Log.Debug().Msg("Assigned line because the direction was the only option for the station")
	}

	return nil
}

// If by the combination of line and station the direction can be determined, set it.
// Example: Line: U3, Station: Krumme Lanke, the only possible direction is Warschauer Straße
func DetermineDirectionIfImplied(
	dataToInsert *structs.ResponseData,
	pointers *structs.InsertPointers,
	line []string,
	stationID string,
	stations map[string]structs.StationListEntry,
) error {
	logger.Log.Debug().Msg("Determining direction if implied")

	isStationUniqueToOneLine := CheckIfStationIsUniqueToOneLineOfType(stations[stationID], dataToInsert.Line)

	lastStationID := line[len(line)-1]
	firstStationID := line[0]

	if isStationUniqueToOneLine {
		if firstStationID == stationID {
			if lastStation, found := stations[lastStationID]; found {
				setDirection(dataToInsert, pointers, lastStationID, lastStation)
			}
		} else if lastStationID == stationID {
			if firstStation, found := stations[firstStationID]; found {
				setDirection(dataToInsert, pointers, firstStationID, firstStation)
			}
		}
	}
	return nil
}

// checks if a station is uniquely served by one line of the specified type (e.g., 'S' or 'U').
func CheckIfStationIsUniqueToOneLineOfType(station structs.StationListEntry, line string) bool {
	logger.Log.Debug().Msg("Checking if station is unique to one line of the specified type")

	// The first character of the line determines if it is a sbahn or ubahn
	linePrefix := line[0]

	count := 0
	for _, line := range station.Lines {
		if strings.HasPrefix(line, string(linePrefix)) {
			count++
		}
	}

	return count == 1 // return true if there is only one line of the specified type
}

func setDirection(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers, stationID string, station structs.StationListEntry) {
	logger.Log.Debug().Msg("Setting direction")

	dataToInsert.Direction = structs.Station{Name: station.Name, ID: stationID, Coordinates: structs.Coordinates(station.Coordinates)}
	pointers.DirectionIDPtr = &stationID
	directionName := station.Name
	pointers.DirectionNamePtr = &directionName
}
