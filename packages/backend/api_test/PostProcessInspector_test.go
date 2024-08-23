package api_test

import (
	"testing"
	"time"

	"github.com/FreiFahren/backend/api/inspectors"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	structs "github.com/FreiFahren/backend/utils"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/assert"
)

// TestCase represents a single test case for PostProcessInspectorData
type TestCase struct {
	name           string
	stationID      string
	directionID    string
	line           string
	expectedLine   string
	expectedStation string
}

// createTestCase is a factory function for creating test cases
func createTestCase(name, stationID, directionID, line, expectedLine, expectedStation string) TestCase {
	return TestCase{
		name:           name,
		stationID:      stationID,
		directionID:    directionID,
		line:           line,
		expectedLine:   expectedLine,
		expectedStation: expectedStation,
	}
}

// runPostProcessTest executes a single test case
func runPostProcessTest(t *testing.T, tc TestCase) {
	dataToInsert := &structs.ResponseData{
		Timestamp: time.Now(),
		Station:   structs.Station{ID: tc.stationID},
		Direction: structs.Station{ID: tc.directionID},
		Line:      tc.line,
	}
	pointers := &structs.InsertPointers{
		StationIDPtr:   &dataToInsert.Station.ID,
		DirectionIDPtr: &dataToInsert.Direction.ID,
		LinePtr:        &dataToInsert.Line,
	}

	err := inspectors.PostProcessInspectorData(dataToInsert, pointers)

	assert.NoError(t, err)
	assert.Equal(t, tc.expectedLine, dataToInsert.Line, "Line should be %s", tc.expectedLine)
	assert.NotNil(t, pointers.LinePtr, "LinePtr should not be nil")
	if pointers.LinePtr != nil {
		assert.Equal(t, tc.expectedLine, *pointers.LinePtr, "LinePtr should point to %s", tc.expectedLine)
	}
	assert.Equal(t, tc.expectedStation, dataToInsert.Station.ID, "Station ID should be %s", tc.expectedStation)
}

func TestPostProcessInspectorData(t *testing.T) {
	// Setup test environment
	godotenv.Overload()
	data.EmbedJSONFiles()
	database.CreatePool()
	defer database.ClosePool()

	// Define test cases
	testCases := []TestCase{
		createTestCase("Imply line from direction", "", "U-U", "", "U1", "U-HaT"),
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			runPostProcessTest(t, tc)
		})
	}
}