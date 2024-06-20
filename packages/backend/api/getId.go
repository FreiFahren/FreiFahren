package api

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/FreiFahren/backend/data"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

func FindStationId(name string, stationsMap map[string]utils.StationListEntry) (string, bool) {
	name = strings.ToLower(strings.ReplaceAll(name, " ", ""))
	for id, station := range stationsMap {
		stationName := strings.ToLower(strings.ReplaceAll(station.Name, " ", ""))
		if stationName == name {
			return id, true
		}
	}

	return "", false
}

// ListAccounts lists all existing accounts
//
//	@Summary      List accounts
//	@Description  get accounts
//	@Tags         accounts
//	@Accept       json
//	@Produce      json
//	@Param        q    query     string  false  "name search by q"  Format(email)
//	@Router       /accounts [get]
func GetStationId(c echo.Context) error {
	name := c.QueryParam("name")
	fmt.Printf("receiving name: %s\n", name)

	var stations = data.GetStationsList()

	id, found := FindStationId(name, stations)
	if found {
		fmt.Printf("returned id: %s\n", id)
		return c.JSON(http.StatusOK, id)
	}

	return echo.ErrNotFound
}
