package inspectors

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/FreiFahren/backend/Rstats"
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
// @Description If the 'timestamp' field is not provided in the request, the current UTC time truncated to the nearest minute is used automatically.
//
// @Tags basics
//
// @Accept json
// @Produce json
//
// @Param inspectorData body structs.InspectorRequest true "Data about the inspector's location and activity"
// @Param timestamp query string false "Timestamp of the report in ISO 8601 format (e.g., 2006-01-02T15:04:05Z); if not provided, the current time is used"
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
	logger.Log.Debug().Interface("Request", req).Msg("Request data")

	// Check if all parameters are empty
	if req.Line == "" && req.StationID == "" && req.DirectionID == "" {
		logger.Log.Error().
			Str("Line", req.Line).
			Str("Station", req.StationID).
			Str("Direction", req.DirectionID).
			Msg("At least one of 'line', 'station', or 'direction' must be provided")
		return c.NoContent(http.StatusBadRequest)
	}

	dataToInsert, pointers, err := processRequestData(req)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error processing request data in postInspector")
	}

	if err := PostProcessInspectorData(dataToInsert, pointers); err != nil {
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

	// set the cache to be expired
	cacheExpiration = time.Time{}

	// Based on the new data, generate new risk segments
	err = Rstats.RunRiskModel()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error running risk model in postInspector")
	}

	// Notify Telegram bot if there's no author (web app report)
	if pointers.AuthorPtr == nil {
		telegramEndpoint := os.Getenv("NLP_BOT_URL") + "/report-inspector"
		if err := notifyOtherServiceAboutReport(telegramEndpoint, dataToInsert, "Telegram bot"); err != nil {
			logger.Log.Error().Err(err).Msg("Error notifying Telegram bot about report in postInspector")
		}
	}

	return c.JSON(http.StatusOK, dataToInsert)
}

func processRequestData(req structs.InspectorRequest) (*structs.ResponseData, *structs.InsertPointers, error) {
	logger.Log.Debug().Msg("Processing ticket info for insertion")
	logger.Log.Info().Interface("Request", req).Msg("Request data")

	var stations = data.GetStationsList()

	response := &structs.ResponseData{}
	pointers := &structs.InsertPointers{}

	// Assign current or provided timestamp
	if req.Timestamp != (time.Time{}) {
		pointers.TimestampPtr = &req.Timestamp
		response.Timestamp = req.Timestamp
	} else {
		timestamp := time.Now().UTC().Truncate(time.Minute)
		pointers.TimestampPtr = &timestamp
		response.Timestamp = *pointers.TimestampPtr
	}

	// Assign line
	if req.Line != "" {
		pointers.LinePtr = &req.Line
		response.Line = req.Line
	}

	// Assign station
	if req.StationID != "" {
		pointers.StationIDPtr = &req.StationID
		response.Station = structs.Station{ID: req.StationID}

		if station, found := stations[req.StationID]; found {
			response.Station.Name = station.Name
			pointers.StationNamePtr = &station.Name
		}
	}

	// Assign direction
	if req.DirectionID != "" {
		pointers.DirectionIDPtr = &req.DirectionID
		response.Direction = structs.Station{ID: req.DirectionID}

		if direction, found := stations[req.DirectionID]; found {
			response.Direction.Name = direction.Name
			pointers.DirectionNamePtr = &direction.Name
		}
	}

	// Assign author and message if present
	if req.Author != 0 {
		pointers.AuthorPtr = &req.Author
		response.Author = req.Author
	}
	if req.Message != "" {
		pointers.MessagePtr = &req.Message
		response.Message = req.Message
	}

	logger.Log.Info().Interface("Response", response).Msg("Response data")

	return response, pointers, nil
}

func notifyOtherServiceAboutReport(endpoint string, data *structs.ResponseData, serviceName string) error {
	logger.Log.Debug().Str("service", serviceName).Msg("Sending data")

	payload := map[string]string{
		"line":      data.Line,
		"station":   data.Station.Name,
		"direction": data.Direction.Name,
		"message":   data.Message,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		logger.Log.Error().Err(err).Str("service", serviceName).Msg("Error marshalling data")
		return err
	}

	resp, err := http.Post(endpoint, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		logger.Log.Error().Err(err).Str("service", serviceName).Msg("Error posting data")
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errMsg := fmt.Sprintf("Non-OK response: %s", resp.Status)
		logger.Log.Error().Str("status", resp.Status).Str("service", serviceName).Msg(errMsg)
		return errors.New(errMsg)
	}

	logger.Log.Info().Str("service", serviceName).Msg("Successfully sent data")
	return nil
}
