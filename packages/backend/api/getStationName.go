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

// @Summary      Retrieve Name by Station ID
// @Description  Fetches the name of a station by its unique identifier from the StationsMap.
// @Description  The Ids have format Line prefix that has the format "SU" followed by an abbreviation of the station name. For example "SU-A" for the station "Alexanderplatz".
// @Tags         City Data
// @Accept       json
// @Produce      json
// @Param		 id query string true "Station Id"
// @Success      200 {string} string "The station id"
// @Failure      404 {string} string "Error getting station name"
// @Router       /station [get]
func GetStationName(c echo.Context) error {
	id := c.QueryParam("id")

	id, err := IdToStationName(id)

	if err != nil {
		return utils.HandleErrorEchoContext(c, err, "Error getting station name: %v")
	}

	return c.JSON(http.StatusOK, id)
}
