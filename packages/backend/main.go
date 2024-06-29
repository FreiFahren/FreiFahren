package main

import (
	"net/http"

	"github.com/FreiFahren/backend/Rstats"
	"github.com/FreiFahren/backend/api"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	cron "github.com/robfig/cron/v3"
	echoSwagger "github.com/swaggo/echo-swagger"
)

type (
	Host struct {
		Echo *echo.Echo
	}
)

//	@title			FreiFahren API Documentation
//	@version		1.0
//	@description	API for the FreiFahren project, responsible for collecting and serving data about ticket inspectors on public transport.

// @host		localhost:8080
// @BasePath	/
func main() {
	logger.Init()
	
	data.EmbedJSONFiles()

	// Create a new connection pool, for concurrency
	err := database.OpenDB()

	if err != nil {
		logger.Log.Error().Msg("Could not create connection pool")
		logger.Log.Error().Str("Error", err.Error())
	}

	// Generate the inital risk segments
	Rstats.RunRiskModel()

	c := cron.New()

	// Update the risk model even if there are no reports for a long time
	_, err = c.AddFunc("*/10 * * * *", func() {
		Rstats.RunRiskModel()
	})
	if err != nil {
		logger.Log.Error().Msg("Could not schedule risk model update job")
		logger.Log.Error().Str("Error", err.Error())
	}

	// round the older timestamps
	_, err = c.AddFunc("*/5 * * * *", func() {
		database.RoundOldTimestamp()
	})
	if err != nil {
		logger.Log.Error().Msg("Could not schedule timestamp rounding job")
		logger.Log.Error().Str("Error", err.Error())
	}

	c.Start()

	logger.Log.Info().Msg("Server is running...")

	// Hosts
	hosts := map[string]*Host{}

	apiHOST := echo.New()
	apiHOST.Use(middleware.Recover())

	hosts["api.localhost:8080"] = &Host{apiHOST}

	apiHOST.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "API")
	})

	apiHOST.Use(middleware.CORS())

	apiHOST.GET("/swagger/*", echoSwagger.WrapHandler)

	// Close the database connection when the main function returns
	defer database.CloseDB()

	// Post a new ticket inspector
	apiHOST.POST("/basics/newInspector", api.PostInspector)

	// Return the recent ticket inspector info
	apiHOST.GET("/basics/recent", api.GetRecentTicketInspectorInfo)

	// Return the name for given id
	apiHOST.GET("/data/station", api.GetStationName)

	// Return all stations with their id
	apiHOST.GET("/data/list", api.GetAllStationsAndLines)

	// Return the id for given name
	apiHOST.GET("/data/id", api.GetStationId)

	// Return the distance between two stations
	apiHOST.GET("/transit/distance", api.GetStationDistance)

	// Get usage statistics
	apiHOST.GET("/statistics/stats", api.GetStats)

	// Get the list of highlighted segments and their colors
	apiHOST.GET("/risk-prediction/getSegmentColors", api.GetSegmentColors)

	apiHOST.Start(":8080")

	defer apiHOST.Close()
}
