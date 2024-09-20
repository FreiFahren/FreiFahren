package distance

import (
	"container/list"
	"fmt"
	"math"
	"net/http"
	"sort"

	"github.com/FreiFahren/backend/data"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/logger"
	utils "github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

type StationNode struct {
	id       string
	distance int
	line     string
}

var stationsList map[string]utils.StationListEntry
var stationIds []string
var linesList map[string][]string

// @Summary Calculate shortest distance to a station
//
// @Description Returns the shortest number of stations between an inspector's station and a given user's latitude and longitude coordinates.
// @Description The distance calculation employs Dijkstra's algorithm to determine the minimal stops required to reach the nearest station from the given coordinates.
//
// @Tags transit
//
// @Accept  json
// @Produce  json
//
// @Param   inspectorStationId   query   string  true   "The station Id of the inspector's current location."
// @Param   userStationId   query   string  true   "The station Id of the user's current location."
//
// @Success 200 {int} int "The shortest distance in terms of the number of station stops between the inspector's station and the user's location."
// @Failure 500 "An error occurred in processing the request."
//
// @Router /transit/distance [get]
func GetStationDistance(c echo.Context) error {
	logger.Log.Info().Msg("GET /transit/distance")

	inspectorStationId := c.QueryParam("inspectorStationId")
	userStationId := c.QueryParam("userStationId")
	if userStationId == inspectorStationId {
		return c.String(http.StatusOK, "0")
	}

	stationsList, stationIds, linesList = ReadAndCreateSortedStationsListAndLinesList()

	inspectorStation, ok := stationsList[inspectorStationId]
	if !ok {
		logger.Log.Error().Str("inspectorStationId", inspectorStationId).Msg("Inspector station not found in stations list")
		return c.String(http.StatusBadRequest, "Invalid inspector station ID")
	}

	userStation, ok := stationsList[userStationId]
	if !ok {
		logger.Log.Error().Str("userStationId", userStationId).Msg("User station not found in stations list")
		return c.String(http.StatusBadRequest, "Invalid user station ID")
	}

	inspectorStationCoordinates := inspectorStation.Coordinates
	userStationCoordinates := userStation.Coordinates
	kmDistance := calculateDistance(inspectorStationCoordinates.Latitude, inspectorStationCoordinates.Longitude, userStationCoordinates.Latitude, userStationCoordinates.Longitude)

	// If the user is less than 1 km away from the station, we just return 1 station distance
	if kmDistance < 1 {
		return c.String(http.StatusOK, "1")
	}

	distances := FindShortestDistance(inspectorStationId, userStationId)

	return c.String(http.StatusOK, fmt.Sprintf("%d", distances))
}

func ReadAndCreateSortedStationsListAndLinesList() (map[string]utils.StationListEntry, []string, map[string][]string) {
	logger.Log.Debug().Msg("Reading and creating sorted stations list and lines list")

	stationsList = data.GetStationsList()

	// Create a slice of the station Ids
	stationIds = make([]string, 0, len(stationsList))
	for id := range stationsList {
		stationIds = append(stationIds, id)
	}

	// Sort the slice of station ds, to get a more deterministic result
	// because the order of the keys in a map is not guaranteed and golang kinda fucks up
	sort.Strings(stationIds)

	linesList = data.GetLinesList()

	return stationsList, stationIds, linesList
}

// ---- dijkstra

func GetAdjacentStationsId(stationId string) []string {

	stationLines := stationsList[stationId].Lines

	adjacentStations := make([]string, 0)

	// Get the adjacent stations for each line the station is on
	for _, line := range stationLines {
		currentStationId, err := getIndexOfStationId(stationId, linesList[line])

		if currentStationId == -1 && err != nil {
			logger.Log.Error().Err(err).Msg("Error getting the station Id")
		}

		// get the adjacent stations one station before and one station after the current station
		if currentStationId > 0 {
			adjacentStations = append(adjacentStations, linesList[line][currentStationId-1])
		}

		if currentStationId < len(linesList[line])-1 {
			adjacentStations = append(adjacentStations, linesList[line][currentStationId+1])
		}
	}

	// Remove duplicates
	adjacentStations = removeDuplicateAdjacentStations(adjacentStations)

	return adjacentStations
}

func initializeQueue(startStation string) (*list.List, map[string]int, map[string]string) {
	logger.Log.Debug().Msg("Initializing queue")

	queue := list.New()
	distances := make(map[string]int)
	lines := make(map[string]string)

	// Initialize the distances and lines
	for _, id := range stationIds {
		station := stationsList[id]
		// if the station is the starting station, we set the distance to 0, and the line to the first line the station is on
		// otherwise, we set the distance to infinity for the rest of the stations
		if id == startStation {
			distances[id] = 0
			lines[id] = station.Lines[0]
		} else {
			distances[id] = math.MaxInt32
		}
		// when first beginning the for loop, the station.Lines list is empty, only until id == startStation (the starting node in the graph)
		if len(station.Lines) > 0 {
			queue.PushBack(StationNode{id, distances[id], station.Lines[0]})
		}
	}
	return queue, distances, lines
}

func findSmallestDistanceStation(queue *list.List) StationNode {

	var currentStation StationNode
	for firstQueueElement := queue.Front(); firstQueueElement != nil; firstQueueElement = firstQueueElement.Next() {
		station := firstQueueElement.Value.(StationNode)
		if currentStation.id == "" || station.distance < currentStation.distance {
			currentStation = station
		}
	}
	return currentStation
}

func removeStationFromQueue(queue *list.List, stationId string) {

	// here we remove the station from the queue,
	// but we don't need to remove any duplicate stations, as space complexity may come down but time complexity exponentially highly increase
	// also dijkstra works fine with duplicate stations in the queue because it will always choose the station with the smallest distance
	for firstQueueElement := queue.Front(); firstQueueElement != nil; firstQueueElement = firstQueueElement.Next() {
		if firstQueueElement.Value.(StationNode).id == stationId {
			queue.Remove(firstQueueElement)
			break
		}
	}
}

func updateDistances(queue *list.List, currentStation StationNode, distances map[string]int, lines map[string]string) {

	for _, adjacentStationId := range GetAdjacentStationsId(currentStation.id) {
		// each distance from one station to another is 1
		newDistance := currentStation.distance + 1

		if newDistance < distances[adjacentStationId] {

			distances[adjacentStationId] = newDistance
			lines[adjacentStationId] = stationsList[adjacentStationId].Lines[0]
			queue.PushBack(StationNode{adjacentStationId, newDistance, stationsList[adjacentStationId].Lines[0]})
		}
	}
}

func FindShortestDistance(startStation string, userStationId string) int {
	logger.Log.Debug().Msg("Finding the shortest distance")

	ReadAndCreateSortedStationsListAndLinesList()

	endStation := userStationId

	// Initialize the queue, distances, lines and a map to keep track of visited stations
	visited := make(map[string]bool)
	queue, distances, lines := initializeQueue(startStation)

	for queue.Len() > 0 {
		// Find the station in the queue with the smallest distance
		var currentStation = findSmallestDistanceStation(queue)

		// If the smallest distance is infinity or the integer had an overflow , we've reached the end of the list
		// and there are no possibilites to reach the end station
		// actually nearly impossible that we reach infinity, but if we add good penalty for changing lines, it could happen
		// this is a very rare case, but we need to handle it!!!
		if currentStation.distance == math.MaxInt32 || currentStation.distance < 0 {
			break
		}

		// If our current station is the end station, we can stop
		if currentStation.id == endStation {
			break
		}

		// Remove the current station from the queue and mark it as visited
		removeStationFromQueue(queue, currentStation.id)
		visited[currentStation.id] = true

		// Update the distances to the adjacent stations
		updateDistances(queue, currentStation, distances, lines)
	}

	if distances[endStation] == math.MaxInt32 {
		return -1
	}
	return distances[endStation]
}
