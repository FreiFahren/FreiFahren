package getStationDistance

import (
	"fmt"
	"math"

	"github.com/FreiFahren/backend/logger"
	utils "github.com/FreiFahren/backend/utils"
)

func toRadians(deg float64) float64 {
	return deg * math.Pi / 180
}

func calculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	logger.Log.Debug().Msg("Calculating distance")

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
	logger.Log.Debug().Msg("Getting index of station ID")

	for i, station := range linesOfStation {
		if station == stationId {
			return i, nil
		}
	}

	return -1, fmt.Errorf("station not found with the given ID: %v", stationId) // Return -1 if the stationID is not found in the array
}

func removeDuplicateAdjacentStations(elements []string) []string {
	logger.Log.Debug().Msg("Removing duplicate adjacent stations")

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

func GetNearestStationID(stationIDs []string, stationsList map[string]utils.StationListEntry, userLat, userLon float64) string {
	logger.Log.Debug().Msg("Getting nearest station ID")

	var nearestStation string
	var shortestDistance float64 = math.MaxFloat64

	for _, id := range stationIDs {
		station := stationsList[id]
		distance := calculateDistance(userLat, userLon, station.Coordinates.Latitude, station.Coordinates.Longitude)
		if distance <= 0.010 {
			return id // If the user is around 10m at the station, we can return it immediately
		}
		if distance < shortestDistance || (distance == shortestDistance && id < nearestStation) {
			shortestDistance = distance
			nearestStation = id
		}

	}

	return nearestStation
}
