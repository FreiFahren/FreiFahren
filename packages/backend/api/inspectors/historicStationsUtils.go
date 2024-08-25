package inspectors

import (
	"math/rand"
	"time"

	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
)

// The threshold is calculated based on the current time of day and the day of the week.
// The threshold is at 7 between 9:00 to 18:00,
// linearly decreases to 1 between 18:00 to 21:00,
// stays at 1 between 21:00 to 7:00 and
// linearly increases to 7 between 7:00 to 9:00.
// On Saturdays the threshold decreases from 18:00 to 24:00.
// The threshold is reduced by 50% if it is a weekend.
func calculateHistoricDataThreshold() int {
	logger.Log.Debug().Msg("Calculating historic data threshold")

	currentTime := time.Now().UTC()
	hour := currentTime.Hour()
	minute := currentTime.Minute()

	// only weekend bonus at night
	BaseThreshold := GetBaseThreshold(hour, minute, currentTime)
	threshold := BaseThreshold - calculateWeekendAdjustment(currentTime, int(BaseThreshold))

	// Avoid extrem thresholds
	if threshold < 1 {
		threshold = 1
	} else if threshold > 7 {
		threshold = 7
	}

	return int(threshold)
}

func GetBaseThreshold(hour, minute int, currentTime time.Time) float64 {
	logger.Log.Debug().Msg("Getting base threshold")

	totalMinutesPastMidnight := float64(hour*60 + minute)
	var threshold float64

	switch {
	case totalMinutesPastMidnight >= (18*60) && (currentTime.Weekday() == time.Saturday && totalMinutesPastMidnight < (24*60)):
		// On Saturdays, decrease linearly from 18:00 to 24:00
		threshold = 7 - ((totalMinutesPastMidnight - (18 * 60)) * (9.0 / (6 * 60)))
	case totalMinutesPastMidnight >= (18*60) && totalMinutesPastMidnight < (21*60):
		// On other days, decrease linearly from 18:00 to 21:00
		threshold = 7 - ((totalMinutesPastMidnight - (18 * 60)) * (9.0 / (3 * 60)))
	case totalMinutesPastMidnight >= (21*60) || totalMinutesPastMidnight < (7*60):
		// Stay at 1 between 21:00 to 7:00
		threshold = 1
	case totalMinutesPastMidnight >= (7*60) && totalMinutesPastMidnight < (9*60):
		// Increase linearly from 7:00 to 9:00
		threshold = 1 + ((totalMinutesPastMidnight - (7 * 60)) * (9.0 / (2 * 60)))
	default:
		threshold = 7
	}

	return threshold
}

// Reduce the threshold by 50% if it is a weekend
func calculateWeekendAdjustment(currentTime time.Time, threshold int) float64 {
	logger.Log.Debug().Msg("Calculating weekend adjustment")

	weekday := currentTime.Weekday()
	if weekday == time.Sunday || weekday == time.Saturday {
		return float64(threshold) * 0.5
	}
	return 0.0
}

// FetchAndAddHistoricData fetches and adds historic data to the list of ticket inspectors.
//
// parameters:
//	ticketInfoList: the list of ticket inspectors
//	remaining: the number of historic data to fetch
//	startTime: the time to start fetching historic data from
//
// returns:
//	the list of ticket inspectors with the historic data added
//	an error if one occurred
func FetchAndAddHistoricData(ticketInfoList []utils.TicketInspector, remaining int, startTime time.Time) ([]utils.TicketInspector, error) {
	logger.Log.Debug().Msg("Fetching and adding historic data")

	currentStationIDs := make(map[string]bool)
	for _, ticketInfo := range ticketInfoList {
		currentStationIDs[ticketInfo.StationID] = true
	}

	excludedStationIDs := utils.GetKeysFromMap(currentStationIDs)
	historicDataList, err := database.GetHistoricStations(startTime, remaining, 24, excludedStationIDs)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting historic stations")
		return nil, err
	}

	// Add the historic data to the list
	ticketInfoList = append(ticketInfoList, historicDataList...)

	return ticketInfoList, nil
}

// calculateHistoricDataTimestamp calculates a random timestamp in the first 25th percentile of the start and end time.
// So if the start and end time are 1 hour apart, the timestamp will be a random number in first 15 minutes of the start time.
//
// parameters:
//	startTime: the start time
// 	endTime: the end time
//
// returns:
// 	the calculated timestamp
//
// This is being done to make sure that users will disregard the historic data and deem it as irrelevant.
func calculateHistoricDataTimestamp(startTime time.Time, endTime time.Time) time.Time {
	duration := endTime.Sub(startTime)
	percentile25 := duration / 4
	randomDuration := time.Duration(rand.Int63n(int64(percentile25)))
	randomTimestamp := startTime.Add(randomDuration)
	logger.Log.Debug().Msgf("Calculated timestamp: %s, for start time: %s and end time: %s", randomTimestamp, startTime, endTime)

	return randomTimestamp
}
