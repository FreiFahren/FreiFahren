package inspectors

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"time"

	"github.com/FreiFahren/backend/api/prediction"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/limiting"
	"github.com/FreiFahren/backend/logger"
	structs "github.com/FreiFahren/backend/utils"

	"github.com/labstack/echo/v4"
)

var lastTelegramNotification time.Time

// @Summary Submit ticket inspector data
//
// @Description Accepts a JSON payload with details about a ticket inspector's current location.
// @Description This endpoint validates the provided data, processes necessary computations for linking stations and lines,
// @Description inserts the data into the database, and triggers an update to the risk model used in operational analysis.
// @Description If the 'timestamp' field is not provided in the request, the current UTC time truncated to the nearest minute is used automatically.
// @Description The endpoint also includes a rate limit to prevent abuse. The rate limit is based on the IP address of the request.
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
// @Failure 429 "Too Many Requests: The request has been rate limited."
// @Failure 500 "Internal Server Error: Error during data processing or database insertion."
//
// @Router /basics/inspectors [post]
func PostInspector(c echo.Context) error {
	logger.Log.Info().
		Msg("POST '/basics/Inspectors' UserAgent: " + c.Request().UserAgent())

	// dont rate limit requests from the bot (password in header) or in dev mode
	if c.Request().Header.Get("X-Password") != os.Getenv("REPORT_PASSWORD") && os.Getenv("STATUS") != "dev" {
		if !limiting.GlobalRateLimiter.CanSubmitReport(c.RealIP()) {
			logger.Log.Info().Msg("User has been rate limited")
			return c.JSON(http.StatusTooManyRequests, map[string]string{
				"message": "Please wait at least 30 minutes between submissions",
			})
		}
	}

	var req structs.InspectorRequest
	if err := c.Bind(&req); err != nil {
		logger.Log.Error().
			Err(err).
			Str("userAgent", c.Request().UserAgent()).
			Msg("Error binding request in postInspector")
		return c.NoContent(http.StatusInternalServerError)
	}
	logger.Log.Debug().Interface("Request", req).Msg("Request data")

	// Check if all parameters are empty
	if req.Line == "" && req.StationId == "" && req.DirectionId == "" {
		logger.Log.Error().
			Str("Line", req.Line).
			Str("Station", req.StationId).
			Str("Direction", req.DirectionId).
			Msg("At least one of 'line', 'station', or 'direction' must be provided")
		return c.NoContent(http.StatusBadRequest)
	}

	dataToInsert, pointers, err := processRequestData(req)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error processing request data in postInspector")
		// return 200 to avoid issues in mobile app
		// todo: return error as soon as new release is deployed
		return c.NoContent(http.StatusOK)
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
		pointers.StationIdPtr,
		pointers.DirectionIdPtr,
	); err != nil {
		logger.Log.Error().Err(err).Msg("Error inserting ticket info in postInspector")
		return c.NoContent(http.StatusInternalServerError)
	}

	// Update risk model after successful report submission
	go func() {
		if _, err := prediction.ExecuteRiskModel(); err != nil {
			logger.Log.Error().Err(err).Msg("Failed to update risk model after new report")
		}
	}()

	// Notify Telegram bot if there's no author (web app report)
	go func() {
		if pointers.AuthorPtr == nil {
			// avoid spamming the telegram group
			if time.Since(lastTelegramNotification) >= 5*time.Minute || os.Getenv("STATUS") == "dev" {
				telegramEndpoint := os.Getenv("NLP_SERVICE_URL") + "/report-inspector"
				if err := notifyOtherServiceAboutReport(telegramEndpoint, dataToInsert, "Telegram bot"); err != nil {
					logger.Log.Error().Err(err).Msg("Error notifying Telegram bot about report in postInspector")
				} else {
					lastTelegramNotification = time.Now()
				}
			} else {
				logger.Log.Info().Msg("Skipping Telegram notification - rate limit not exceeded")
			}
		}
	}()

	// Record the submission after successful processing
	limiting.GlobalRateLimiter.RecordSubmission(c.RealIP())

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
	if req.StationId != "" {
		pointers.StationIdPtr = &req.StationId
		response.Station = structs.Station{Id: req.StationId}

		if station, found := stations[req.StationId]; found {
			response.Station.Name = station.Name
		} else {
			logger.Log.Error().Str("stationId", req.StationId).Msg("Station not found")
			return nil, nil, errors.New("station not found")
		}
	}

	// Assign direction
	if req.DirectionId != "" {
		pointers.DirectionIdPtr = &req.DirectionId
		response.Direction = structs.Station{Id: req.DirectionId}

		if direction, found := stations[req.DirectionId]; found {
			response.Direction.Name = direction.Name
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
		"stationId": data.Station.Id,
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
