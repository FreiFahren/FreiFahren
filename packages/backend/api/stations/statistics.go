package stations

import (
	"net/http"
	"time"

	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

type Statistics struct {
	NumberOfReports int `json:"numberOfReports"`
}

// @Summary Get statistics
//
// @Description Retrieves statistics for a specific station, optionally filtered by line.
// @Description This endpoint returns the number of reports for the specified station and/or line within the given time range.
//
// @Tags stations
//
// @Produce json
//
// @Param stationId path string true "ID of the station"
// @Param lineId query string false "ID of the line (optional)"
// @Param start query string false "Start time for the statistics (format: RFC3339)"
// @Param end query string false "End time for the statistics (format: RFC3339)"
//
// @Success 200 {object} Statistics "Successfully retrieved station statistics."
// @Failure 500 {object} error "Internal Server Error: Failed to get number of reports."
//
// @Router /stations/{stationId}/statistics [get]
func GetStatistics(c echo.Context) error {
	logger.Log.Info().Msg("GET /stations/:stationId/statistics")

	stationId := c.Param("stationId")
	lineId := c.QueryParam("lineId")
	start := c.QueryParam("start")
	end := c.QueryParam("end")

	startTime, endTime := utils.GetTimeRange(start, end, 7*24*time.Hour)

	numberOfReports, err := database.GetNumberOfReports(stationId, lineId, startTime, endTime)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Internal Server Error: Failed to get number of reports.")
		return c.NoContent(http.StatusInternalServerError)
	}

	return c.JSON(http.StatusOK, Statistics{NumberOfReports: numberOfReports})
}
