package v0

import (
	"net/http"
	"time"

	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

// @Summary Get station statistics
//
// @Description Retrieves statistics for a specific station.
// @Description This endpoint returns the number of reports for the specified station within the given time range.
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
// @Success 200 {object} statistics.Statistics "Successfully retrieved station statistics."
// @Failure 400 {object} error "Bad Request: Invalid time format."
// @Failure 500 {object} error "Internal Server Error: Failed to get number of reports."
//
// @Router /stations/{stationId}/statistics [get]
func GetStationStatistics(c echo.Context) error {
	logger.Log.Info().Msg("GET '/stations/:stationId/statistics' UserAgent: " + c.Request().UserAgent())

	stationId := c.Param("stationId")
	start := c.QueryParam("start")
	end := c.QueryParam("end")

	startTime, endTime := utils.GetTimeRange(start, end, 7*24*time.Hour)

	numberOfReports, err := database.GetNumberOfReports(stationId, "", startTime, endTime)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Server Error: Failed to get number of reports."})
	}

	return c.JSON(http.StatusOK, map[string]int{"numberOfReports": numberOfReports})
}
