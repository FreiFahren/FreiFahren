package utils

import (
	"fmt"
	"math"
	"net/http"
	"strconv"

	echo "github.com/labstack/echo/v4"
)

func ToRadians(deg float64) float64 {
	return deg * math.Pi / 180
}

func CalculateDistance(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Radius of the earth in km

	dLat := ToRadians(lat2 - lat1)

	dLon := ToRadians(lon2 - lon1)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(ToRadians(lat1))*
			math.Cos(ToRadians(lat2))*
			math.Sin(dLon/2)*
			math.Sin(dLon/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	distance := R * c // Distance in km
	return distance
}

func GetIndexOfStationID(stationId string, linesOfStation []string) (int, error) {
	for i, station := range linesOfStation {
		if station == stationId {
			return i, nil
		}
	}

	return -1, fmt.Errorf("(dijkstraUtils.go) station not found with the given ID: %v", stationId) // Return -1 if the stationID is not found in the array
}

func ParseStringToFloat(str string) (float64, error) {
	val, err := strconv.ParseFloat(str, 64)
	if err != nil {
		return 0, fmt.Errorf("(dijkstraUtils.go) error parsing float: %v", err)
	}
	return val, nil
}

func HandleErrorEchoContext(c echo.Context, err error, message string) error {
	return c.JSON(http.StatusInternalServerError, fmt.Sprintf(message, err))
}

func RemoveDuplicateAdjacentStations(elements []string) []string {
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

func GetNearestStationID(stationIDs []string, stationsList map[string]StationListEntry, userLat, userLon float64) string {
	var nearestStation string
	var shortestDistance float64 = math.MaxFloat64

	for _, id := range stationIDs {
		station := stationsList[id]
		distance := CalculateDistance(userLat, userLon, station.Coordinates.Latitude, station.Coordinates.Longitude)
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
