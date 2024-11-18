package end_to_end_tests

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/FreiFahren/backend/server"
	"github.com/stretchr/testify/assert"
)

func TestGetStationDistance(t *testing.T) {
	e := server.SetupServer()

	tests := []struct {
		name             string
		userStation      string
		inspectorStation string
		expectedStatus   int
		expectedDistance string
		expectedError    string
	}{
		{
			name:             "Regular Case",
			userStation:      "SUM-A",
			inspectorStation: "S-LiO",
			expectedStatus:   http.StatusOK,
			expectedDistance: "11",
			expectedError:    "",
		},
		{
			name:             "Station to itself",
			userStation:      "SUM-A",
			inspectorStation: "SUM-A",
			expectedStatus:   http.StatusOK,
			expectedDistance: "0",
			expectedError:    "",
		},
		{
			name:             "Invalid Station ID",
			userStation:      "INVALID",
			inspectorStation: "INVALIDs",
			expectedStatus:   http.StatusBadRequest,
			expectedDistance: "",
			expectedError:    "Invalid inspector station ID",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/transit/distance", nil)

			q := req.URL.Query()
			q.Add("inspectorStationId", tc.inspectorStation)
			q.Add("userStationId", tc.userStation)
			req.URL.RawQuery = q.Encode()

			// Create a ResponseRecorder to capture the response
			rec := httptest.NewRecorder()

			e.ServeHTTP(rec, req)

			assert.Equal(t, tc.expectedStatus, rec.Code)

			if tc.expectedStatus == http.StatusOK {
				assert.Equal(t, tc.expectedDistance, rec.Body.String())
			} else {
				assert.Equal(t, tc.expectedError, rec.Body.String())
			}
		})
	}
}
