package v0

import (
	"net/http"

	"github.com/FreiFahren/backend/api/prediction"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

// @Summary Get risk segments
//
// @Description Retrieves risk predictions for transit segments.
// @Description This endpoint returns color-coded risk levels along with the risk value for different segments of the transit network based on recent ticket inspector activity.
//
// @Tags prediction
//
// @Produce json
//
// @Success 200 {object} prediction.RiskData "Successfully retrieved risk segments data"
// @Failure 500 "Internal Server Error: Failed to execute risk model"
//
// @Router /v1/risk-prediction/segment-colors [get]
func GetRiskSegments(c echo.Context) error {
	logger.Log.Info().Msg("GET '/v1/risk-prediction/segment-colors' UserAgent: " + c.Request().UserAgent())

	// Get from cache
	if cachedData, ok := prediction.Cache.Get(); ok {
		logger.Log.Debug().Msg("cache hit")
		return c.JSON(http.StatusOK, cachedData)
	}

	// If cache is empty (first request), execute the model
	riskData, err := prediction.ExecuteRiskModel()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to execute risk model")
		return c.NoContent(http.StatusInternalServerError)
	}

	return c.JSON(http.StatusOK, riskData)
}
