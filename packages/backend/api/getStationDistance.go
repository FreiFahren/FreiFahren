package api

import (
	"container/list"
	"log"
	"net/http"
	"sort"

	"math"

	"github.com/FreiFahren/backend/data"
	utils "github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

type StationNode struct {
	id       string
	distance int
	line     string
}

var stationsList map[string]utils.StationListEntry
var stationIDs []string
var linesList map[string][]string

func GetStationDistance(c echo.Context) error {
	var err error

	inspectorStationId := c.QueryParam("inspectorStationId")

	inspectorStationCoordinates := stationsList[inspectorStationId].Coordinates

	userLat, err := utils.ParseStringToFloat(c.QueryParam("userLat"))
	if err != nil {
		return utils.HandleErrorEchoContext(c, err, "Error parsing userLat: %v")
	}
	userLon, err := utils.ParseStringToFloat(c.QueryParam("userLon"))
	if err != nil {
		return utils.HandleErrorEchoContext(c, err, "Error parsing userLon: %v")
	}

	kmDistance := utils.CalculateDistance(inspectorStationCoordinates.Latitude, inspectorStationCoordinates.Longitude, userLat, userLon)

	// If the user is less than 1 km away from the station, we just return 1 station distance
	if kmDistance < 1 {
		return c.JSON(http.StatusOK, 1)
	}

	distances := FindShortestDistance(inspectorStationId, userLat, userLon)

	return c.JSON(http.StatusOK, distances)
}

func ReadAndCreateSortedStationsListAndLinesList() (map[string]utils.StationListEntry, []string, map[string][]string) {
	stationsList = data.GetStationsList()

	// Create a slice of the station IDs
	stationIDs = make([]string, 0, len(stationsList))
	for id := range stationsList {
		stationIDs = append(stationIDs, id)
	}

	// Sort the slice of station IDs, to get a more deterministic result
	// because the order of the keys in a map is not guaranteed and golang kinda fucks up
	sort.Strings(stationIDs)

	linesList = data.GetLinesList()

	return stationsList, stationIDs, linesList
}

// ---- dijkstra

func GetAdjacentStationsID(stationId string) []string {
	stationLines := stationsList[stationId].Lines

	adjacentStations := make([]string, 0)

	// Get the adjacent stations for each line the station is on
	for _, line := range stationLines {
		currentStationID, err := utils.GetIndexOfStationID(stationId, linesList[line])

		if currentStationID == -1 && err != nil {
			log.Fatalf("(getStationsDistance.go) Error getting station ID: %v", err)
		}

		// get the adjacent stations one station before and one station after the current station
		if currentStationID > 0 {
			adjacentStations = append(adjacentStations, linesList[line][currentStationID-1])
		}

		if currentStationID < len(linesList[line])-1 {
			adjacentStations = append(adjacentStations, linesList[line][currentStationID+1])
		}
	}

	// Remove duplicates
	adjacentStations = utils.RemoveDuplicateAdjacentStations(adjacentStations)

	return adjacentStations
}

func initializeQueue(startStation string) (*list.List, map[string]int, map[string]string) {
	queue := list.New()
	distances := make(map[string]int)
	lines := make(map[string]string)

	// Initialize the distances and lines
	for _, id := range stationIDs {
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
	for _, adjacentStationId := range GetAdjacentStationsID(currentStation.id) {
		// each distance from one station to another is 1
		newDistance := currentStation.distance + 1

		if newDistance < distances[adjacentStationId] {

			distances[adjacentStationId] = newDistance
			lines[adjacentStationId] = stationsList[adjacentStationId].Lines[0]
			queue.PushBack(StationNode{adjacentStationId, newDistance, stationsList[adjacentStationId].Lines[0]})
		}
	}
}

// this is the dijkstra algorithm
func FindShortestDistance(startStation string, userLat, userLon float64) int {
	ReadAndCreateSortedStationsListAndLinesList()

	endStation := utils.GetNearestStationID(stationIDs, stationsList, userLat, userLon)

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
