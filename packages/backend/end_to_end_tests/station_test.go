package end_to_end_tests

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/FreiFahren/backend/server"
	"github.com/FreiFahren/backend/utils"
	"github.com/stretchr/testify/assert"
)

func TestGetStationName(t *testing.T) {
	e := server.SetupServer()

	tests := []struct {
		name           string
		stationId      string
		expectedStatus int
		expectedName   string
	}{
		{
			name:           "Valid Station ID",
			stationId:      "SUM-A",
			expectedStatus: http.StatusOK,
			expectedName:   "Alexanderplatz",
		},
		{
			name:           "Invalid Station ID",
			stationId:      "INVALID",
			expectedStatus: http.StatusNotFound,
			expectedName:   "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/stations/"+tc.stationId, nil)

			// Create a ResponseRecorder to capture the response
			rec := httptest.NewRecorder()

			e.ServeHTTP(rec, req)

			assert.Equal(t, tc.expectedStatus, rec.Code)

			if tc.expectedStatus == http.StatusOK {
				var station utils.StationListEntry
				err := json.Unmarshal(rec.Body.Bytes(), &station)
				assert.NoError(t, err)
				assert.Equal(t, tc.expectedName, station.Name)
			} else {
				assert.Contains(t, rec.Body.String(), "Station not found")
			}
		})
	}
}

func TestGetAllStations(t *testing.T) {
	e := server.SetupServer()

	req := httptest.NewRequest(http.MethodGet, "/stations", nil)
	rec := httptest.NewRecorder()

	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	var stations map[string]utils.StationListEntry
	err := json.Unmarshal(rec.Body.Bytes(), &stations)
	assert.NoError(t, err)

	// Check if we have at least one station
	assert.Greater(t, len(stations), 0)

	// Check if a known station exists (e.g., Alexanderplatz)
	alexanderplatz, exists := stations["SUM-A"]
	assert.True(t, exists)
	assert.Equal(t, "Alexanderplatz", alexanderplatz.Name)
}

func TestSearchStationByName(t *testing.T) {
	e := server.SetupServer()

	tests := []struct {
		name            string
		searchName      string
		expectedStatus  int
		expectedStation string
	}{
		{
			name:            "Valid Station Name",
			searchName:      "Alexanderplatz",
			expectedStatus:  http.StatusOK,
			expectedStation: "SUM-A",
		},
		{
			name:            "Valid Station Name with Whitespace",
			searchName:      "  Alexanderplatz  ",
			expectedStatus:  http.StatusOK,
			expectedStation: "SUM-A",
		},
		{
			name:            "Valid Station Name with Different Case",
			searchName:      "aLeXaNdErPlAtZ",
			expectedStatus:  http.StatusOK,
			expectedStation: "SUM-A",
		},
		{
			name:            "Invalid Station Name",
			searchName:      "NonexistentStation",
			expectedStatus:  http.StatusNotFound,
			expectedStation: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			url := fmt.Sprintf("/stations/search?name=%s", url.QueryEscape(tc.searchName))
			req := httptest.NewRequest(http.MethodGet, url, nil)
			rec := httptest.NewRecorder()

			e.ServeHTTP(rec, req)

			assert.Equal(t, tc.expectedStatus, rec.Code)

			if tc.expectedStatus == http.StatusOK {
				var result map[string]utils.StationListEntry
				err := json.Unmarshal(rec.Body.Bytes(), &result)
				assert.NoError(t, err)
				assert.Len(t, result, 1)

				for id, station := range result {
					assert.Equal(t, tc.expectedStation, id)
					assert.Equal(t, "Alexanderplatz", station.Name) // Always check for the correct name, regardless of input
				}
			} else {
				assert.Contains(t, rec.Body.String(), "Station not found")
			}
		})
	}
}
