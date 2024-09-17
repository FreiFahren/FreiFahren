package end_to_end_tests

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/FreiFahren/backend/server"
	"github.com/stretchr/testify/assert"
)

func TestGetStationName(t *testing.T) {
	e := server.SetupServer()

	tests := []struct {
		name           string
		stationId    string
		expectedStatus int
		expectedName     string
	}{
		{
			name:           "Valid Station ID",
			stationId:      "SU-A",
			expectedStatus: http.StatusOK,
			expectedName:     "Alexanderplatz",
		},
		{
			name:           "Invalid Station ID",
			stationId:      "INVALID",
			expectedStatus: http.StatusNotFound,
			expectedName:     "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/data/station", nil)

			q := req.URL.Query()
			q.Add("id", tc.stationId)
			req.URL.RawQuery = q.Encode()

			// Create a ResponseRecorder to capture the response
			rec := httptest.NewRecorder()

			e.ServeHTTP(rec, req)

			assert.Equal(t, tc.expectedStatus, rec.Code)

			if tc.expectedStatus == http.StatusOK {
				assert.Equal(t, tc.expectedName, rec.Body.String())
			} else {
				assert.Equal(t, "", rec.Body.String())
			}
		})
	}
}