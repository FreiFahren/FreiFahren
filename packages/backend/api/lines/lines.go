package lines

import (
	"net/http"
	"strings"
	"time"

	"github.com/FreiFahren/backend/caching"
	"github.com/FreiFahren/backend/data"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/statistics"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

// @Summary Get all lines
//
// @Description Retrieves information about all available transit lines.
// @Description This endpoint returns a list of all transit lines and their associated stations.
//
// @Tags lines
//
// @Produce json
//
// @Success 200 {object} map[string][]string "Successfully retrieved all lines data."
// @Failure 500 "Internal Server Error: Error retrieving lines data."
//
// @Router /lines [get]
func GetAllLines(c echo.Context) error {
	logger.Log.Info().Msg("GET /lines")

	return c.JSON(http.StatusOK, data.GetLinesList())
}

// @Summary Get a single line
//
// @Description Retrieves information about a specific transit line.
// @Description This endpoint returns the details of a single line, including all its stations, based on the provided line name.
//
// @Tags lines
//
// @Produce json
//
// @Param lineName path string true "Name of the line (e.g., S1, U2)"
//
// @Success 200 {object} map[string][]string "Successfully retrieved the specified line data."
// @Failure 404 {object} string "Line not found: The specified line does not exist."
// @Failure 500 "Internal Server Error: Error retrieving line data."
//
// @Router /lines/{lineName} [get]
func GetSingleLine(c echo.Context) error {
	logger.Log.Info().Msg("GET /lines/:lineName")

	lineName := strings.ToUpper(c.Param("lineName"))
	lines := data.GetLinesList()

	if line, ok := lines[lineName]; ok {
		return c.JSON(http.StatusOK, line)
	}

	return c.JSON(http.StatusNotFound, "Line not found: The specified line does not exist.")
}

// @Summary Get line statistics
//
// @Description Retrieves statistics for a specific line at a specific station.
// @Description This endpoint returns the number of reports for the specified line at the given station within the given time range.
//
// @Tags lines
//
// @Produce json
//
// @Param lineId path string true "ID of the line"
// @Param stationId path string true "ID of the station"
// @Param start query string false "Start time for the statistics (format: RFC3339)"
// @Param end query string false "End time for the statistics (format: RFC3339)"
//
// @Success 200 {object} statistics.Statistics "Successfully retrieved line statistics."
// @Failure 400 {object} error "Bad Request: Invalid time format."
// @Failure 500 {object} error "Internal Server Error: Failed to get number of reports."
//
// @Router /lines/{lineId}/{stationId}/statistics [get]
func GetLineStatistics(c echo.Context) error {
	logger.Log.Info().Msg("GET /lines/:lineId/:stationId/statistics")

	lineId := c.Param("lineId")
	stationId := c.Param("stationId")
	start := c.QueryParam("start")
	end := c.QueryParam("end")

	startTime, endTime := utils.GetTimeRange(start, end, 7*24*time.Hour)

	stats, err := statistics.GetStatistics(stationId, lineId, startTime, endTime)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Internal Server Error: Failed to get number of reports."})
	}

	return c.JSON(http.StatusOK, stats)
}

// @Summary Get all segments
//
// @Description Retrieves information about all available transit segments.
// @Description A segment is the geojson lineString part of a line between two stations.
//
// @Tags lines
//
// @Produce json
//
// @Success 200 {object} json.RawMessage
// @Success 304 "Not Modified"
// @Failure 500 {object} error "Internal Server Error: Error retrieving segments data."
//
// @Router /lines/segments [get]
func GetAllSegments(c echo.Context) error {
	logger.Log.Info().Msg("GET /lines/segments")
	if cache, exists := caching.GlobalCacheManager.Get("segments"); exists {
		return cache.ETagMiddleware()(func(c echo.Context) error {
			return nil
		})(c)
	}

	// Fallback if cache doesn't exist
	segments := data.GetSegments()
	return c.JSONBlob(http.StatusOK, segments)
}
