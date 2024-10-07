package lines

import (
	"net/http"
	"strings"

	"github.com/FreiFahren/backend/data"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/logger"
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
