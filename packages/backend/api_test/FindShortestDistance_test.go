package api_test

import (
	"fmt"
	"os"
	"reflect"
	"testing"

	"github.com/FreiFahren/backend/api/getStationDistance"
	"github.com/FreiFahren/backend/data"
)

func TestFindShortestDistance(t *testing.T) {
	os.Chdir("..")
	tests := []struct {
		name           string
		startStation   string
		userLat        float64
		userLon        float64
		expectedLength int
	}{
		{"Station path should be 8 from Ernst Reuter Platz to Platz der Luftbrücke", "U-RP", 52.486085692405766, 13.385951152366573, 8},
		{"S7 Ahrensfelde to Potsdam Hauptbahnof", "S-Ah", 52.391795350910854, 13.06723080362724, 28},
	}
	data.EmbedJSONFiles()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			distances := getStationDistance.FindShortestDistance(tt.startStation, tt.userLat, tt.userLon)
			fmt.Printf("Distances: %v\n", distances)
			if !reflect.DeepEqual(distances, tt.expectedLength) {
				t.Errorf("FindShortestPath(%s, %f, %f) = %v; expected %v", tt.startStation, tt.userLat, tt.userLon, distances, tt.expectedLength)
			}
		})
	}
}
