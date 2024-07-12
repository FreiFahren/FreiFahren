package postInspector

import (
	"strings"

	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/logger"
	structs "github.com/FreiFahren/backend/utils"
)

func postProcessInspectorData(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers) error {
	logger.Log.Debug().Msg("Filling missing columns using provided data")

	var stations = data.GetStationsList()
	var lines = data.GetLinesList()

	if dataToInsert.Line == "" && dataToInsert.Station.ID != "" {
		if err := assignLineIfSingleOption(dataToInsert, pointers, stations[dataToInsert.Station.ID]); err != nil {
			logger.Log.Error().Err(err).Msg("Error assigning line if single option in postInspector")
			return err
		}
	}

	if dataToInsert.Direction.ID == "" && dataToInsert.Line != "" && dataToInsert.Station.ID != "" {
		if err := determineDirectionIfImplied(dataToInsert, pointers, lines[dataToInsert.Line], dataToInsert.Station.ID); err != nil {
			logger.Log.Error().Err(err).Msg("Error determining direction if implied in postInspector")
			return err
		}
	}

	// If the direction is the same as the station, remove the direction
	if dataToInsert.Direction.ID == dataToInsert.Station.ID {
		dataToInsert.Direction = structs.Station{}
		pointers.DirectionIDPtr = nil
		pointers.DirectionNamePtr = nil
		logger.Log.Debug().Msg("Removed direction because it was the same as the station")
	}

	// if Station is not on the given line, remove the line
	if dataToInsert.Station.ID != "" && !structs.StringInSlice(dataToInsert.Line, dataToInsert.Station.Lines) {
		dataToInsert.Line = ""
		pointers.LinePtr = nil
		logger.Log.Debug().Msg("Removed line because the station was not on it")
	}

	// If Direction is not on the same given line, remove the direction
	if dataToInsert.Direction.ID != "" && !structs.StringInSlice(dataToInsert.Line, dataToInsert.Direction.Lines) {
		dataToInsert.Direction = structs.Station{}
		pointers.DirectionIDPtr = nil
		pointers.DirectionNamePtr = nil
		logger.Log.Debug().Msg("Removed direction because it was not on the same line")
	}

	return nil
}

// If a station is uniquely served by one line, assign it.
func assignLineIfSingleOption(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers, station structs.StationListEntry) error {
	logger.Log.Debug().Msg("Assigning line if single option")

	// If there is only one line for the station, assign it
	if len(station.Lines) == 1 {
		dataToInsert.Line = station.Lines[0]
		pointers.LinePtr = &dataToInsert.Line
	}

	// if there is only one line for the direction, assign it
	if len(dataToInsert.Direction.Lines) == 1 {
		dataToInsert.Line = dataToInsert.Direction.Lines[0]
		pointers.LinePtr = &dataToInsert.Line
	}

	return nil
}

// If by the combination of line and station the direction can be determined, set it.
// Example: Line: U3, Station: Krumme Lanke, the only possible direction is Warschauer Straße
func determineDirectionIfImplied(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers, line []string, stationID string) error {
	logger.Log.Debug().Msg("Determining direction if implied")

	var stations = data.GetStationsList()
	isStationUniqueToOneLine := checkIfStationIsUniqueToOneLineOfType(stations[stationID], dataToInsert.Line)

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
func checkIfStationIsUniqueToOneLineOfType(station structs.StationListEntry, line string) bool {
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
