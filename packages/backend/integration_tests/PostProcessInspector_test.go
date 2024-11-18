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
	name              string
	stationId         string
	directionId       string
	line              string
	expectedLine      string
	expectedStation   string
	expectedDirection string
}

// createTestCase is a factory function for creating test cases
func createTestCase(name, stationId, directionId, line, expectedLine, expectedStation, expectedDirection string) TestCase {
	return TestCase{
		name:              name,
		stationId:         stationId,
		directionId:       directionId,
		line:              line,
		expectedLine:      expectedLine,
		expectedStation:   expectedStation,
		expectedDirection: expectedDirection,
	}
}

// runPostProcessTest executes a single test case
func runPostProcessTest(t *testing.T, tc TestCase) {
	dataToInsert := &structs.ResponseData{
		Timestamp: time.Now(),
		Station:   structs.Station{Id: tc.stationId},
		Direction: structs.Station{Id: tc.directionId},
		Line:      tc.line,
	}
	pointers := &structs.InsertPointers{
		StationIdPtr:   &dataToInsert.Station.Id,
		DirectionIdPtr: &dataToInsert.Direction.Id,
		LinePtr:        &dataToInsert.Line,
	}

	err := inspectors.PostProcessInspectorData(dataToInsert, pointers)

	assert.NoError(t, err)
	assert.Equal(t, tc.expectedLine, dataToInsert.Line, "Line should be %s", tc.expectedLine)
	if pointers.LinePtr != nil {
		assert.Equal(t, tc.expectedLine, *pointers.LinePtr, "LinePtr should point to %s", tc.expectedLine)
	}
	assert.Equal(t, tc.expectedStation, dataToInsert.Station.Id, "Station Id should be %s", tc.expectedStation)
	assert.Equal(t, tc.expectedDirection, dataToInsert.Direction.Id, "Direction Id should be %s", tc.expectedDirection)
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
		createTestCase("Imply line from direction", "", "U-U", "", "U1", "U-Kbo", "U-U"),
		createTestCase("Imply line from station", "U-FN", "", "", "U8", "U-FN", ""),
		createTestCase("Imply line from station and direction", "U-FN", "SU-WIU", "", "U8", "U-FN", "SU-WIU"),
		createTestCase("Don't imply line if station and direction are missing", "", "", "", "", "", ""),
		createTestCase("Dont imply line if it is already set", "UM-Tk", "SUM-H", "U5", "U5", "UM-Tk", "U-Hö"),
		createTestCase("Don't imply line if there are multiple options", "U-Kbo", "", "", "", "U-Kbo", ""),
		// Tests for guessStation
		createTestCase("Don't guess the station when the line is not set", "", "SUM-H", "", "", "", ""),
		createTestCase("Don't guess the station when the station is already set", "SUM-A", "", "U2", "U2", "SUM-A", ""),
		// Tests for DetermineDirectionIfImplied
		createTestCase("Imply direction and Line from station", "U-Mf", "", "", "U6", "U-Mf", "U-Sch"),
		createTestCase("Imply direction from station and line", "SUM-PA", "", "U2", "U2", "SUM-PA", "U-Rl"),
		createTestCase("Imply direction just from station", "U-Kr", "", "", "U3", "U-Kr", "SUM-WA"),
		// Test if station is not on the line
		createTestCase("Remove line if station is not on the line", "U-Kbo", "", "U2", "", "U-Kbo", ""),
		createTestCase("Remove line if not on station and reset if possible", "U-Kr", "", "U2", "U3", "U-Kr", "SUM-WA"),
		// Tests for correctDirection
		createTestCase("Set the last station as direction", "SUM-A", "S-Okz", "S7", "S7", "SUM-A", "SM-Ah"),
		createTestCase("Set first station as direction", "S-Okz", "SUM-A", "S7", "S7", "S-Okz", "S-PH"),
		createTestCase("Cross test with guessing station", "", "UM-NA", "U6", "U6", "SU-Ts", "U-Sch"),
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			runPostProcessTest(t, tc)
		})
	}
}
