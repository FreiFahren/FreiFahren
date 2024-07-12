package api_test

import (
	"fmt"
	"math"
	"os"
	"testing"

	"github.com/FreiFahren/backend/api/getRecentTicketInspectorInfo"
	"github.com/FreiFahren/backend/data"
)

func TestIdToCoordinates(t *testing.T) {

	tests := []struct {
		id       string
		expected [2]float64 // Latitude, Longitude
	}{
		{"U-Ado", [2]float64{52.50000451375408, 13.307319652383967}},
		{"S-Ad", [2]float64{52.434737049866555, 13.54158320841833}},
		{"S-Ba", [2]float64{52.39140543155065, 13.092963330483428}},
		{"U-Kt", [2]float64{52.490355022084486, 13.360240294020343}},
		{"S-OrS", [2]float64{52.52522273354742, 13.393012961994373}},
		{"U-Scha", [2]float64{52.56681371702058, 13.312624807176945}},
	}
	data.EmbedJSONFiles()

	for _, tt := range tests {
		t.Run(tt.id, func(t *testing.T) {
			latitude, longitude, err := getRecentTicketInspectorInfo.IdToCoordinates(tt.id)
			if err != nil {

				dir, err := os.Getwd()
				if err != nil {
					fmt.Println("Error getting current directory:", err)
					return
				}

				t.Fatalf("IdToCoordinates(%s) returned an error: %v %s", tt.id, err, dir)
			}
			if math.Abs(latitude-tt.expected[0]) > 0.000001 || math.Abs(longitude-tt.expected[1]) > 0.000001 {
				t.Errorf("IdToCoordinates(%s) = %v, %v; expected %v, %v", tt.id, latitude, longitude, tt.expected[0], tt.expected[1])
			}
		})
	}
}
