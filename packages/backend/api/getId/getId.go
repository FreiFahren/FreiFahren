package getId

import (
	"net/http"
	"strings"

	"github.com/FreiFahren/backend/data"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

func FindStationId(name string, stationsMap map[string]utils.StationListEntry) (string, bool) {
	logger.Log.Debug().Msg("Finding station id")

	name = strings.ToLower(strings.ReplaceAll(name, " ", ""))
	for id, station := range stationsMap {
		stationName := strings.ToLower(strings.ReplaceAll(station.Name, " ", ""))
		if stationName == name {
			return id, true
		}
	}

	return "", false
}

// @Summary      Retrieve Station Id by Name
//
// @Description  Fetches the unique identifier for a station by its name from the StationsMap. This endpoint performs a case-insensitive search and ignores spaces in the station name.
// @Description  The Ids have format Line prefix that has the format "SU" followed by an abbreviation of the station name. For example "SU-A" for the station "Alexanderplatz".
//
// @Tags         data
//
// @Accept       json
// @Produce      json
//
// @Param		 name query string true "Station name", case and whitespace insensitive
//
// @Success      200 {object} map[string]string "The station id"
// @Failure      404 {object} map[string]string "Error message"
//
// @Router       /data/id [get]
func GetStationId(c echo.Context) error {
	logger.Log.Info().Msg("GET /data/id")

	name := c.QueryParam("name")

	var stations = data.GetStationsList()

	id, found := FindStationId(name, stations)
	if found {
		logger.Log.Debug().Msg("Returned Id")
		return c.String(http.StatusOK, id)
	}

	return c.NoContent(http.StatusNotFound)
}