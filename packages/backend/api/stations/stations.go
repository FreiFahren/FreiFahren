package stations

import (
	"net/http"
	"strings"

	"github.com/FreiFahren/backend/data"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/labstack/echo/v4"
)

// @Summary Get all stations
//
// @Description Retrieves information about all available stations.
// @Description This endpoint returns a list of all stations and their details.
//
// @Tags stations
//
// @Produce json
//
// @Success 200 {object} map[string]utils.StationListEntry
// @Failure 500 "Internal Server Error: Error retrieving stations data."
//
// @Router /stations [get]
func GetAllStations(c echo.Context) error {
	return c.JSON(http.StatusOK, data.GetStationsList())
}

// @Summary Get a single station by ID
//
// @Description Retrieves information about a specific station based on its ID.
// @Description This endpoint returns the details of a single station.
//
// @Tags stations
//
// @Produce json
//
// @Param stationId path string true "ID of the station"
//
// @Success 200 {object} utils.StationListEntry "Successfully retrieved the specified station data."
// @Failure 404 {object} map[string]string "Station not found: The specified station does not exist."
//
// @Router /stations/{stationId} [get]
func GetSingleStation(c echo.Context) error {
	stationId := c.Param("stationId")
	stations := data.GetStationsList()

	if station, ok := stations[stationId]; ok {
		return c.JSON(http.StatusOK, station)
	}

	return c.JSON(http.StatusNotFound, "Station not found: The specified station does not exist.")
}

// @Summary Search for a station by name
//
// @Description Searches for a station using the provided name and returns the matching station information.
// @Description This endpoint is case and whitespace insensitive and returns the first exact match found.
//
// @Tags stations
//
// @Produce json
//
// @Param name query string true "Name of the station to search for"
//
// @Success 200 {object} utils.StationListEntry "Successfully found and retrieved the station data."
// @Failure 400 {object} map[string]string "Bad Request: Missing station name parameter."
// @Failure 404 {object} map[string]string "Station not found: No station matches the provided name."
//
// @Router /stations/search [get]
func SearchStation(c echo.Context) error {
	name := c.QueryParam("name")
	if name == "" {
		return c.JSON(http.StatusBadRequest, "Bad Request: Missing station name parameter.")
	}

	stations := data.GetStationsList()
	normalizedName := strings.ToLower(strings.TrimSpace(name))

	for _, station := range stations {
		if strings.ToLower(strings.TrimSpace(station.Name)) == normalizedName {
			return c.JSON(http.StatusOK, station)
		}
	}

	return c.JSON(http.StatusNotFound, "Station not found: No station matches the provided name.")
}
