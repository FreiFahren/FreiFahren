package getStats

import (
	"net/http"

	"github.com/FreiFahren/backend/database"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

// @Summary Get statistics on recent submissions
//
// @Description Fetches the total number of submissions recorded in the database over the past 24 hours.
//
// @Tags Statistics
//
// @Accept json
// @Produce json
//
// @Success 200 {integer} integer "Number of submissions in the last 24 hours"
// @Failure 500 "Internal Server Error: Unable to fetch statistics from the database."
//
// @Router /statistics/stats [get]
func GetStats(c echo.Context) error {
	logger.Log.Info().Msg("GET /statistics/stats")

	stats, err := database.GetNumberOfSubmissionsInLast24Hours()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting stats")
		return c.NoContent(http.StatusInternalServerError)
	}

	return c.JSON(http.StatusOK, stats)
}
