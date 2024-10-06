package lines

import (
	"net/http"
	"strings"

	"github.com/FreiFahren/backend/data"
	"github.com/labstack/echo/v4"
)

func GetAllLines(c echo.Context) error {
	return c.JSON(http.StatusOK, data.GetLinesList())
}

func GetSingleLine(c echo.Context) error {
	lineName := strings.ToUpper(c.Param("lineName"))
	lines := data.GetLinesList()

	if line, ok := lines[lineName]; ok {
		return c.JSON(http.StatusOK, line)
	}

	return c.JSON(http.StatusNotFound, map[string]string{"error": "Line not found"})
}
