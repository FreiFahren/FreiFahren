package inspectors

import (
	"fmt"
	"time"

	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/logger"
)

// GetTimeRange returns the start and end time of the time range
//
// Parameters:
//   - start: The start time of the time range in RFC 3339 format.
//   - end: The end time of the time range in RFC 3339 format.
//
// Returns:
//   - The start time of the time range in RFC 3339 format.
//   - The end time of the time range in RFC 3339 format.
//
// This function is being used to get the start and end time of the time range.
func GetTimeRange(start, end string) (time.Time, time.Time) {
	logger.Log.Debug().Msg("Getting the time range")

	now := time.Now().UTC()
	startTime := now.Add(-1 * time.Hour)
	endTime := now

	if start != "" && end != "" {
		parsedStart, err := time.Parse(time.RFC3339, start)
		if err == nil {
			startTime = parsedStart
		}

		parsedEnd, err := time.Parse(time.RFC3339, end)
		if err == nil {
			endTime = parsedEnd
		}
	}

	return startTime, endTime
}

// IdToCoordinates returns the latitude and longitude of a station given its Id
//
// Parameters:
// - id: The Id of the station to get the coordinates for
//
// Returns:
// - The latitude of the station
// - The longitude of the station
// - An error if the station Id is not found
//
// This function is using the data package to get the list of stations and then find the station with the given Id and return its coordinates.
func IdToCoordinates(id string) (float64, float64, error) {
	logger.Log.Debug().Msg("Getting station coordinates")

	var stations = data.GetStationsList()

	station, ok := stations[id]
	if !ok {
		return 0, 0, fmt.Errorf("station Id %s not found", id)
	}

	return station.Coordinates.Latitude, station.Coordinates.Longitude, nil
}