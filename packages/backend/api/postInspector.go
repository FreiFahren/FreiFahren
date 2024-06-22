package api

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/FreiFahren/backend/Rstats"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	_ "github.com/FreiFahren/backend/docs"
	structs "github.com/FreiFahren/backend/utils"

	"github.com/labstack/echo/v4"
)

// @Summary Submit ticket inspector data
//
// @Description Accepts a JSON payload with details about a ticket inspector's current location.
// @Description This endpoint validates the provided data, processes necessary computations for linking stations and lines,
// @Description inserts the data into the database, and triggers an update to the risk model used in operational analysis.
//
// @Tags basics
//
// @Accept json
// @Produce json
//
// @Param inspectorData body structs.InspectorRequest true "Data about the inspector's location and activity"
//
// @Success 200 {object} structs.ResponseData "Successfully processed and inserted the inspector data with computed linkages and risk model updates."
// @Failure 400 "Bad Request: Missing or incorrect parameters provided."
// @Failure 500 "Internal Server Error: Error during data processing or database insertion."
//
// @Router /basics/newInspector [post]
func PostInspector(c echo.Context) error {
	var req structs.InspectorRequest
	if err := c.Bind(&req); err != nil {
		return structs.HandleErrorEchoContext(c, err, "Error binding request in postInspector: %v")
	}

	// Check if all parameters are empty
	if req.Line == "" && req.StationName == "" && req.DirectionName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "At least one of 'line', 'station', or 'direction' must be provided")
	}

	dataToInsert, pointers, err := processRequestData(req)
	if err != nil {
		return structs.HandleErrorEchoContext(c, err, "Error processing request data in postInspector: %v")
	}

	if err := fillMissingColumnsUsingProvidedData(dataToInsert, pointers); err != nil {
		return structs.HandleErrorEchoContext(c, err, "Error filling missing columns: %v")
	}

	if err := database.InsertTicketInfo(pointers.TimestampPtr, pointers.AuthorPtr, pointers.MessagePtr, pointers.LinePtr, pointers.StationNamePtr, pointers.StationIDPtr, pointers.DirectionNamePtr, pointers.DirectionIDPtr); err != nil {
		return fmt.Errorf("(postInspector.go) failed to insert ticket info into database: %v", err)
	}

	// Based on the new data, generate new risk segments
	err = Rstats.RunRiskModel()
	if err != nil {
		log.Printf("(postInspector.go) Failed to run risk model: %v", err)
	}

	return c.JSON(http.StatusOK, dataToInsert)
}

func processRequestData(req structs.InspectorRequest) (*structs.ResponseData, *structs.InsertPointers, error) {
	var stations = data.GetStationsList()

	// Using pointers to allow for nil values
	response := &structs.ResponseData{}
	pointers := &structs.InsertPointers{}

	// Check if the timestamp is provided, otherwise use the current time
	if req.Timestamp != (time.Time{}) { // time.time{} is the zero value for time.Time
		pointers.TimestampPtr = &req.Timestamp
		response.Timestamp = req.Timestamp
	} else {
		timestamp := time.Now().UTC().Truncate(time.Minute)
		pointers.TimestampPtr = &timestamp
		response.Timestamp = *pointers.TimestampPtr
	}

	if req.Line != "" {
		pointers.LinePtr = &req.Line
		response.Line = req.Line
	}

	if req.StationName != "" {
		if stationID, found := FindStationId(req.StationName, stations); found {
			pointers.StationNamePtr = &req.StationName
			pointers.StationIDPtr = &stationID
			response.Station = structs.Station{Name: req.StationName, ID: stationID}
		} else {
			return nil, nil, fmt.Errorf("station not found: %v", req.StationName)
		}
	}

	if req.DirectionName != "" {
		if directionID, found := FindStationId(req.DirectionName, stations); found {
			pointers.DirectionNamePtr = &req.DirectionName
			pointers.DirectionIDPtr = &directionID
			response.Direction = structs.Station{Name: req.DirectionName, ID: directionID, Coordinates: structs.Coordinates(stations[directionID].Coordinates), Lines: stations[directionID].Lines}
		} else {
			return nil, nil, fmt.Errorf("direction not found: %v", req.DirectionName)
		}
	}

	if req.Author != 0 {
		pointers.AuthorPtr = &req.Author
		response.Author = req.Author
	}

	if req.Message != "" {
		pointers.MessagePtr = &req.Message
		response.Message = req.Message
	}

	log.Printf("Processed ticket info for insertion: %v", response)

	return response, pointers, nil
}

func fillMissingColumnsUsingProvidedData(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers) error {
	var stations = data.GetStationsList()
	var lines = data.GetLinesList()

	if dataToInsert.Line == "" && dataToInsert.Station.ID != "" {
		if err := assignLineIfSingleOption(dataToInsert, pointers, stations[dataToInsert.Station.ID]); err != nil {
			return err
		}
	}

	if dataToInsert.Direction.ID == "" && dataToInsert.Line != "" && dataToInsert.Station.ID != "" {
		if err := determineDirectionIfImplied(dataToInsert, pointers, lines[dataToInsert.Line], dataToInsert.Station.ID); err != nil {
			return err
		}
	}

	return nil
}

func assignLineIfSingleOption(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers, station structs.StationListEntry) error {
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

func determineDirectionIfImplied(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers, line []string, stationID string) error {
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
	dataToInsert.Direction = structs.Station{Name: station.Name, ID: stationID, Coordinates: structs.Coordinates(station.Coordinates)}
	pointers.DirectionIDPtr = &stationID
	directionName := station.Name
	pointers.DirectionNamePtr = &directionName
}
