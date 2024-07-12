package utils

import (
	"time"

	"github.com/FreiFahren/backend/logger"
)

// CheckIfModifiedSince determines if data should be re-fetched based on the If-Modified-Since header.
//
// Parameters:
// - ifModifiedSince: A string in RFC 3339 format representing the client's last received response time.
// - lastModified: The actual last modification time of the data.
//
// Returns:
//   - A boolean indicating whether the data was modified after the time specified in ifModifiedSince.
//     It returns true if the data is newer or if the header is empty or incorrectly formatted, suggesting a refetch.
//   - An error if there was a problem parsing the ifModifiedSince value.
//
// Use this function to decide whether to return updated data or a 304 Not Modified response.
func CheckIfModifiedSince(ifModifiedSince string, lastModified time.Time) (bool, error) {
	logger.Log.Debug().Msg("Checking If-Modified-Since header")

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
