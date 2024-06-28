package api_test

import (
	"fmt"
	"log"
	"math/rand"
	"os"
	"sync"
	"testing"
	"time"

	"database/sql"

	"github.com/FreiFahren/backend/database"
	_ "github.com/mattn/go-sqlite3"
)

var testdb *sql.DB

func CreateTestTable() {
	sql := `
		CREATE TABLE IF NOT EXISTS pool_test (
			id TEXT DEFAULT (lower(hex(randomblob(16)))) PRIMARY KEY,
			timestamp DATETIME NOT NULL DEFAULT (datetime('now')),
			message TEXT,
			author INTEGER,
			line TEXT(3),
			station_name TEXT,
			station_id TEXT(10),
			direction_name TEXT,
			direction_id TEXT(10)
		);`

	_, err := testdb.Exec(sql)
	if err != nil {
		fmt.Fprintf(os.Stderr, "(PoolDB_test.go) Failed to create pool table: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("Table created or already exists.")
}

func InsertInfo(timestamp *time.Time, message *string, author *int64, line, stationName, stationId, directionName, directionId *string) error {
	sql := `
    INSERT INTO pool_test (timestamp, message, author, line, station_name, station_id, direction_name, direction_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `

	// Convert *string and *int64 directly to interface{} for pgx
	values := []interface{}{timestamp, message, author, line, stationName, stationId, directionName, directionId}

	_, err := testdb.Exec(sql, values...)

	if err != nil {
		fmt.Fprintf(os.Stderr, "(PoolDB_test.go) Failed to insert ticket info: %v\n", err)
		return err
	}
	return nil
}

func OpenTestDB() {
	var err error

	p, err := sql.Open("sqlite3", os.Getenv("DB_URL"))
	if err != nil {
		log.Fatal("Error while creating connection to the database!!")
	}

	testdb = p

}

func setup() {
	OpenTestDB()
	database.OpenDB()
	CreateTestTable()
}

func teardown() {
	if testdb != nil {
		testdb.Close()
	}
	database.CloseDB()
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
			_, err := database.GetLatestTicketInspectors()
			if err != nil {
				errs <- err
			}

			remaining := 7
			currentStationIDs := []string{"U-PL", "SU-A", "SU-S"}

			_, err = database.GetHistoricStations(time.Now().UTC(), remaining, 24, currentStationIDs)
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

			err = InsertInfo(&now, &message, &author, &line, &stationName, &stationId, &directionName, &directionId)
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
