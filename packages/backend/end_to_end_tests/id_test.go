package end_to_end_tests

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/FreiFahren/backend/server"
	"github.com/stretchr/testify/assert"
)

func TestGetStationIdEndpoint(t *testing.T) {
	e := server.SetupServer()

	tests := []struct {
		name           string
		stationName    string
		expectedStatus int
		expectedID     string
	}{
		{
			name:           "Valid Station",
			stationName:    "Alexanderplatz",
			expectedStatus: http.StatusOK,
			expectedID:     "SU-A",
		},
		{
			name:           "Station Not Found",
			stationName:    "UnknownStation",
			expectedStatus: http.StatusNotFound,
			expectedID:     "",
		},
		{
			name:           "Case Insensitive",
			stationName:    "alexanderplatz",
			expectedStatus: http.StatusOK,
			expectedID:     "SU-A",
		},
		{
			name:           "Whitespace Insensitive",
			stationName:    "Alexander platz",
			expectedStatus: http.StatusOK,
			expectedID:     "SU-A",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/data/id", nil)

			q := req.URL.Query()
			q.Add("name", tc.stationName)
			req.URL.RawQuery = q.Encode()

			// Create a ResponseRecorder to capture the response
			rec := httptest.NewRecorder()

			e.ServeHTTP(rec, req)

			assert.Equal(t, tc.expectedStatus, rec.Code)

			if tc.expectedStatus == http.StatusOK {
				assert.Equal(t, tc.expectedID, rec.Body.String())
			} else {
				// Handle error response
				assert.Equal(t, "", rec.Body.String())
			}
		})
	}
}