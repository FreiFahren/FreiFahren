package test_inspectors

import (
	"math"
	"testing"
	"time"

	"github.com/FreiFahren/backend/api/inspectors"
)

func TestBaseThreshold(t *testing.T) {
	const layout = "2006-01-02 15:04:05"
	testCases := []struct {
		dateTime string
		expected float64
	}{
		{"2023-05-10 18:00:00", 7},   // Wednesday, start of decreasing period
		{"2023-05-10 19:30:00", 2.5}, // Wednesday, midway through decreasing period
		{"2023-05-10 21:00:00", 1},   // Wednesday, start of lowest threshold
		{"2023-05-11 02:30:00", 1},   // Thursday, still in lowest threshold
		{"2023-05-11 07:00:00", 1},   // Thursday, start of increasing period
		{"2023-05-11 08:00:00", 5.5}, // Thursday, midway through increasing period
		{"2023-05-11 09:00:00", 7},   // Thursday, end of increasing period, threshold stays at 7 beyond this
		{"2023-05-11 15:00:00", 7},   // Thursday daytime, threshold at 7
		{"2023-05-13 18:00:00", 7},   // Saturday, start of special decreasing period
		{"2023-05-13 21:00:00", 2.5}, // Saturday, special decreasing period, not yet at lowest
	}

	for _, tc := range testCases {
		t.Run(tc.dateTime, func(t *testing.T) {
			currentTime, _ := time.Parse(layout, tc.dateTime)
			result := inspectors.GetBaseThreshold(currentTime.Hour(), currentTime.Minute(), currentTime)
			roundedResult := math.Round(result*100) / 100
			if roundedResult != tc.expected {
				t.Errorf("BaseThreshold(%s) = %v; want %v", tc.dateTime, roundedResult, tc.expected)
			}
		})
	}
}
