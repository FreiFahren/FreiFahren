package test_getStationDistance

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"

	"github.com/FreiFahren/backend/api/getStationDistance"
)

func TestGetStationDistance(t *testing.T) {
	tests := []struct {
		name               string
		inspectorStationId string
		userLat            string
		userLon            string
		expectedStatus     int
		expectedStops      int
	}{
		{
			name:               "Valid coordinates",
			inspectorStationId: "U-Ado",
			userLat:            "52.51188493793791",
			userLon:            "13.322164399678371",
			expectedStatus:     http.StatusOK,
			expectedStops:      4,
		},
		{
			name:               "Invalid coordinates",
			inspectorStationId: "sss",
			userLat:            "abc",
			userLon:            "def",
			expectedStatus:     http.StatusInternalServerError,
			expectedStops:      -1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a new Echo instance
			e := echo.New()

			// Create a new HTTP request
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			q := req.URL.Query()
			q.Add("inspectorStationId", tt.inspectorStationId)
			q.Add("userLat", tt.userLat)
			q.Add("userLon", tt.userLon)

			req.URL.RawQuery = q.Encode()

			// Create a new Echo context
			rec := httptest.NewRecorder()
			c := e.NewContext(req, rec)

			// Call the function and check the status code
			if assert.NoError(t, getStationDistance.GetStationDistance(c)) {
				assert.Equal(t, tt.expectedStatus, rec.Code)

				// Check the response body
				result := strings.TrimSpace(rec.Body.String())
				if rec.Code == http.StatusOK {
					stopsCount, err := strconv.Atoi(result)
					if err != nil {
						t.Fatalf("Error converting the response body to an integer: %v", err)
					}
					if tt.expectedStops == stopsCount {
						assert.Equal(t, tt.expectedStops, stopsCount)
					} else {
						t.Fatalf("Stops count: %v and expected count: %v \n", stopsCount, tt.expectedStops)
					}
				}
			}
		})
	}
}
