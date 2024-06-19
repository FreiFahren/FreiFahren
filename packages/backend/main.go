package main

import (
	"log"
	"net/http"

	"github.com/FreiFahren/backend/Rstats"
	"github.com/FreiFahren/backend/api"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/joho/godotenv"
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

func main() {
	// Load .env file
	err := godotenv.Overload()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	data.EmbedJSONFiles()

	// Create a new connection pool, for concurrency
	database.CreatePool()
	if err != nil {
		log.Fatal("Error while creating a pool :(")
	}

	// Generate the inital risk segments
	Rstats.RunRiskModel()

	c := cron.New()

	// Schedule a job to backup the database every day at midnight
	_, err = c.AddFunc("0 0 * * *", func() {
		database.BackupDatabase()
	})
	if err != nil {
		log.Fatalf("(main.go) Could not schedule backup job: %v", err)
	}

	// Update the risk model even if there are no reports for a long time
	_, err = c.AddFunc("*/10 * * * *", func() {
		Rstats.RunRiskModel()
	})
	if err != nil {
		log.Fatalf("Could not schedule risk model update job: %v", err)
	}

	// round the older timestamps
	_, err = c.AddFunc("*/5 * * * *", func() {
		database.RoundOldTimestamp()
	})
	if err != nil {
		log.Fatalf("Could not schedule timestamp rounding job: %v", err)
	}

	c.Start()

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
	defer database.ClosePool()

	// Ensure the required table exists
	database.CreateTicketInfoTable()

	// Return the id for given name
	apiHOST.GET("/id", api.GetStationId)

	// Return the last known inspectors
	apiHOST.GET("/recent", api.GetRecentTicketInspectorInfo)

	// Return the name for given id
	apiHOST.GET("/station", api.GetStationName)

	// Return all stations with their id (used for suggestions on the frontend)
	apiHOST.GET("/list", api.GetAllStationsAndLines)

	// Return the distance between two stations
	apiHOST.GET("/distance", api.GetStationDistance)

	// Post a new ticket inspector
	apiHOST.POST("/newInspector", api.PostInspector)

	// Get usage statistics
	apiHOST.GET("/stats", api.GetStats)

	// Get the list of highlighted segments and their colors
	apiHOST.GET("/getSegmentColors", api.GetSegmentColors)

	apiHOST.Start(":8080")

	defer apiHOST.Close()
}
