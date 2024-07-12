package data

import (
	_ "embed"
	"encoding/json"
	"sync"

	"github.com/FreiFahren/backend/logger"
	utils "github.com/FreiFahren/backend/utils"
)

//go:embed StationsAndLinesList.json
var embeddedStationsAndLinesList []byte

//go:embed LinesList.json
var embeddedLinesList []byte

//go:embed StationsList.json
var embeddedStationsList []byte

var (
	stationsAndLinesList utils.AllStationsAndLinesList
	linesList            map[string][]string
	stationsList         map[string]utils.StationListEntry
	dataLock             sync.RWMutex
)

func EmbedJSONFiles() {
	logger.Log.Debug().Msg("Embedding JSON files")

	var err error

	dataLock.Lock()
	defer dataLock.Unlock()

	stationsAndLinesList, err = ReadStationsAndLinesListFromBytes(embeddedStationsAndLinesList)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error reading StationsAndLinesList")
	}

	linesList, err = ReadLinesListFromBytes(embeddedLinesList)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error reading LinesList")
	}

	stationsList, err = ReadStationsListFromBytes(embeddedStationsList)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error reading StationsList")
	}
}

func GetStationsAndLinesList() utils.AllStationsAndLinesList {
	logger.Log.Debug().Msg("Getting stations and lines list")

	dataLock.RLock()
	defer dataLock.RUnlock()

	return stationsAndLinesList
}

func GetLinesList() map[string][]string {
	logger.Log.Debug().Msg("Getting lines list")

	dataLock.RLock()
	defer dataLock.RUnlock()

	return linesList
}

func GetStationsList() map[string]utils.StationListEntry {
	logger.Log.Debug().Msg("Getting stations list")

	dataLock.RLock()
	defer dataLock.RUnlock()

	return stationsList
}

// Embedder functions to save the JSON files into the go binary

func ReadStationsAndLinesListFromBytes(byteValue []byte) (utils.AllStationsAndLinesList, error) {
	logger.Log.Debug().Msg("Reading stations and lines list from bytes")

	var AllStationsAndLinesList utils.AllStationsAndLinesList
	err := json.Unmarshal(byteValue, &AllStationsAndLinesList)
	if err != nil {
		return utils.AllStationsAndLinesList{}, err
	}

	return AllStationsAndLinesList, nil
}

func ReadLinesListFromBytes(byteValue []byte) (map[string][]string, error) {
	logger.Log.Debug().Msg("Reading lines list from bytes")

	var linesList map[string][]string
	err := json.Unmarshal(byteValue, &linesList)
	if err != nil {
		return map[string][]string{}, err
	}

	return linesList, nil
}

func ReadStationsListFromBytes(byteValue []byte) (map[string]utils.StationListEntry, error) {
	logger.Log.Debug().Msg("Reading stations list from bytes")

	var linesList map[string]utils.StationListEntry
	err := json.Unmarshal(byteValue, &linesList)
	if err != nil {
		return map[string]utils.StationListEntry{}, err
	}

	return linesList, nil
}
