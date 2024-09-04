package getStationDistance

import (
	"fmt"
	"math"
)

func toRadians(deg float64) float64 {
	return deg * math.Pi / 180
}

func calculateDistance(lat1, lon1, lat2, lon2 float64) float64 {

	const R = 6371 // Radius of the earth in km

	dLat := toRadians(lat2 - lat1)

	dLon := toRadians(lon2 - lon1)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRadians(lat1))*
			math.Cos(toRadians(lat2))*
			math.Sin(dLon/2)*
			math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	distance := R * c // Distance in km
	return distance
}

func getIndexOfStationID(stationId string, linesOfStation []string) (int, error) {

	for i, station := range linesOfStation {
		if station == stationId {
			return i, nil
		}
	}

	return -1, fmt.Errorf("station not found with the given ID: %v", stationId) // Return -1 if the stationID is not found in the array
}

func removeDuplicateAdjacentStations(elements []string) []string {

	visited := make(map[string]bool)
	uniqueElements := make([]string, 0)
	for _, element := range elements {
		if visited[element] {
			continue
		}
		visited[element] = true
		uniqueElements = append(uniqueElements, element)
	}
	return uniqueElements
}
