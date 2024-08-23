package integration_tests

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
	expectedDirection string
}

// createTestCase is a factory function for creating test cases
func createTestCase(name, stationID, directionID, line, expectedLine, expectedStation, expectedDirection string) TestCase {
	return TestCase{
		name:           name,
		stationID:      stationID,
		directionID:    directionID,
		line:           line,
		expectedLine:   expectedLine,
		expectedStation: expectedStation,
		expectedDirection: expectedDirection,
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
	if pointers.LinePtr != nil {
		assert.Equal(t, tc.expectedLine, *pointers.LinePtr, "LinePtr should point to %s", tc.expectedLine)
	}
	assert.Equal(t, tc.expectedStation, dataToInsert.Station.ID, "Station ID should be %s", tc.expectedStation)
	assert.Equal(t, tc.expectedDirection, dataToInsert.Direction.ID, "Direction ID should be %s", tc.expectedDirection)
}

func TestPostProcessInspectorData(t *testing.T) {
	// Setup test environment
	godotenv.Overload()
	data.EmbedJSONFiles()
	database.CreatePool()
	defer database.ClosePool()

	// Define test cases
	testCases := []TestCase{
		// Tests for AssignLineIfSingleOption
		createTestCase("Imply line from direction", "", "U-U", "", "U1", "U-HaT", "U-U"),
		createTestCase("Imply line from station", "U-Tk", "", "", "U5", "U-Tk", ""),
		createTestCase("Imply line from station and direction", "U-Tk", "SU-H", "", "U5", "U-Tk", "SU-H"),
		createTestCase("Don't imply line if station and direction are missing", "", "", "", "", "", ""),
		createTestCase("Dont imply line if it is already set", "U-Tk", "SU-H", "U5", "U5", "U-Tk", "SU-H"),
		createTestCase("Don't imply line if there are multiple options", "U-Kbo", "", "", "", "U-Kbo", ""),
		// Tests for guessStation
		createTestCase("Guess the station when line and no station", "", "", "U2", "U2", "SU-A", ""),
		createTestCase("Don't guess the station when the line is not set", "", "SU-H", "", "", "", ""),
		createTestCase("Don't guess the station when the station is already set", "SU-A", "", "U2", "U2", "SU-A", ""),
		// Tests for DetermineDirectionIfImplied
		createTestCase("Imply direction and Line from station", "U-Mf", "", "", "U6", "U-Mf", "U-Sch"),
		createTestCase("Imply direction from station and line", "SU-PA", "", "U2", "U2", "SU-PA", "U-Rl"),
		createTestCase("Imply direction just from station", "U-Kr", "", "", "U3", "U-Kr", "SU-WA"),
		// Test if station is not on the line
		createTestCase("Remove line if station is not on the line", "U-Kbo", "", "U2", "", "U-Kbo", ""),
		createTestCase("Remove line if not on station and reset if possible", "U-Kr", "", "U2", "U3", "U-Kr", "SU-WA"),

	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			runPostProcessTest(t, tc)
		})
	}
}