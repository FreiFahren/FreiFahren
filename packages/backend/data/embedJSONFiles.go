package data

import (
	_ "embed"
	"encoding/json"
	"log"
	"sync"

	utils "github.com/FreiFahren/backend/utils"
)

//go:embed StationsAndLinesList.json
var embeddedStationsAndLinesList []byte

//go:embed LinesList.json
var embeddedLinesList []byte

//go:embed StationsList.json
var embeddedStationsList []byte

//go:embed duplicateSegments.json
var embeddedDuplicateSegments []byte

var (
	stationsAndLinesList utils.AllStationsAndLinesList
	linesList            map[string][]string
	stationsList         map[string]utils.StationListEntry
	DuplicateSegments    map[string][]string
	dataLock             sync.RWMutex
)

func EmbedJSONFiles() {
	var err error

	dataLock.Lock()
	defer dataLock.Unlock()

	stationsAndLinesList, err = ReadStationsAndLinesListFromBytes(embeddedStationsAndLinesList)
	if err != nil {
		log.Fatalf("(embedJSONFiles.Go) Error reading StationsAndLinesList: %v", err)
	}

	linesList, err = ReadLinesListFromBytes(embeddedLinesList)
	if err != nil {
		log.Fatalf("(embedJSONFiles.Go) Error reading LinesList: %v", err)
	}

	stationsList, err = ReadStationsListFromBytes(embeddedStationsList)
	if err != nil {
		log.Fatalf("(embedJSONFiles.Go) Error reading StationsList: %v", err)
	}

	err = json.Unmarshal(embeddedDuplicateSegments, &DuplicateSegments)
	if err != nil {
		log.Fatalf("(embedJSONFiles.Go) Error occurred during unmarshalling (duplicateSegments.json). %v", err)
	}

}

func GetDuplicateSegments() map[string][]string {
	dataLock.RLock()
	defer dataLock.RUnlock()

	return DuplicateSegments
}
func GetStationsAndLinesList() utils.AllStationsAndLinesList {
	dataLock.RLock()
	defer dataLock.RUnlock()

	return stationsAndLinesList
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

func ReadStationsAndLinesListFromBytes(byteValue []byte) (utils.AllStationsAndLinesList, error) {
	var AllStationsAndLinesList utils.AllStationsAndLinesList
	err := json.Unmarshal(byteValue, &AllStationsAndLinesList)
	if err != nil {
		return utils.AllStationsAndLinesList{}, err
	}

	return AllStationsAndLinesList, nil
}

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
