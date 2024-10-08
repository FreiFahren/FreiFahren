package stations

import (
	"net/http"
	"strings"
	"time"

	"github.com/FreiFahren/backend/data"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/statistics"
	"github.com/FreiFahren/backend/utils"
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
// @Success 200 {object} map[string]utils.Station
// @Failure 500 "Internal Server Error: Error retrieving stations data."
//
// @Router /stations [get]
func GetAllStations(c echo.Context) error {
	logger.Log.Info().Msg("GET /stations")

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
	logger.Log.Info().Msg("GET /stations/:stationId")

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
// @Success 200 {object} map[string]utils.StationListEntry "Successfully found and retrieved the station data."
// @Failure 400 {object} map[string]string "Bad Request: Missing station name parameter."
// @Failure 404 {object} map[string]string "Station not found: No station matches the provided name."
//
// @Router /stations/search [get]
func SearchStation(c echo.Context) error {
	logger.Log.Info().Msg("GET /stations/search")

	name := c.QueryParam("name")
	if name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Bad Request: Missing station name parameter."})
	}

	stations := data.GetStationsList()
	normalizedName := strings.ToLower(strings.TrimSpace(name))

	for id, station := range stations {
		if strings.ToLower(strings.TrimSpace(station.Name)) == normalizedName {
			return c.JSON(http.StatusOK, map[string]utils.StationListEntry{id: station})
		}
	}

	return c.JSON(http.StatusNotFound, map[string]string{"error": "Station not found: No station matches the provided name."})
}

// @Summary Get station statistics
//
// @Description Retrieves statistics for a specific station.
// @Description This endpoint returns the number of reports for the specified station within the given time range.
//
// @Tags stations
//
// @Produce json
//
// @Param stationId path string true "ID of the station"
// @Param lineId query string false "ID of the line (optional)"
// @Param start query string false "Start time for the statistics (format: RFC3339)"
// @Param end query string false "End time for the statistics (format: RFC3339)"
//
// @Success 200 {object} statistics.Statistics "Successfully retrieved station statistics."
// @Failure 400 {object} error "Bad Request: Invalid time format."
// @Failure 500 {object} error "Internal Server Error: Failed to get number of reports."
//
// @Router /stations/{stationId}/statistics [get]
func GetStationStatistics(c echo.Context) error {
	logger.Log.Info().Msg("GET /stations/:stationId/statistics")

	stationId := c.Param("stationId")
	start := c.QueryParam("start")
	end := c.QueryParam("end")

	startTime, endTime := utils.GetTimeRange(start, end, 7*24*time.Hour)

	stats, err := statistics.GetStatistics(stationId, "", startTime, endTime)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Server Error: Failed to get number of reports."})
	}

	return c.JSON(http.StatusOK, stats)
}
