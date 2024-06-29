package utils

import (
	"time"

	"github.com/FreiFahren/backend/logger"
)

// The threshold is calculated based on the current time of day and the day of the week.
// The threshold is at 7 between 9:00 to 18:00,
// linearly decreases to 1 between 18:00 to 21:00,
// stays at 1 between 21:00 to 7:00 and
// linearly increases to 7 between 7:00 to 9:00.
// On Saturdays the threshold decreases from 18:00 to 24:00.
// The threshold is reduced by 50% if it is a weekend.
func CalculateHistoricDataThreshold() int {
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

func GetKeysFromMap(m map[string]bool) []string {
	logger.Log.Debug().Msg("Getting keys from map")

	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
