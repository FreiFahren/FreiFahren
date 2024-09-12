package getStationName

import (
	"fmt"
	"net/http"

	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

func IdToStationName(id string) (string, error) {
	logger.Log.Debug().Msg("Transforming station Id to station name")

	var stations = data.GetStationsList()

	station, ok := stations[id]
	if !ok {
		err := fmt.Errorf("station Id %s not found", id)
		logger.Log.Error().Err(err)
		return "", err
	}

	return station.Name, nil
}

// @Summary      Retrieve Name by Station Id
//
// @Description  Fetches the name of a station by its unique identifier from the StationsMap.
// @Description  The Ids have format Line prefix that has the format "SU" followed by an abbreviation of the station name. For example "SU-A" for the station "Alexanderplatz".
//
// @Tags         data
//
// @Accept       json
// @Produce      json
//
// @Param		 id query string true "Station Id"
//
// @Success      200 {string} string "The station id"
// @Failure      404 {string} string "Error getting station name"
//
// @Router       /station [get]
func GetStationName(c echo.Context) error {
	logger.Log.Info().Msg("GET /station")

	id := c.QueryParam("id")

	id, err := IdToStationName(id)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting station name")
		return c.NoContent(http.StatusNotFound)
	}

	return c.JSON(http.StatusOK, id)
}
