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
