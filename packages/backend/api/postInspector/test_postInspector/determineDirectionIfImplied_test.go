package test_postInspector

import (
	"testing"

	"github.com/FreiFahren/backend/api/postInspector"
	"github.com/FreiFahren/backend/utils"
	"github.com/stretchr/testify/assert"
)

func TestDetermineDirectionIfImplied(t *testing.T) {
	// Mock data
	stations := map[string]utils.Station{
		"SU-WA": {
			ID:   "SU-WA",
			Name: "Warschauer Straße",
			Lines: []string{
				"U1", "U3", "S3", "S5", "S7", "S9", "S75",
			},
		},
		"U-Kr": {
			ID:    "U-Kr",
			Name:  "Krumme Lanke",
			Lines: []string{"U3"},
		},
		"U-HaT": {
			ID:    "U-HaT",
			Name:  "Hallesches Tor",
			Lines: []string{"U1", "U3", "U6"},
		},
	}

	u3Line := []string{
		"SU-WA", "U-S", "U-Gr", "U-Kbo", "U-Pr", "U-HaT", "U-Mo", "U-Go", "U-Kus",
		"U-Nm", "U-Wt", "U-Au", "U-Sno", "U-Hz", "U-Fpo", "SU-Hb", "U-RUE", "U-Bt",
		"U-Po", "U-DD", "U-T", "U-Os", "U-Ot", "U-Kr",
	}

	tests := []struct {
		name           string
		dataToInsert   *utils.ResponseData
		pointers       *utils.InsertPointers
		line           []string
		stationID      string
		expectedResult utils.Station
	}{
		{
			name: "Station at the end of the line that is not unique to one line",
			dataToInsert: &utils.ResponseData{
				Line:    "U3",
				Station: stations["SU-WA"],
			},
			pointers:       &utils.InsertPointers{},
			line:           u3Line,
			stationID:      "SU-WA",
			expectedResult: utils.Station{}, // Direction should not be set
		},
		{
			name: "Station in the middle of a line where nothing can be implied",
			dataToInsert: &utils.ResponseData{
				Line:    "U3",
				Station: stations["U-HaT"],
			},
			pointers:       &utils.InsertPointers{},
			line:           u3Line,
			stationID:      "U-HaT",
			expectedResult: utils.Station{}, // Direction should not be set
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := postInspector.DetermineDirectionIfImplied(tt.dataToInsert, tt.pointers, tt.line, tt.stationID)
			assert.NoError(t, err)
			assert.Equal(t, tt.expectedResult, tt.dataToInsert.Direction)
		})
	}
}
