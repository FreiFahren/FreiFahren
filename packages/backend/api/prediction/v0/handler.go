package v0

import (
	"net/http"

	"github.com/FreiFahren/backend/api/prediction"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

type v0RiskData struct {
	LastModified  string            `json:"last_modified"`
	SegmentColors map[string]string `json:"segment_colors"`
}

// serializeToV0 converts the new RiskData format to the old v0RiskData format
func serializeToV0(data *prediction.RiskData) *v0RiskData {
	segmentColors := make(map[string]string)
	for sid, risk := range data.SegmentsRisk {
		segmentColors[sid] = risk.Color
	}
	return &v0RiskData{
		LastModified:  "", // to avoid breaking backward compatibility with mobile app
		SegmentColors: segmentColors,
	}
}

// @Summary Get risk segments
//
// @Description Retrieves risk predictions for transit segments.
// @Description This endpoint returns color-coded risk levels for different segments of the transit network based on recent ticket inspector activity.
//
// @Tags prediction
//
// @Produce json
//
// @Success 200 {object} v0RiskData "Successfully retrieved risk segments data"
// @Failure 500 "Internal Server Error: Failed to execute risk model"
//
// @Router /v0/risk-prediction/segment-colors [get]
func GetRiskSegments(c echo.Context) error {
	logger.Log.Info().Msg("GET /v0/risk-prediction/segment-colors")

	// Get from cache
	if cachedData, ok := prediction.Cache.Get(); ok {
		logger.Log.Debug().Msg("cache hit")
		return c.JSON(http.StatusOK, serializeToV0(cachedData))
	}

	// If cache is empty (first request), execute the model
	riskData, err := prediction.ExecuteRiskModel()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to execute risk model")
		return c.NoContent(http.StatusInternalServerError)
	}

	return c.JSON(http.StatusOK, serializeToV0(riskData))
}
