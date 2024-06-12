package api_test

import (
	"testing"

	"github.com/FreiFahren/backend/api"
	"github.com/FreiFahren/backend/data"
)

func TestFindStationId(t *testing.T) {

	var stations = data.GetStationsList()

	tests := []struct {
		name          string
		stationName   string
		expectedID    string
		expectedFound bool
	}{
		{"Adenauer Platz exists", "Adenauer Platz", "U-Ado", true},
		{"Adlershof exists", "Adlershof", "S-Ad", true},
		{"Ahrensfelde exists", "Ahrensfelde", "S-Ah", true},
		{"Blankenfelde exists", "Blankenfelde", "S-Blf", true},
		{"Non-existent station", "Fake Station", "", false},
		{"Station inside another station", "Oranienburger Straße", "S-OrS", true},
		{"Empty string", "", "", false},
		{"Case insensitive", "aDeNauEr pLatz", "U-Ado", true},
		{"Whitespace insensitive", "AdenauerPlatz", "U-Ado", true},
		{"Whitespace and case insensitive", "aDeNauErPlatz", "U-Ado", true},
	}
	data.EmbedJSONFiles()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, found := api.FindStationId(tt.stationName, stations)
			if found != tt.expectedFound || id != tt.expectedID {
				t.Errorf("FindStationId(%s) = %v, %t; expected %v, %t", tt.stationName, id, found, tt.expectedID, tt.expectedFound)
			}
		})
	}
}
