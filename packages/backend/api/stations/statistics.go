package stations

import (
	"net/http"
	"time"

	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

type StationStatistics struct {
	NumberOfReports int `json:"numberOfReports"`
}

func GetStationStatistics(c echo.Context) error {
	logger.Log.Info().Msg("GET /stations/:stationId/statistics")

	stationId := c.Param("stationId")
	start := c.QueryParam("start")
	end := c.QueryParam("end")

	startTime, endTime := utils.GetTimeRange(start, end, 7*24*time.Hour)

	numberOfReports, err := database.GetNumberOfReports(stationId, startTime, endTime)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get number of reports")
		return c.NoContent(http.StatusInternalServerError)
	}

	return c.JSON(http.StatusOK, StationStatistics{NumberOfReports: numberOfReports})
}
