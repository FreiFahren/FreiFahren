package inspectors

import (
	"fmt"
	"time"

	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/logger"
)

// GetTimeRange parses and validates the provided start and end times, falling back to default values if necessary.
//
// Parameters:
//   - start: The desired start time in RFC 3339 format. If invalid, defaults to one hour ago.
//   - end: The desired end time in RFC 3339 format. If invalid, defaults to the current time.
//
// Returns:
//   - A time.Time representing the validated start time.
//   - A time.Time representing the validated end time.
//
// This function ensures a valid time range is always returned, even if the input parameters are invalid or missing.
// It's useful for filtering data queries or setting boundaries for time-based operations.
func GetTimeRange(start, end string) (time.Time, time.Time) {
	logger.Log.Debug().Msg("Getting the time range of the ")

	now := time.Now().UTC()
	startTime, err := time.Parse(time.RFC3339, start)
	if err != nil {
		startTime = now.Add(-1 * time.Hour)
	}
	endTime, err := time.Parse(time.RFC3339, end)
	if err != nil {
		endTime = now
	}
	return startTime, endTime
}

// IdToCoordinates returns the latitude and longitude of a station given its ID
//
// Parameters:
// - id: The ID of the station to get the coordinates for
//
// Returns:
// - The latitude of the station
// - The longitude of the station
// - An error if the station ID is not found
//
// This function is using the data package to get the list of stations and then find the station with the given ID and return its coordinates.
func IdToCoordinates(id string) (float64, float64, error) {
	logger.Log.Debug().Msg("Getting station coordinates")

	var stations = data.GetStationsList()

	station, ok := stations[id]
	if !ok {
		return 0, 0, fmt.Errorf("station ID %s not found", id)
	}

	return station.Coordinates.Latitude, station.Coordinates.Longitude, nil
}
