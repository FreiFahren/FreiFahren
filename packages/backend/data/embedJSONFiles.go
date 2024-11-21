package data

import (
	"crypto/sha256"
	_ "embed"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/FreiFahren/backend/logger"
	utils "github.com/FreiFahren/backend/utils"
)

//go:embed LinesList.json
var embeddedLinesList []byte

//go:embed StationsList.json
var embeddedStationsList []byte

//go:embed segments.json
var embeddedSegments []byte

var (
	linesList    map[string][]string
	stationsList map[string]utils.StationListEntry
	segments     []byte
	segmentsETag string // Add ETag storage
	dataLock     sync.RWMutex
)

func EmbedJSONFiles() {
	var err error

	dataLock.Lock()
	defer dataLock.Unlock()

	linesList, err = ReadLinesListFromBytes(embeddedLinesList)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error reading LinesList")
	}

	stationsList, err = ReadStationsListFromBytes(embeddedStationsList)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error reading StationsList")
	}

	// Store segments and generate ETag
	segments = embeddedSegments
	// Generate ETag from content (using first 8 chars of SHA-256 is sufficient)
	hash := sha256.Sum256(segments)
	segmentsETag = fmt.Sprintf(`"%x"`, hash[:4])
}

func GetSegments() ([]byte, string) {
	dataLock.RLock()
	defer dataLock.RUnlock()

	return segments, segmentsETag
}

func GetLinesList() map[string][]string {
	dataLock.RLock()
	defer dataLock.RUnlock()

	return linesList
}

func GetStationsList() map[string]utils.StationListEntry {
	dataLock.RLock()
	defer dataLock.RUnlock()

	return stationsList
}

// Embedder functions to save the JSON files into the go binary

func ReadLinesListFromBytes(byteValue []byte) (map[string][]string, error) {
	var linesList map[string][]string
	err := json.Unmarshal(byteValue, &linesList)
	if err != nil {
		return map[string][]string{}, err
	}

	return linesList, nil
}

func ReadStationsListFromBytes(byteValue []byte) (map[string]utils.StationListEntry, error) {
	var linesList map[string]utils.StationListEntry
	err := json.Unmarshal(byteValue, &linesList)
	if err != nil {
		return map[string]utils.StationListEntry{}, err
	}

	return linesList, nil
}
