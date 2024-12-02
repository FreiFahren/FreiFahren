package prediction

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os/exec"
	"time"

	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

type RiskSegmentResponse struct {
	SegmentID string `json:"segmentId"`
	Color     string `json:"color"`
}

type RiskData struct {
	LastModified  string            `json:"last_modified"`
	SegmentColors map[string]string `json:"segment_colors"`
}

type RiskInspector struct {
	StationId string   `json:"station_id"`
	Lines     []string `json:"lines"`
	Direction string   `json:"direction"`
	Timestamp string   `json:"timestamp"`
}

func GetRiskSegments(c echo.Context) error {
	logger.Log.Info().Msg("GET /prediction/risk-segments")

	endTime := time.Now().UTC()
	startTime := endTime.Add(-time.Hour)
	ticketInfoList, err := database.GetLatestTicketInspectors(startTime, endTime)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get ticket inspectors")
		return c.NoContent(http.StatusInternalServerError)
	}

	// Get stations list for line lookup
	stationsList := data.GetStationsList()

	// Convert TicketInspector to RiskInspector
	riskInspectors := make([]RiskInspector, 0, len(ticketInfoList))
	for _, inspector := range ticketInfoList {
		var lines []string
		if inspector.Line.Valid && inspector.Line.String != "" {
			// If line is set, use it as a single-element array
			lines = []string{inspector.Line.String}
		} else {
			// If no line is set, get all possible lines from the station
			if station, ok := stationsList[inspector.StationId]; ok {
				lines = station.Lines
			} else {
				logger.Log.Warn().Msgf("Station %s not found in stations list", inspector.StationId)
				continue
			}
		}

		// Only add inspector if we have valid lines
		if len(lines) > 0 {
			direction := ""
			if inspector.DirectionId.Valid {
				direction = inspector.DirectionId.String
			}

			riskInspector := RiskInspector{
				StationId: inspector.StationId,
				Lines:     lines,
				Direction: direction,
				Timestamp: inspector.Timestamp.Format(time.RFC3339),
			}
			riskInspectors = append(riskInspectors, riskInspector)
		}
	}

	// Convert risk inspectors to JSON
	inspectorData, err := json.Marshal(riskInspectors)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to marshal inspector data")
		return c.NoContent(http.StatusInternalServerError)
	}

	// Create command to run Python script
	cmd := exec.Command("python3", "packages/backend/api/prediction/new_risk_model.py")
	cmd.Dir = "/Users/johantrieloff/Documents/FreiFahren"

	// Create pipes for stdin and stdout
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	stdin, err := cmd.StdinPipe()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to create stdin pipe")
		return c.NoContent(http.StatusInternalServerError)
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to start Python script")
		return c.NoContent(http.StatusInternalServerError)
	}

	// Write inspector data to stdin
	if _, err := stdin.Write(inspectorData); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to write to stdin")
		return c.NoContent(http.StatusInternalServerError)
	}
	stdin.Close()
	logger.Log.Debug().Msgf("Data written to risk model: %s", string(inspectorData))

	// Wait for the command to complete
	if err := cmd.Wait(); err != nil {
		// Log both error and stderr content
		logger.Log.Error().
			Err(err).
			Str("stderr", stderr.String()).
			Msg("Python script failed")
		return c.NoContent(http.StatusInternalServerError)
	}

	// Parse the output
	var riskData RiskData
	if err := json.Unmarshal(stdout.Bytes(), &riskData); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to unmarshal Python output")
		return c.NoContent(http.StatusInternalServerError)
	}
	logger.Log.Debug().Msgf("Risk data: %+v", riskData)

	return c.JSON(http.StatusOK, riskData)
}
