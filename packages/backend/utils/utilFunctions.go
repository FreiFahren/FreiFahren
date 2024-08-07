package utils

import (
	"strconv"
	"time"

	"github.com/FreiFahren/backend/logger"
)

// StringInSlice checks if a string is present in a slice of strings.
//
// Parameters:
//   - a: The string to search for.
//   - list: The slice of strings to search within.
//
// Returns:
//   - A boolean indicating whether the string 'a' is found within the 'list'.
//
// This function iterates through each element in the provided slice and compares it with the target string 'a'.
// If a match is found, it returns true. Otherwise, it returns false after checking all elements in the slice.
func StringInSlice(a string, list []string) bool {
	// log the incomming values
	logger.Log.Debug().Msgf("StringInSlice: a: %s, list: %v", a, list)
	for _, b := range list {
		if b == a {
			return true
		}
	}
	return false
}

// ParseStringToInt converts a string to an integer.
//
// Parameters:
//   - str: The string to convert.
//
// Returns:
//   - The integer value of the string.
//   - An error if the string cannot be converted to an integer.
//
// This function uses the strconv.Atoi function to convert the string to an integer.
func ParseStringToFloat(str string) (float64, error) {
	val, err := strconv.ParseFloat(str, 64)
	if err != nil {
		logger.Log.Error().Msg("Error parsing string to float")
		return 0, err
	}
	return val, nil
}

// CheckIfModifiedSince determines if data should be re-fetched based on the If-Modified-Since header.
//
// Parameters:
//   - ifModifiedSince: A string in RFC 3339 format representing the client's last received response time.
//   - lastModified: The actual last modification time of the data.
//
// Returns:
//   - A boolean indicating whether the data was modified after the time specified in ifModifiedSince.
//     It returns true if the data is newer or if the header is empty or incorrectly formatted, suggesting a refetch.
//   - An error if there was a problem parsing the ifModifiedSince value.
//
// Use this function to decide whether to return updated data or a 304 Not Modified response.
func CheckIfModifiedSince(ifModifiedSince string, lastModified time.Time) (bool, error) {
	// If the header is empty, proceed with fetching the data
	if ifModifiedSince == "" {
		return true, nil
	}

	// Use time.RFC1123 to parse HTTP date format
	requestedModificationTime, err := time.Parse(time.RFC1123, ifModifiedSince)
	if err != nil {
		logger.Log.Error().Msg("Error parsing If-Modified-Since header")
		return true, err
	}

	// If the data has not been modified since the provided time, return false
	if !lastModified.After(requestedModificationTime) {
		return false, nil
	} else {
		return true, nil
	}
}

// GetKeysFromMap returns the keys of a map as a slice of strings.
//
// Parameters:
//   - m: The map from which to extract the keys.
//
// Returns:
//   - A slice of strings containing the keys of the map.
//
// This function iterates over the keys of the provided map and appends them to a slice of strings.
func GetKeysFromMap(m map[string]bool) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}
