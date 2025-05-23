package v0

import (
	"net/http"

	"github.com/FreiFahren/backend/api/itineraries"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

// @Summary Get route itineraries between two stations
//
// @Description Retrieves possible routes between two stations, including a safest itinerary based on risk prediction.
// @Description This endpoint calculates multiple itinerary options and enriches them with risk data from the risk prediction model.
// @Description The response includes both the safest itinerary and alternative itineraries, sorted by their calculated risk.
//
// @Tags transit
//
// @Accept json
// @Produce json
//
// @Param startStation query string true "Start station ID"
// @Param endStation query string true "End station ID"
//
// @Success 200 {object} itineraries.ItinerariesResponse "Successfully retrieved route options"
// @Failure 400 {object} map[string]string "Bad Request: Missing or invalid station IDs"
// @Failure 502 {object} map[string]string "Bad Gateway: Failed to fetch route from engine"
// @Failure 500 {object} map[string]string "Internal Server Error: Failed to process route data"
//
// @Router /v0/transit/itineraries [get]
func GetItineraries(c echo.Context) error {
	logger.Log.Info().Msg("GET '/v0/transit/itineraries' UserAgent: " + c.Request().UserAgent())

	startStation := c.QueryParam("startStation")
	endStation := c.QueryParam("endStation")

	if startStation == "" || endStation == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Missing startStation or endStation query parameter",
		})
	}

	req := itineraries.ItineraryRequest{
		StartStation: startStation,
		EndStation:   endStation,
	}

	response, err := itineraries.GenerateItineraries(req)
	if err != nil {
		switch err.(type) {
		case *itineraries.ValidationError:
			return c.JSON(http.StatusBadRequest, map[string]string{
				"error": err.Error(),
			})
		case *itineraries.EngineError:
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
