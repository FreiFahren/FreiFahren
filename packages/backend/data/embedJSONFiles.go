package data

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/FreiFahren/backend/logger"
	utils "github.com/FreiFahren/backend/utils"
)

//go:embed v*/*
var embeddedFS embed.FS

var (
	linesListMap    map[string]map[string][]string
	stationsListMap map[string]map[string]utils.StationListEntry
	stationsMapMap  map[string]map[string]string
	segmentsMap     map[string][]byte
	latestVersion   string
	dataLock        sync.RWMutex
)

// Init loads all embedded versioned data.
// It identifies available versions (directories starting with 'v'),
// determines the latest version based on numeric suffix, and loads
// the corresponding JSON files for each version.
func Init() {
	dataLock.Lock()
	defer dataLock.Unlock()

	linesListMap = make(map[string]map[string][]string)
	stationsListMap = make(map[string]map[string]utils.StationListEntry)
	stationsMapMap = make(map[string]map[string]string)
	segmentsMap = make(map[string][]byte)

	versions := []string{}
	maxVersionNum := -1

	entries, err := fs.ReadDir(embeddedFS, ".")
	if err != nil {
		logger.Log.Fatal().Err(err).Msg("Failed to read embedded directory")
	}

	for _, entry := range entries {
		if entry.IsDir() && strings.HasPrefix(entry.Name(), "v") {
			versionStr := entry.Name()
			versions = append(versions, versionStr)

			versionNumStr := strings.TrimPrefix(versionStr, "v")
			versionNum, err := strconv.Atoi(versionNumStr)
			if err == nil {
				if versionNum > maxVersionNum {
					maxVersionNum = versionNum
					latestVersion = versionStr
				}
			} else {
				logger.Log.Warn().Str("version", versionStr).Msg("Version directory does not have a valid numeric suffix, cannot determine latest version automatically")
			}
		}
	}

	if latestVersion == "" && len(versions) > 0 {
		// Fallback if numeric sorting failed: sort lexicographically and pick the last one
		sort.Strings(versions)
		latestVersion = versions[len(versions)-1]
		logger.Log.Warn().Str("latestVersion", latestVersion).Msg("Could not determine latest version numerically, falling back to lexicographical sorting")
	} else if len(versions) == 0 {
		logger.Log.Fatal().Msg("No versioned data found in embedded FS (expected directories like 'v0', 'v1')")
		return // Should not be reached due to Fatal, but good practice
	}

	logger.Log.Info().Str("latestVersion", latestVersion).Strs("foundVersions", versions).Msg("Determined latest data version")

	for _, version := range versions {
		loadVersionData(version)
	}
}

func loadVersionData(version string) {
	var err error

	// Load LinesList
	linesListBytes, err := embeddedFS.ReadFile(filepath.Join(version, "LinesList.json"))
	if err == nil {
		linesListMap[version], err = ReadLinesListFromBytes(linesListBytes)
		if err != nil {
			logger.Log.Error().Err(err).Str("version", version).Msg("Error reading LinesList")
		}
	} else {
		logger.Log.Error().Err(err).Str("version", version).Msg("Error reading LinesList file")
	}

	// Load StationsList
	stationsListBytes, err := embeddedFS.ReadFile(filepath.Join(version, "StationsList.json"))
	if err == nil {
		stationsListMap[version], err = ReadStationsListFromBytes(stationsListBytes)
		if err != nil {
			logger.Log.Error().Err(err).Str("version", version).Msg("Error reading StationsList")
		}
	} else {
		logger.Log.Error().Err(err).Str("version", version).Msg("Error reading StationsList file")
	}

	// Load segments
	segmentsBytes, err := embeddedFS.ReadFile(filepath.Join(version, "segments.json"))
	if err == nil {
		segmentsMap[version] = segmentsBytes
	} else {
		logger.Log.Error().Err(err).Str("version", version).Msg("Error reading segments file")
	}

	// Load StationsMap
	stationsMapBytes, err := embeddedFS.ReadFile(filepath.Join(version, "stationsMap.prod.json"))
	if err == nil {
		stationsMapMap[version], err = ReadStationsMapFromBytes(stationsMapBytes)
		if err != nil {
			logger.Log.Error().Err(err).Str("version", version).Msg("Error reading StationsMap")
		}
	} else {
		logger.Log.Error().Err(err).Str("version", version).Msg("Error reading StationsMap file")
	}

	logger.Log.Info().Str("version", version).Msg("Successfully loaded data")
}

func getTargetVersion(requestedVersion *string) string {
	if requestedVersion == nil || *requestedVersion == "" {
		return latestVersion
	}
	return *requestedVersion
}

func GetSegments(requestedVersion *string) []byte {
	dataLock.RLock()
	defer dataLock.RUnlock()

	targetVersion := getTargetVersion(requestedVersion)
	data, ok := segmentsMap[targetVersion]
	if !ok {
		logger.Log.Warn().Str("requestedVersion", targetVersion).Str("fallbackVersion", latestVersion).Msg("Requested segments version not found, falling back to latest")
		return segmentsMap[latestVersion] // Fallback to latest
	}
	return data
}

func GetLinesList(requestedVersion *string) map[string][]string {
	dataLock.RLock()
	defer dataLock.RUnlock()

	targetVersion := getTargetVersion(requestedVersion)
	data, ok := linesListMap[targetVersion]
	if !ok {
		logger.Log.Warn().Str("requestedVersion", targetVersion).Str("fallbackVersion", latestVersion).Msg("Requested lines list version not found, falling back to latest")
		return linesListMap[latestVersion] // Fallback to latest
	}
	return data
}

func GetStationsList(requestedVersion *string) map[string]utils.StationListEntry {
	dataLock.RLock()
	defer dataLock.RUnlock()

	targetVersion := getTargetVersion(requestedVersion)
	data, ok := stationsListMap[targetVersion]
	if !ok {
		logger.Log.Warn().Str("requestedVersion", targetVersion).Str("fallbackVersion", latestVersion).Msg("Requested stations list version not found, falling back to latest")
		return stationsListMap[latestVersion] // Fallback to latest
	}
	return data
}

func GetStationsMap(requestedVersion *string) map[string]string {
	dataLock.RLock()
	defer dataLock.RUnlock()

	targetVersion := getTargetVersion(requestedVersion)
	data, ok := stationsMapMap[targetVersion]
	if !ok {
		logger.Log.Warn().Str("requestedVersion", targetVersion).Str("fallbackVersion", latestVersion).Msg("Requested stations map version not found, falling back to latest")
		return stationsMapMap[latestVersion] // Fallback to latest
	}
	return data
}

func ReadLinesListFromBytes(byteValue []byte) (map[string][]string, error) {
	var linesList map[string][]string
	err := json.Unmarshal(byteValue, &linesList)
	if err != nil {
		// Return an empty map on error to avoid nil map issues upstream
		return make(map[string][]string), fmt.Errorf("failed to unmarshal LinesList: %w", err)
	}
	return linesList, nil
}

func ReadStationsListFromBytes(byteValue []byte) (map[string]utils.StationListEntry, error) {
	var stationsList map[string]utils.StationListEntry
	err := json.Unmarshal(byteValue, &stationsList)
	if err != nil {
		// Return an empty map on error
		return make(map[string]utils.StationListEntry), fmt.Errorf("failed to unmarshal StationsList: %w", err)
	}
	return stationsList, nil
}

func ReadStationsMapFromBytes(byteValue []byte) (map[string]string, error) {
	var stationsMap map[string]string
	err := json.Unmarshal(byteValue, &stationsMap)
	if err != nil {
		// Return an empty map on error
		return make(map[string]string), fmt.Errorf("failed to unmarshal StationsMap: %w", err)
	}
	return stationsMap, nil
}
