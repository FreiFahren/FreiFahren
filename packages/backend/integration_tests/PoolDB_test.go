package integration_tests

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/FreiFahren/backend/database"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var testPool *pgxpool.Pool

func CreatePoolTestTable() {
	sql := `
	CREATE TABLE IF NOT EXISTS pool_test (
		id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
		timestamp TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
		message TEXT,
		author BIGINT,
		line VARCHAR(3),
		station_name VARCHAR(255),
		station_id VARCHAR(10),
		direction_name VARCHAR(255),
		direction_id VARCHAR(10)
	);
	`

	_, err := testPool.Exec(context.Background(), sql)
	if err != nil {
		fmt.Fprintf(os.Stderr, "(PoolDB_test.go) Failed to create pool table: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Table created or already exists.")
}

func InsertPoolInfo(timestamp *time.Time, message *string, author *int64, line, stationName, stationId, directionName, directionId *string) error {

	sql := `
    INSERT INTO pool_test (timestamp, message, author, line, station_name, station_id, direction_name, direction_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `

	// Convert *string and *int64 directly to interface{} for pgx
	values := []interface{}{timestamp, message, author, line, stationName, stationId, directionName, directionId}

	_, err := testPool.Exec(context.Background(), sql, values...)

	if err != nil {
		fmt.Fprintf(os.Stderr, "(PoolDB_test.go) Failed to insert ticket info: %v\n", err)
		return err
	}
	return nil
}

func CreateTestPool() {
	var err error

	p, err := pgxpool.NewWithConfig(context.Background(), database.Config())
	if err != nil {
		log.Fatal("Error while creating connection to the database!!")
	}

	testPool = p

}

func setup() {
	envPath := filepath.Join("..", ".env")

	// Load the .env file from the constructed path
	err := godotenv.Load(envPath)
	if err != nil {
		cwd, _ := os.Getwd()
		log.Printf("Current working directory: %s", cwd)
		log.Fatal("Error loading .env file from path: ", envPath)
	}

	CreateTestPool()
	database.CreatePool()
	CreatePoolTestTable()
}

func teardown() {

	if testPool != nil {
		testPool.Close()
	}
	database.ClosePool()

}

func TestGetLatestStationCoordinatesConcurrency(t *testing.T) {
	setup()
	defer teardown()

	errs := make(chan error, 1000) // Buffer the channel to prevent goroutines from blocking

	var WaitGroup sync.WaitGroup
	for i := 0; i < 100; i++ {
		WaitGroup.Add(1)
		go func(i int) {
			defer WaitGroup.Done()

			t.Logf("Running test %d", i)

			// Call the function with the pool (on the real database)
			startTime := time.Now().UTC().Add(-time.Hour)
			endTime := time.Now().UTC()
			_, err := database.GetLatestTicketInspectors(startTime, endTime)
			if err != nil {
				errs <- err
			}

			remaining := 7
			currentStationIds := []string{"U-PL", "SU-A", "SU-S"}

			_, err = database.GetHistoricStations(time.Now().UTC(), remaining, 24, currentStationIds)
			if err != nil {
				errs <- err
			}

			// Seed the random number generator with the current time
			rand.New(rand.NewSource(20))

			// Enter a random ticket info into the database (on the pool test table)

			now := time.Now().UTC()
			message := "Platz der Lufbrücke"
			author := rand.Int63()
			line := "U6"
			stationId := "U-PL"
			stationName := "Platz der Lufbrücke"
			directionName := "Alt-Tegel"
			directionId := "U-ATg"

			err = InsertPoolInfo(&now, &message, &author, &line, &stationName, &stationId, &directionName, &directionId)
			if err != nil {
				log.Fatalf("Failed to insert ticket info: %v", err)
			}

		}(i)
	}
	WaitGroup.Wait()

	close(errs) // Close the channel to signal that no more errors will be sent

	// Check if any errors were sent on the channel
	if err, ok := <-errs; ok {
		t.Fatalf("Failed to get latest station coordinates: %v", err)
	}
}
