package v0

import (
	"net/http"

	"github.com/FreiFahren/backend/api/navigation"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

// @Summary Get route itineraries between two stations
//
// @Description Retrieves possible routes between two stations, including a safest route based on risk prediction.
// @Description This endpoint calculates multiple route options and enriches them with risk data from the risk prediction model.
// @Description The response includes both the safest route and alternative routes, sorted by their calculated risk.
//
// @Tags transit
//
// @Accept json
// @Produce json
//
// @Param routeRequest body navigation.RouteRequest true "Start and end station IDs"
//
// @Success 200 {object} navigation.EnrichedRouteResponse "Successfully retrieved route options"
// @Failure 400 {object} map[string]string "Bad Request: Invalid request body or station IDs"
// @Failure 502 {object} map[string]string "Bad Gateway: Failed to fetch route from engine"
// @Failure 500 {object} map[string]string "Internal Server Error: Failed to process route data"
//
// @Router /v0/transit/itineraries [get]
func GetItineraries(c echo.Context) error {
	logger.Log.Info().Msg("GET /v0/itineraries")

	var req navigation.RouteRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	response, err := navigation.GenerateItineraries(req)
	if err != nil {
		switch err.(type) {
		case *navigation.ValidationError:
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": err.Error(),
			})
		case *navigation.EngineError:
			return c.JSON(http.StatusBadGateway, map[string]string{
				"error": err.Error(),
			})
		default:
			logger.Log.Error().Err(err).Msg("Unexpected error in GetItineraries")
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "An unexpected error occurred",
			})
		}
	}

	return c.JSON(http.StatusOK, response)
}
