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

func TestPostProcessInspectorData(t *testing.T) {
	// set up for testing
	godotenv.Overload()
	data.EmbedJSONFiles()
	database.CreatePool()

	t.Run("Imply line from direction", func(t *testing.T) {
		// Arrange
		dataToInsert := &structs.ResponseData{
			Timestamp: time.Now(),
			Direction: structs.Station{ID: "U-U", Name: "Uhlandstraße"},
			Station:   structs.Station{ID: ""},
			Line:      "",
		}
		pointers := &structs.InsertPointers{
			DirectionIDPtr:   &dataToInsert.Direction.ID,
			DirectionNamePtr: &dataToInsert.Direction.Name,
			StationIDPtr:     &dataToInsert.Station.ID,
			LinePtr:          &dataToInsert.Line,
		}

		// Act
		err := inspectors.PostProcessInspectorData(dataToInsert, pointers)

		// Assert
		assert.NoError(t, err)
		assert.Equal(t, "U1", dataToInsert.Line, "Line should be U1")
		assert.NotNil(t, pointers.LinePtr, "LinePtr should not be nil")
		if pointers.LinePtr != nil {
			assert.Equal(t, "U1", *pointers.LinePtr, "LinePtr should point to U1")
		}
	})
}