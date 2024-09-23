package server

import (
	"net/http"

	"github.com/FreiFahren/backend/Rstats"
	"github.com/FreiFahren/backend/api/distance"
	"github.com/FreiFahren/backend/api/getAllStationsAndLines"
	"github.com/FreiFahren/backend/api/getId"
	"github.com/FreiFahren/backend/api/getSegmentColors"
	"github.com/FreiFahren/backend/api/getStationName"
	"github.com/FreiFahren/backend/api/inspectors"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	cron "github.com/robfig/cron/v3"
	echoSwagger "github.com/swaggo/echo-swagger"
)

func SetupServer() *echo.Echo {
	logger.Init()

	// Find the .env file
	envPath, err := utils.FindEnvFile()
	if err != nil {
		logger.Log.Panic().Msg("Could not locate .env file")
		logger.Log.Panic().Str("Error", err.Error()).Send()
	}

	// Load .env file
	err = godotenv.Overload(envPath)
	if err != nil {
		logger.Log.Panic().Msg("Error loading .env file")
		logger.Log.Panic().Str("Error", err.Error()).Send()
	}

	data.EmbedJSONFiles()

	// Create a new connection pool, for concurrency
	database.CreatePool()
	if err != nil {
		logger.Log.Error().Msg("Could not create connection pool")
		logger.Log.Error().Str("Error", err.Error()).Send()
	}

	// Generate the initial risk segments
	Rstats.RunRiskModel()

	c := cron.New()

	// Schedule a job to backup the database every day at midnight
	_, err = c.AddFunc("0 0 * * *", func() {
		database.BackupDatabase()
	})
	if err != nil {
		logger.Log.Error().Msg("Could not schedule backup job")
		logger.Log.Error().Str("Error", err.Error()).Send()
	}

	// Update the risk model even if there are no reports for a long time
	_, err = c.AddFunc("*/10 * * * *", func() {
		Rstats.RunRiskModel()
	})
	if err != nil {
		logger.Log.Error().Msg("Could not schedule risk model update job")
		logger.Log.Error().Str("Error", err.Error()).Send()
	}

	// Round the older timestamps
	_, err = c.AddFunc("*/5 * * * *", func() {
		database.RoundOldTimestamp()
	})
	if err != nil {
		logger.Log.Error().Msg("Could not schedule timestamp rounding job")
		logger.Log.Error().Str("Error", err.Error()).Send()
	}

	c.Start()

	logger.Log.Info().Msg("Server is running...")

	// Initialize Echo instance
	e := echo.New()
	e.Use(middleware.Recover())
	e.Use(middleware.CORS())

	// Define routes
	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "API")
	})

	e.GET("/swagger/*", echoSwagger.WrapHandler)

	// Ensure the required table exists
	database.CreateTicketInfoTable()

	e.POST("/basics/inspectors", inspectors.PostInspector)
	e.GET("/basics/inspectors", inspectors.GetTicketInspectorsInfo)

	e.GET("/data/station", getStationName.GetStationName)

	e.GET("/data/list", getAllStationsAndLines.GetAllStationsAndLines)

	e.GET("/data/id", getId.GetStationId)

	e.GET("/transit/distance", distance.GetStationDistance)

	e.GET("/risk-prediction/segment-colors", getSegmentColors.GetSegmentColors)

	return e
}