package main

import (
	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/server"
)

func main() {
	e := server.SetupServer()

	// Close the database connection when the main function returns
	defer database.ClosePool()

	// Start the server
	if err := e.Start(":8080"); err != nil {
		logger.Log.Fatal().Err(err).Msg("Shutting down the server")
	}
}