package api

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/FreiFahren/backend/Rstats"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	structs "github.com/FreiFahren/backend/utils"

	"github.com/labstack/echo/v4"
)

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

	now := time.Now().Truncate(time.Minute).Add(time.Minute)

	if err := database.InsertTicketInfo(&now, pointers.AuthorPtr, pointers.MessagePtr, pointers.LinePtr, pointers.StationNamePtr, pointers.StationIDPtr, pointers.DirectionNamePtr, pointers.DirectionIDPtr); err != nil {
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

	response := &structs.ResponseData{}
	pointers := &structs.InsertPointers{}

	// Assign pointers for values to be potentially inserted as NULL
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
			response.Direction = structs.Station{Name: req.DirectionName, ID: directionID}
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
	if len(station.Lines) == 1 {
		dataToInsert.Line = station.Lines[0]
		pointers.LinePtr = &dataToInsert.Line
	}
	return nil
}

func determineDirectionIfImplied(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers, line []string, stationID string) error {
	var stations = data.GetStationsList()

	isStationUnqiueToOneLine := len(stations[dataToInsert.Station.ID].Lines) == 1

	if isStationUnqiueToOneLine {
		if line[0] == stationID {
			secondStationID := line[1]
			if secondStation, found := stations[secondStationID]; found {
				setDirection(dataToInsert, pointers, secondStationID, secondStation)
			}
		} else if line[len(line)-1] == stationID {
			firstStationID := line[0]
			if firstStation, found := stations[firstStationID]; found {
				setDirection(dataToInsert, pointers, firstStationID, firstStation)
			}
		}
	}
	return nil
}

func setDirection(dataToInsert *structs.ResponseData, pointers *structs.InsertPointers, stationID string, station structs.StationListEntry) {
	dataToInsert.Direction = structs.Station{Name: station.Name, ID: stationID, Coordinates: structs.Coordinates(station.Coordinates)}
	pointers.DirectionIDPtr = &stationID
	directionName := station.Name
	pointers.DirectionNamePtr = &directionName
}
