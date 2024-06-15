package api

import (
	"net/http"

	"github.com/FreiFahren/backend/database"
	structs "github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

func GetStats(c echo.Context) error {
	stats, err := database.GetNumberOfSubmissionsInLast24Hours()
	if err != nil {
		return structs.HandleErrorEchoContext(c, err, "Error getting stats: %v")
	}

	return c.JSON(http.StatusOK, stats)
}
