package v0

import (
	"github.com/FreiFahren/backend/api/stations"
	"github.com/FreiFahren/backend/caching"
	"github.com/labstack/echo/v4"
)

const Version = "v0"

// @Summary Get all stations (v0)
// @Description Retrieves information about all available stations for API version v0.
// @Tags stations-v0
// @Produce json
// @Success 200 {object} map[string]utils.StationListEntry "Successfully retrieved station data."
// @Success 304 "Not Modified (cached version is current)."
// @Failure 500 {object} map[string]string "Internal Server Error"
// @Router /v0/stations [get]
func GetAllStations(c echo.Context) error {
	cacheKey := "stations_" + Version // Version-specific cache key

	if cache, exists := caching.GlobalCacheManager.Get(cacheKey); exists {
		// Use the ETag middleware. It will call the inner function only if the cache is stale.
		return cache.ETagMiddleware()(func(c echo.Context) error {
			// If we reach here, the cache was stale or didn't exist, so we call the core logic.
			return stations.HandleGetAllStations(c, Version)
		})(c)
	}

	// If caching is not configured for this key, call the core logic directly.
	return stations.HandleGetAllStations(c, Version)
}

// @Summary Get a single station by ID (v0)
// @Description Retrieves information about a specific station based on its ID for API version v0.
// @Tags stations-v0
// @Produce json
// @Param stationId path string true "ID of the station"
// @Success 200 {object} utils.StationListEntry "Successfully retrieved the specified station data."
// @Failure 404 {object} map[string]string "Station not found"
// @Router /v0/stations/{stationId} [get]
func GetSingleStation(c echo.Context) error {
	// Caching is less common/useful for single item lookups by ID, handled in core logic.
	return stations.HandleGetSingleStation(c, Version)
}

// @Summary Search for a station by name (v0)
// @Description Searches for a station using the provided name for API version v0.
// @Tags stations-v0
// @Produce json
// @Param name query string true "Name of the station to search for"
// @Success 200 {object} utils.StationListEntry "Successfully found and retrieved the station data."
// @Failure 400 {object} map[string]string "Bad Request: Missing station name parameter."
// @Failure 404 {object} map[string]string "Station not found: No station matches the provided name."
// @Router /v0/stations/search [get]
func SearchStation(c echo.Context) error {
	// Caching search results can be complex, handled in core logic for now.
	return stations.HandleSearchStation(c, Version)
}
