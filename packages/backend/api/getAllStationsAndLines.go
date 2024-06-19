package api

import (
	"net/http"

	"github.com/FreiFahren/backend/data"
	"github.com/labstack/echo/v4"
)

// ölolüdkpakdapd fdadjnaooh
func GetAllStationsAndLines(c echo.Context) error {
	var StationsAndLinesList = data.GetStationsAndLinesList()

	// only get the lines
	isLineList := c.QueryParam("lines")

	if isLineList == "true" {
		linesList = data.GetLinesList()

		return c.JSONPretty(http.StatusOK, linesList, "  ")
	}

	isStationList := c.QueryParam("stations")
	if isStationList == "true" {
		stationsList = data.GetStationsList()

		return c.JSONPretty(http.StatusOK, stationsList, "  ")
	}

	return c.JSONPretty(http.StatusOK, StationsAndLinesList, "  ")
}
