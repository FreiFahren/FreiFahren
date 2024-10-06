package stations

import (
	"net/http"

	"github.com/FreiFahren/backend/data"
	"github.com/labstack/echo/v4"
)

func GetAllStations(c echo.Context) error {
	return c.JSON(http.StatusOK, data.GetStationsList())
}

func GetSingleStation(c echo.Context) error {
	stationId := c.Param("stationId")
	stations := data.GetStationsList()

	if station, ok := stations[stationId]; ok {
		return c.JSON(http.StatusOK, station)
	}

	return c.JSON(http.StatusNotFound, "Station not found: The specified station does not exist.")
}
