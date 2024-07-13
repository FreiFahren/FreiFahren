package inspector

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/FreiFahren/backend/Rstats"
	"github.com/FreiFahren/backend/api/getId"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/logger"
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
// @Router /basics/inspectors [post]
func PostInspector(c echo.Context) error {
	logger.Log.Info().Msg("POST /basics/Inspector")

	var req structs.InspectorRequest
	if err := c.Bind(&req); err != nil {
		logger.Log.Error().Err(err).Msg("Error binding request in postInspector")
		return c.NoContent(http.StatusInternalServerError)
	}

	// Check if all parameters are empty
	if req.Line == "" && req.StationName == "" && req.DirectionName == "" {
		logger.Log.Error().
			Str("Line", req.Line).
			Str("Station", req.StationName).
			Str("Direction", req.DirectionName).
			Msg("At least one of 'line', 'station', or 'direction' must be provided")
		return c.NoContent(http.StatusBadRequest)
	}

	dataToInsert, pointers, err := processRequestData(req)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error processing request data in postInspector")
	}

	if err := postProcessInspectorData(dataToInsert, pointers); err != nil {
		logger.Log.Error().Err(err).Msg("Error filling missing columns in postInspector")
		return c.NoContent(http.StatusInternalServerError)
	}

	if err := database.InsertTicketInfo(
		pointers.TimestampPtr,
		pointers.AuthorPtr,
		pointers.MessagePtr,
		pointers.LinePtr,
		pointers.StationNamePtr,
		pointers.StationIDPtr,
		pointers.DirectionNamePtr,
		pointers.DirectionIDPtr,
	); err != nil {
		logger.Log.Error().Err(err).Msg("Error inserting ticket info in postInspector")
		return c.NoContent(http.StatusInternalServerError)
	}

	// Based on the new data, generate new risk segments
	err = Rstats.RunRiskModel()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error running risk model in postInspector")
	}

	if pointers.AuthorPtr == nil { // reports from the web app do not have an author ID
		if err := notifyTelegramBotAboutReport(dataToInsert); err != nil {
			logger.Log.Error().Err(err).Msg("Error notifying Telegram bot about report in postInspector")
			// Do not return an error here, as we want to continue processing the request
		}
	}

	return c.JSON(http.StatusOK, dataToInsert)
}

func processRequestData(req structs.InspectorRequest) (*structs.ResponseData, *structs.InsertPointers, error) {
	logger.Log.Debug().Msg("Processing ticket info for insertion")

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
		if stationID, found := getId.FindStationId(req.StationName, stations); found {
			pointers.StationNamePtr = &req.StationName
			pointers.StationIDPtr = &stationID
			response.Station = structs.Station{Name: req.StationName, ID: stationID}
		} else {
			err := fmt.Errorf("station not found: %v", req.StationName)
			logger.Log.Error().Err(err)
			return nil, nil, err
		}
	}

	if req.DirectionName != "" {
		if directionID, found := getId.FindStationId(req.DirectionName, stations); found {
			pointers.DirectionNamePtr = &req.DirectionName
			pointers.DirectionIDPtr = &directionID
			response.Direction = structs.Station{Name: req.DirectionName, ID: directionID, Coordinates: structs.Coordinates(stations[directionID].Coordinates), Lines: stations[directionID].Lines}
		} else {
			err := fmt.Errorf("direction not found: %v", req.DirectionName)
			logger.Log.Error().Err(err)
			return nil, nil, err
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

	logger.Log.Info().Msg("Processed ticket info for insertion")
	logger.Log.Info().Interface("Response", response).Msg("Response data")

	return response, pointers, nil
}

func notifyTelegramBotAboutReport(data *structs.ResponseData) error {
	logger.Log.Debug().Msg("Notifying Telegram bot about report")

	NLP_BOT_ENDPOINT := os.Getenv("NLP_BOT_URL")
	flaskEndpoint := NLP_BOT_ENDPOINT + "/report-inspector"

	reportData := map[string]interface{}{
		"line":      data.Line,
		"station":   data.Station.Name,
		"direction": data.Direction.Name,
		"message":   data.Message,
	}

	jsonData, err := json.Marshal(reportData)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error marshalling report data in postInspector")
		return err
	}

	resp, err := http.Post(flaskEndpoint, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error posting to Flask endpoint in postInspector")
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		logger.Log.Error().Str("status", resp.Status).Msg("Error in Flask endpoint response in postInspector")
		return err
	}

	return nil
}
