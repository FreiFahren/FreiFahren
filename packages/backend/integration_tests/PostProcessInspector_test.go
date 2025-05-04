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
		createTestCase("Imply line from direction", "", "U-n270165592", "", "U1", "U-n2097818462", "U-n270165592"),
		createTestCase("Imply line from station", "U-n29190890", "", "", "U8", "U-n29190890", ""),
		createTestCase("Imply line from station and direction", "U-n29190890", "SU-BWIN", "", "U8", "U-n29190890", "SU-BWIN"),
		createTestCase("Don't imply line if station and direction are missing", "", "", "", "", "", ""),
		createTestCase("Dont imply line if it is already set", "UM-n243996833", "SUM-n27412648", "U5", "U5", "UM-n243996833", "U-n52684988"),
		createTestCase("Don't imply line if there are multiple options", "U-n2097818462", "", "", "", "U-n2097818462", ""),
		// Tests for guessStation
		createTestCase("Don't guess the station when the line is not set", "", "SUM-n27412648", "", "", "", ""),
		createTestCase("Don't guess the station when the station is already set", "SUM-n30731497", "", "U2", "U2", "SUM-n30731497", ""),
		// Tests for DetermineDirectionIfImplied
		createTestCase("Imply direction and Line from station", "U-n3043920508", "", "", "U6", "U-n3043920508", "U-n29690313"),
		createTestCase("Imply direction from station and line", "SUM-n1340103507", "", "U2", "U2", "SUM-n1340103507", "U-n27586255"),
		createTestCase("Imply direction just from station", "U-n3872477457", "", "", "U3", "U-n3872477457", "SUM-n667971366"),
		// Test if station is not on the line
		createTestCase("Remove line if station is not on the line", "U-n2097818462", "", "U2", "", "U-n2097818462", ""),
		createTestCase("Remove line if not on station and reset if possible", "U-n3872477457", "", "U2", "U3", "U-n3872477457", "SUM-n667971366"),
		// Tests for correctDirection
		createTestCase("Set the last station as direction", "SUM-n30731497", "S-BOKS", "S7", "S7", "SUM-n30731497", "S-n1117011810"),
		createTestCase("Set first station as direction", "S-BOKS", "SUM-n30731497", "S7", "S7", "S-BOKS", "S-BPDH"),
		createTestCase("Cross test with guessing station", "", "UM-n2866993676", "U6", "U6", "SU-n29058343", "U-n29690313"),
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			runPostProcessTest(t, tc)
		})
	}
}
