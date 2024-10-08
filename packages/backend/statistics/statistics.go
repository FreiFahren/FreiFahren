package statistics

import (
	"time"

	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
)

type Statistics struct {
	NumberOfReports int `json:"numberOfReports"`
}

func GetStatistics(stationId, lineId string, startTime, endTime time.Time) (Statistics, error) {
	numberOfReports, err := database.GetNumberOfReports(stationId, lineId, startTime, endTime)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get number of reports")
		return Statistics{}, err
	}
	return Statistics{NumberOfReports: numberOfReports}, nil
}
