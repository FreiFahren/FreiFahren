package api

import (
	"fmt"
	"net/http"

	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

func IdToStationName(id string) (string, error) {

	var stations = data.GetStationsList()

	station, ok := stations[id]
	if !ok {
		return "", fmt.Errorf("station ID %s not found", id)
	}

	return station.Name, nil
}

func GetStationName(c echo.Context) error {
	id := c.QueryParam("id")

	id, err := IdToStationName(id)

	if err != nil {
		return utils.HandleErrorEchoContext(c, err, "Error getting station name: %v")
	}

	return c.JSON(http.StatusOK, id)
}
