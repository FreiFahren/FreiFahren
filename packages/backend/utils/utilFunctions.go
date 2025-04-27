package utils

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"time"
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
		return 0, err
	}
	return val, nil
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

// FindEnvFile searches for a .env file in the current directory and up to 9 parent directories.
//
// This function starts from the directory of the current file and traverses up the directory tree,
// looking for a .env file. It will search up to 10 levels (including the starting directory).
//
// Returns:
//   - string: The full path to the .env file if found.
//   - error: An error if the .env file is not found or if there's an issue accessing the file system.
//
// The function uses runtime.Caller to get the current file's path, then uses filepath operations
// to navigate the directory structure. It stops searching if it reaches the root directory or
// if it has searched 10 levels deep.
//
// If the .env file is not found after searching all levels, it returns os.ErrNotExist.

func FindEnvFile() (string, error) {
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		return "", errors.New("unable to get caller information")
	}

	dir := filepath.Dir(filename)

	for i := 0; i < 10; i++ {
		envPath := filepath.Join(dir, ".env")
		if _, err := os.Stat(envPath); err == nil {
			return envPath, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "", os.ErrNotExist
}

// GetTimeRange calculates the start and end time of a time range based on provided parameters or defaults.
//
// Parameters:
//   - start: The start time in RFC 3339 format (e.g., "2025-03-23T03:19:16Z"). If empty, defaults to now minus defaultTimeRange.
//   - end: The end time in RFC 3339 format (e.g., "2025-03-30T03:19:16Z"). If empty, defaults to current time.
//   - defaultTimeRange: The duration to use when start and end times are not provided (e.g., 168h for 7 days).
//
// Returns:
//   - time.Time: The calculated start time in UTC.
//   - time.Time: The calculated end time in UTC.
//
// This function first sets default values using the current time and the provided defaultTimeRange.
// If both start and end parameters are provided and can be parsed as RFC 3339 timestamps,
// it uses those values instead of the defaults. All times are handled in UTC.
func GetTimeRange(start, end string, defaultTimeRange time.Duration) (time.Time, time.Time) {
	now := time.Now().UTC()
	startTime := now.Add(-1 * defaultTimeRange)
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
