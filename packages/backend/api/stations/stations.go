package stations

import (
	"net/http"
	"strings"

	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

// handleGetAllStations is the core logic for retrieving all stations for a specific version.
func HandleGetAllStations(c echo.Context, version string) error {
	logger.Log.Info().Str("version", version).Msg("Handling GET /stations request")

	versionPtr := version // Need a variable to take address
	stations := data.GetStationsList(&versionPtr)

	// The actual response (including potential 304 Not Modified) is handled
	// by the ETag middleware in the version-specific wrapper handler.
	// This function just returns the data to be potentially cached and sent.
	return c.JSON(http.StatusOK, stations)
}

// handleGetSingleStation is the core logic for retrieving a single station by ID for a specific version.
func HandleGetSingleStation(c echo.Context, version string) error {
	logger.Log.Info().Str("version", version).Msg("Handling GET /stations/:stationId request")

	stationId := c.Param("stationId")
	versionPtr := version // Need a variable to take address
	stations := data.GetStationsList(&versionPtr)

	if station, ok := stations[stationId]; ok {
		return c.JSON(http.StatusOK, station)
	}

	return c.JSON(http.StatusNotFound, map[string]string{"error": "Station not found: The specified station does not exist."})
}

// handleSearchStation is the core logic for searching for a station by name for a specific version.
func HandleSearchStation(c echo.Context, version string) error {
	logger.Log.Info().Str("version", version).Msg("Handling GET /stations/search request")

	name := c.QueryParam("name")
	if name == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Bad Request: Missing station name parameter."})
	}

	versionPtr := version // Need a variable to take address
	stations := data.GetStationsList(&versionPtr)
	normalizedName := strings.ToLower(strings.TrimSpace(name))

	for _, station := range stations {
		if strings.ToLower(strings.TrimSpace(station.Name)) == normalizedName {
			// Return the single match directly
			return c.JSON(http.StatusOK, station)
		}
	}

	return c.JSON(http.StatusNotFound, map[string]string{"error": "Station not found: No station matches the provided name."})
}
