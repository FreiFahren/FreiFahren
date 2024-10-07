package data

import (
	_ "embed"
	"encoding/json"
	"sync"

	"github.com/FreiFahren/backend/logger"
	utils "github.com/FreiFahren/backend/utils"
)

//go:embed LinesList.json
var embeddedLinesList []byte

//go:embed StationsList.json
var embeddedStationsList []byte

var (
	linesList    map[string][]string
	stationsList map[string]utils.StationListEntry
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
