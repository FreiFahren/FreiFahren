package server

import (
	"encoding/json"
	"net/http"

	"github.com/FreiFahren/backend/api/distance"
	"github.com/FreiFahren/backend/api/feedback"
	"github.com/FreiFahren/backend/api/inspectors"
	itinerariesV0 "github.com/FreiFahren/backend/api/itineraries/v0"
	"github.com/FreiFahren/backend/api/lines"
	"github.com/FreiFahren/backend/api/prediction"
	predictionV0 "github.com/FreiFahren/backend/api/prediction/v0"
	predictionV1 "github.com/FreiFahren/backend/api/prediction/v1"
	"github.com/FreiFahren/backend/api/stations"
	statisticsV0 "github.com/FreiFahren/backend/api/stations/statistics/v0"
	"github.com/FreiFahren/backend/caching"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/limiting"
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

	c := cron.New()

	// Schedule a job to backup the database every day at midnight
	_, err = c.AddFunc("0 0 * * *", func() {
		database.BackupDatabase()
	})
	if err != nil {
		logger.Log.Error().Msg("Could not schedule backup job")
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

	// Add cron job to update risk model every 5 minutes
	_, err = c.AddFunc("*/5 * * * *", func() {
		_, err := prediction.ExecuteRiskModel()
		if err != nil {
			logger.Log.Error().Err(err).Msg("Failed to execute risk model in cron job")
		}
	})
	if err != nil {
		logger.Log.Error().Msg("Could not schedule risk model update job")
		logger.Log.Error().Str("Error", err.Error()).Send()
	}

	// remove old submissions from rate limiter every minute
	_, err = c.AddFunc("* * * * *", func() {
		limiting.GlobalRateLimiter.CleanupOldSubmissions()
	})
	if err != nil {
		logger.Log.Error().Msg("Could not schedule rate limiter cleanup job")
		logger.Log.Error().Str("Error", err.Error()).Send()
	}

	c.Start()

	logger.Log.Info().Msg("Server is running...")

	// Initialize Echo instance
	e := echo.New()
	e.Use(middleware.Recover())

	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete},
		AllowHeaders: []string{
			echo.HeaderOrigin,
			echo.HeaderContentType,
			echo.HeaderAccept,
			"If-None-Match",
			"If-Modified-Since",
			"baggage",
			"sentry-trace",
		},
		ExposeHeaders: []string{"ETag", "Last-Modified"},
	}))

	e.GET("/", func(c echo.Context) error {
		return c.String(http.StatusOK, "API")
	})

	e.GET("/swagger/*", echoSwagger.WrapHandler)

	// Ensure the required table exists
	database.CreateTicketInfoTable()
	database.CreateFeedbackTable()

	caching.InitCacheManager()
	segments := data.GetSegments()
	caching.GlobalCacheManager.Register("segments", segments, caching.CacheConfig{
		MaxAgeInSeconds:   31536000, // 1 year
		ContentTypeInMIME: "application/json",
	})

	linesList := data.GetLinesList()
	linesBytes, err := json.Marshal(linesList)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error marshaling lines data for cache")
	}
	caching.GlobalCacheManager.Register("lines", linesBytes, caching.CacheConfig{
		MaxAgeInSeconds:   31536000, // 1 year
		ContentTypeInMIME: "application/json",
	})

	stationsList := data.GetStationsList()
	stationsBytes, err := json.Marshal(stationsList)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error marshaling stations data for cache")
	}
	caching.GlobalCacheManager.Register("stations", stationsBytes, caching.CacheConfig{
		MaxAgeInSeconds:   31536000, // 1 year
		ContentTypeInMIME: "application/json",
	})

	// Create API version groups
	v0 := e.Group("/v0")
	v1 := e.Group("/v1")
	latest := e // Routes without version prefix will point to latest version

	// V0 Routes
	v0.POST("/basics/inspectors", inspectors.PostInspector)
	v0.GET("/basics/inspectors", inspectors.GetTicketInspectorsInfo)

	v0.GET("/lines", lines.GetAllLines)
	v0.GET("/lines/segments", lines.GetAllSegments)
	v0.GET("/lines/:lineName", lines.GetSingleLine)
	v0.GET("/lines/:lineId/:stationId/statistics", lines.GetLineStatistics)

	v0.GET("/stations", stations.GetAllStations)
	v0.GET("/stations/:stationId", stations.GetSingleStation)
	v0.GET("/stations/:stationId/statistics", statisticsV0.GetStationStatistics)
	v0.GET("/stations/search", stations.SearchStation)

	v0.GET("/transit/distance", distance.GetStationDistance)
	v0.GET("/transit/itineraries", itinerariesV0.GetItineraries)

	v0.GET("/risk-prediction/segment-colors", predictionV0.GetRiskSegments)

	v0.POST("/feedback", feedback.PostFeedback)

	// V1 Routes
	v1.GET("/risk-prediction/segment-colors", predictionV1.GetRiskSegments)

	// Latest Routes
	latest.POST("/basics/inspectors", inspectors.PostInspector)
	latest.GET("/basics/inspectors", inspectors.GetTicketInspectorsInfo)

	latest.GET("/lines", lines.GetAllLines)
	latest.GET("/lines/segments", lines.GetAllSegments)
	latest.GET("/lines/:lineName", lines.GetSingleLine)
	latest.GET("/lines/:lineId/:stationId/statistics", lines.GetLineStatistics)

	latest.GET("/stations", stations.GetAllStations)
	latest.GET("/stations/:stationId", stations.GetSingleStation)
	latest.GET("/stations/:stationId/statistics", statisticsV0.GetStationStatistics)
	latest.GET("/stations/search", stations.SearchStation)

	latest.GET("/transit/distance", distance.GetStationDistance)
	latest.GET("/transit/itineraries", itinerariesV0.GetItineraries)

	latest.GET("/risk-prediction/segment-colors", predictionV1.GetRiskSegments)

	latest.POST("/feedback", feedback.PostFeedback)

	return e
}
