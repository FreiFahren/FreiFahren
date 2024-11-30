package prediction

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os/exec"
	"time"

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

func GetRiskSegments(c echo.Context) error {
	logger.Log.Info().Msg("GET /prediction/risk-segments")

	endTime := time.Now().UTC()
	startTime := endTime.Add(-time.Hour)
	ticketInfoList, err := database.GetLatestTicketInspectors(startTime, endTime)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get ticket inspectors")
		return c.NoContent(http.StatusInternalServerError)
	}
	logger.Log.Info().Msgf("Found %d ticket inspectors", len(ticketInfoList))

	// Convert ticket info to JSON
	inspectorData, err := json.Marshal(ticketInfoList)
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

	// Wait for the command to complete
	if err := cmd.Wait(); err != nil {
		// Log both error and stderr content
		logger.Log.Error().
			Err(err).
			Str("stderr", stderr.String()).
			Msg("Python script failed")
		return c.NoContent(http.StatusInternalServerError)
	}

	// Log any debug output from Python even if successful
	if stderr.Len() > 0 {
		for _, line := range bytes.Split(stderr.Bytes(), []byte("\n")) {
			if len(line) > 0 {
				logger.Log.Debug().Msg(string(line))
			}
		}
	}

	// Parse the output
	var riskData RiskData
	if err := json.Unmarshal(stdout.Bytes(), &riskData); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to unmarshal Python output")
		return c.NoContent(http.StatusInternalServerError)
	}

	return c.JSON(http.StatusOK, riskData)
}
