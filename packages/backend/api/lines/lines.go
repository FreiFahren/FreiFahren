package lines

import (
	"net/http"

	"github.com/FreiFahren/backend/data"
	"github.com/labstack/echo/v4"
)

func GetAllLines(c echo.Context) error {
	return c.JSON(http.StatusOK, data.GetLinesList())
}
