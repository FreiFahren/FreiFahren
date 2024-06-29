package api

import (
	"net/http"

	"github.com/FreiFahren/backend/data"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

// @Summary Retrieves stations and lines information
//
// @Description This endpoint returns a comprehensive list of all train stations and lines.
// @Description Optionally, it can return only a list of lines or stations based on the provided query parameters.
//
// @Tags data
//
// @Accept  json
// @Produce  json
//
// @Param   lines      query     string  false  "Set to 'true' to retrieve only the list of lines."
// @Param   stations   query     string  false  "Set to 'true' to retrieve only the list of stations."
//
// @Success 200 {object} utils.AllStationsAndLinesList
// @Failure 500 {string} string "Internal Server Error: Unable to process the request."
//
// @Router /data/list [get]
func GetAllStationsAndLines(c echo.Context) error {
	logger.Log.Info().Msg("GET /data/list")

	var StationsAndLinesList = data.GetStationsAndLinesList()

	// only get the lines
	isLineList := c.QueryParam("lines")
	if isLineList == "true" {
		linesList = data.GetLinesList()

		return c.JSONPretty(http.StatusOK, linesList, "  ")
	}

	// only get the stations
	isStationList := c.QueryParam("stations")
	if isStationList == "true" {
		stationsList = data.GetStationsList()

		return c.JSONPretty(http.StatusOK, stationsList, "  ")
	}

	return c.JSONPretty(http.StatusOK, StationsAndLinesList, "  ")
}
