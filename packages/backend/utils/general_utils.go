package utils

import (
	"strconv"

	"github.com/FreiFahren/backend/logger"
)

func StringInSlice(a string, list []string) bool {
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}

func ParseStringToFloat(str string) (float64, error) {
	val, err := strconv.ParseFloat(str, 64)
	if err != nil {
		logger.Log.Error().Msg("Error parsing string to float")
		return 0, err
	}
	return val, nil
}
