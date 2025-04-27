package inspectors

import (
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/FreiFahren/backend/caching"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

// @Summary Retrieve information about ticket inspector reports
//
// @Description This endpoint retrieves ticket inspector reports from the database within a specified time range.
// @Description It supports filtering by start and end timestamps,
// @Description and checks if the data has been modified since the last request using the "If-Modified-Since" header.
//
// @Tags basics
//
// @Accept json
// @Produce json
//
// @Param start query string false "Start timestamp (RFC3339 format)"
// @Param end query string false "End timestamp (RFC3339 format)"
// @Param station query string false "Station ID to filter inspectors for a specific station"
//
// @Success 200 {object} []utils.TicketInspectorResponse
// @Failure 400 {string} string "Bad Request"
// @Failure 500 {string} string "Internal Server Error"
//
// @Router /basics/inspectors [get]
func GetTicketInspectorsInfo(c echo.Context) error {
	logger.Log.Info().Msg("GET /basics/inspectors")

	databaseLastModified, err := database.GetLatestUpdateTime()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting latest update time")
		return c.NoContent(http.StatusInternalServerError)
	}

	// Check if the data has been modified since the provided time
	ifModifiedSince := c.Request().Header.Get("If-Modified-Since")
	modifiedSince, err := caching.CheckIfModifiedSince(ifModifiedSince, databaseLastModified)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error checking if the data has been modified")
		return c.NoContent(http.StatusInternalServerError)
	}
	if !modifiedSince {
		logger.Log.Info().Msg("Cache hit")
		return c.NoContent(http.StatusNotModified)
	}

	// Proceed with fetching and processing the data if it was modified
	// or if the If-Modified-Since header was not provided
	start := c.QueryParam("start")
	end := c.QueryParam("end")
	stationId := c.QueryParam("station")

	startTime, endTime := utils.GetTimeRange(start, end, time.Hour)

	// Validate that endTime is after startTime
	if endTime.Before(startTime) {
		logger.Log.Warn().Msg("End time is before start time, returning 400 Bad Request")
		return c.String(http.StatusBadRequest, "End time must be after start time")
	}

	ticketInfoList, err := database.GetLatestTicketInspectors(startTime, endTime, stationId)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting ticket inspectors")
		return c.NoContent(http.StatusInternalServerError)
	}

	currentHistoricDataThreshold := calculateHistoricDataThreshold()

	if len(ticketInfoList) < currentHistoricDataThreshold {
		numberOfHistoricDataToFetch := currentHistoricDataThreshold - len(ticketInfoList)
		ticketInfoList, err = FetchAndAddHistoricData(ticketInfoList, numberOfHistoricDataToFetch, startTime, stationId)
		if err != nil {
			logger.Log.Error().Err(err).Msg("Error fetching and adding historic data")
			return c.NoContent(http.StatusInternalServerError)
		}
	}

	ticketInspectorList := []utils.TicketInspectorResponse{}
	for _, ticketInfo := range ticketInfoList {
		ticketInspector, err := constructTicketInspectorInfo(ticketInfo, startTime, endTime)
		if err != nil {
			logger.Log.Error().Err(err).Msg("Error constructing ticket inspector info")
			return c.NoContent(http.StatusInternalServerError)
		}
		ticketInspectorList = append(ticketInspectorList, ticketInspector)
	}

	isOneHourRequest := endTime.Sub(startTime) <= time.Hour
	if isOneHourRequest && stationId == "" {
		// we do not want to remove duplicates for the request to show the number of reports in the last 24h
		ticketInspectorList = removeDuplicateStations(ticketInspectorList)
	}

	return c.JSONPretty(http.StatusOK, ticketInspectorList, "")
}

func removeDuplicateStations(ticketInspectorList []utils.TicketInspectorResponse) []utils.TicketInspectorResponse {
	uniqueStations := make(map[string]utils.TicketInspectorResponse)
	for _, ticketInspector := range ticketInspectorList {
		stationId := ticketInspector.Station.Id
		if existingInspector, ok := uniqueStations[stationId]; !ok || ticketInspector.Timestamp.After(existingInspector.Timestamp) {
			uniqueStations[stationId] = ticketInspector
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

func constructTicketInspectorInfo(ticketInfo utils.TicketInspector, startTime time.Time, endTime time.Time) (utils.TicketInspectorResponse, error) {
	cleanedStationId := strings.TrimSpace(ticketInfo.StationId)

	var cleanedDirectionId, cleanedLine, cleanedMessage string
	if ticketInfo.DirectionId.Valid {
		cleanedDirectionId = strings.TrimSpace(ticketInfo.DirectionId.String)
	}
	if ticketInfo.Line.Valid {
		cleanedLine = strings.TrimSpace(ticketInfo.Line.String)
	}
	if ticketInfo.Message.Valid {
		cleanedMessage = strings.TrimSpace(ticketInfo.Message.String)
	}

	station := getStationEntry(cleanedStationId, "Station")
	direction := getStationEntry(cleanedDirectionId, "Direction")

	if ticketInfo.IsHistoric {
		// As the historic data is not a real entry it has no timestamp, so we need to calculate one
		ticketInfo.Timestamp = calculateHistoricDataTimestamp(startTime, endTime)
	}

	return utils.TicketInspectorResponse{
		Timestamp: ticketInfo.Timestamp,
		Station: utils.Station{
			Id:          cleanedStationId,
			Name:        station.Name,
			Coordinates: utils.Coordinates{Latitude: station.Coordinates.Latitude, Longitude: station.Coordinates.Longitude},
		},
		Direction: utils.Station{
			Id:          cleanedDirectionId,
			Name:        direction.Name,
			Coordinates: utils.Coordinates{Latitude: direction.Coordinates.Latitude, Longitude: direction.Coordinates.Longitude},
		},
		Line:       cleanedLine,
		IsHistoric: ticketInfo.IsHistoric,
		Message:    cleanedMessage,
	}, nil
}

// Helper function to get station or direction data
func getStationEntry(id string, entryType string) utils.StationListEntry {
	defaultEntry := utils.StationListEntry{
		Name:        "",
		Coordinates: utils.CoordinatesEntry{Latitude: 0, Longitude: 0},
	}

	if id == "" {
		return defaultEntry
	}

	stations := data.GetStationsList(nil)
	if foundEntry, ok := stations[id]; ok {
		return foundEntry
	}

	logger.Log.Warn().Msgf("%sId: %s not found, using default", entryType, id)
	return defaultEntry
}
