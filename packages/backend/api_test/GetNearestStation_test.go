package api_test

import (
	"testing"

	"github.com/FreiFahren/backend/api/getStationDistance"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/utils"
)

var stationsList map[string]utils.StationListEntry
var stationIDs []string
var linesList map[string][]string

func TestGetNearestStation(t *testing.T) {

	tests := []struct {
		name             string
		userLat          float64
		userLon          float64
		expectedStations []string
	}{
		{"Station id is Rotes Rathaus - valid", 52.5199883742242, 13.405401220045604, []string{"U-Ra"}},
		{"Station id is Schulzendorf - valid", 52.6139599, 13.2409545, []string{"S-SD"}},
		{"Station id is Schöneberg - valid", 52.47934532264665, 13.351945170423448, []string{"S-Sb"}},
		{"Station id is Strausberg Stadt - valid", 52.57669305295812, 13.88785499320312, []string{"S-SbS"}},
		{"Station id is Hauptbahnhof - valid", 52.52521428361473, 13.369363030781443, []string{"SU-HBF"}},
		{"Station id is Alt-Tegel - valid", 52.58947177087171, 13.283754942073784, []string{"U-ATg"}},
	}
	data.EmbedJSONFiles()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stationsList, stationIDs, linesList = getStationDistance.ReadAndCreateSortedStationsListAndLinesList()
			nearestStation := getStationDistance.GetNearestStationID(stationIDs, stationsList, tt.userLat, tt.userLon)
			if !contains(tt.expectedStations, nearestStation) {
				t.Errorf("GetNearestStation(%.13f, %.13f) = %s; expected one of %v", tt.userLat, tt.userLon, nearestStation, tt.expectedStations)

			}
		})
	}
}

func contains(s []string, str string) bool {
	for _, v := range s {
		if v == str {
			return true
		}
	}
	return false
}
