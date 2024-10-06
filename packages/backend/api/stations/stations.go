package stations

import (
	"net/http"

	"github.com/FreiFahren/backend/data"
	"github.com/labstack/echo/v4"
)

func GetAllStations(c echo.Context) error {
	return c.JSON(http.StatusOK, data.GetStationsList())
}
