package api

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

func GetRecentTicketInspectorInfo(c echo.Context) error {
	databaseLastModified, err := database.GetLatestUpdateTime()
	if err != nil {
		return utils.HandleErrorEchoContext(c, err, "Error getting latest update time: %v")
	}

	// Check if the data has been modified since the provided time
	ifModifiedSince := c.Request().Header.Get("If-Modified-Since")
	modifiedSince, err := utils.CheckIfModifiedSince(ifModifiedSince, databaseLastModified)
	if err != nil {
		return utils.HandleErrorEchoContext(c, err, "Error checking if the data has been modified: %v")
	}
	if !modifiedSince {
		// Return 304 Not Modified if the data hasn't been modified since the provided time
		return c.NoContent(http.StatusNotModified)
	}

	// Proceed with fetching and processing the data if it was modified
	// or if the If-Modified-Since header was not provided
	ticketInfoList, err := database.GetLatestTicketInspectors()
	if err != nil {
		return utils.HandleErrorEchoContext(c, err, "Error getting latest station coordinates: %v")
	}

	currentHistoricDataThreshold := utils.CalculateHistoricDataThreshold()

	if len(ticketInfoList) < currentHistoricDataThreshold {
		numberOfHistoricDataToFetch := currentHistoricDataThreshold - len(ticketInfoList)
		ticketInfoList, err = FetchAndAddHistoricData(ticketInfoList, numberOfHistoricDataToFetch)
		if err != nil {
			return utils.HandleErrorEchoContext(c, err, "Error fetching and adding historic data: %v")
		}

	}

	ticketInspectorList := []utils.TicketInspectorResponse{}
	for _, ticketInfo := range ticketInfoList {
		ticketInspector, err := constructTicketInspectorInfo(ticketInfo)
		if err != nil {
			return utils.HandleErrorEchoContext(c, err, "Error constructing ticket inspector info: %v")
		}
		ticketInspectorList = append(ticketInspectorList, ticketInspector)
	}

	filteredTicketInspectorList := RemoveDuplicateStations(ticketInspectorList)

	return c.JSONPretty(http.StatusOK, filteredTicketInspectorList, "  ")
}

func IdToCoordinates(id string) (float64, float64, error) {

	var stations = data.GetStationsList()

	station, ok := stations[id]
	if !ok {
		return 0, 0, fmt.Errorf("station ID %s not found", id)
	}

	return station.Coordinates.Latitude, station.Coordinates.Longitude, nil
}

func RemoveDuplicateStations(ticketInspectorList []utils.TicketInspectorResponse) []utils.TicketInspectorResponse {
	uniqueStations := make(map[string]utils.TicketInspectorResponse)
	for _, ticketInspector := range ticketInspectorList {
		stationID := ticketInspector.Station.ID
		if existingInspector, ok := uniqueStations[stationID]; !ok || ticketInspector.Timestamp.After(existingInspector.Timestamp) {
			uniqueStations[stationID] = ticketInspector
		}
	}

	filteredTicketInspectorList := make([]utils.TicketInspectorResponse, 0, len(uniqueStations))
	for _, ticketInspector := range uniqueStations {
		filteredTicketInspectorList = append(filteredTicketInspectorList, ticketInspector)
	}

	// Sort the list by timestamp, then by station name if timestamps are equal
	sort.Slice(filteredTicketInspectorList, func(i, j int) bool {
		if filteredTicketInspectorList[i].Timestamp.Equal(filteredTicketInspectorList[j].Timestamp) {
			return filteredTicketInspectorList[i].Station.Name < filteredTicketInspectorList[j].Station.Name
		}
		return filteredTicketInspectorList[i].Timestamp.After(filteredTicketInspectorList[j].Timestamp)
	})

	return filteredTicketInspectorList
}

func FetchAndAddHistoricData(ticketInfoList []utils.TicketInspector, remaining int) ([]utils.TicketInspector, error) {
	currentStationIDs := make(map[string]bool)
	for _, ticketInfo := range ticketInfoList {
		currentStationIDs[ticketInfo.StationID] = true
	}

	excludedStationIDs := utils.GetKeysFromMap(currentStationIDs)
	historicDataList, err := database.GetHistoricStations(time.Now().UTC(), remaining, 24, excludedStationIDs)
	if err != nil {
		return nil, err
	}

	// Add the historic data to the list
	ticketInfoList = append(ticketInfoList, historicDataList...)

	return ticketInfoList, nil
}

func constructTicketInspectorInfo(ticketInfo utils.TicketInspector) (utils.TicketInspectorResponse, error) {
	cleanedStationId := strings.ReplaceAll(ticketInfo.StationID, "\n", "")
	cleanedDirectionId := strings.ReplaceAll(ticketInfo.DirectionID.String, "\n", "")
	cleanedLine := strings.ReplaceAll(ticketInfo.Line.String, "\n", "")
	cleanedMessage := strings.ReplaceAll(ticketInfo.Message.String, "\n", "")

	stationLat, stationLon, err := IdToCoordinates(cleanedStationId)
	if err != nil {
		return utils.TicketInspectorResponse{}, err
	}

	stationName, err := IdToStationName(cleanedStationId)
	if err != nil {
		return utils.TicketInspectorResponse{}, err
	}

	directionName, directionLat, directionLon := "", float64(0), float64(0)
	if ticketInfo.DirectionID.Valid {
		directionName, err = IdToStationName(cleanedDirectionId)
		if err != nil {
			return utils.TicketInspectorResponse{}, err
		}
		directionLat, directionLon, err = IdToCoordinates(cleanedDirectionId)
		if err != nil {
			return utils.TicketInspectorResponse{}, err
		}
	}

	ticketInspectorInfo := utils.TicketInspectorResponse{
		Timestamp: ticketInfo.Timestamp,
		Station: utils.Station{
			ID:          cleanedStationId,
			Name:        stationName,
			Coordinates: utils.Coordinates{Latitude: stationLat, Longitude: stationLon},
		},
		Direction: utils.Station{
			ID:          cleanedDirectionId,
			Name:        directionName,
			Coordinates: utils.Coordinates{Latitude: directionLat, Longitude: directionLon},
		},
		Line:       cleanedLine,
		IsHistoric: ticketInfo.IsHistoric,
		Message:    cleanedMessage,
	}
	return ticketInspectorInfo, nil
}
