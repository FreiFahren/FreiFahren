package inspectors

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

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
	modifiedSince, err := utils.CheckIfModifiedSince(ifModifiedSince, databaseLastModified)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error checking if the data has been modified")
		return c.NoContent(http.StatusInternalServerError)
	}
	if !modifiedSince {
		// Return 304 Not Modified if the data hasn't been modified since the provided time
		return c.NoContent(http.StatusNotModified)
	}

	// Proceed with fetching and processing the data if it was modified
	// or if the If-Modified-Since header was not provided
	start := c.QueryParam("start")
	end := c.QueryParam("end")

	startTime, endTime := GetTimeRange(start, end)

	ticketInfoList, err := database.GetLatestTicketInspectors(startTime, endTime)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting ticket inspectors")
		return c.NoContent(http.StatusInternalServerError)
	}

	currentHistoricDataThreshold := calculateHistoricDataThreshold()

	if len(ticketInfoList) < currentHistoricDataThreshold {
		numberOfHistoricDataToFetch := currentHistoricDataThreshold - len(ticketInfoList)
		ticketInfoList, err = FetchAndAddHistoricData(ticketInfoList, numberOfHistoricDataToFetch, startTime)
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
	if isOneHourRequest {
		// we do not want to remove duplicates for the request to show the number of reports in the last 24h
		ticketInspectorList = removeDuplicateStations(ticketInspectorList)
	}

	return c.JSONPretty(http.StatusOK, ticketInspectorList, "")
}

func removeDuplicateStations(ticketInspectorList []utils.TicketInspectorResponse) []utils.TicketInspectorResponse {
	logger.Log.Debug().Msg("Removing duplicate stations")

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
	logger.Log.Debug().Msg("Constructing ticket inspector info")

	cleanedStationId := strings.ReplaceAll(ticketInfo.StationId, "\n", "")
	cleanedDirectionId := strings.ReplaceAll(ticketInfo.DirectionId.String, "\n", "")
	cleanedLine := strings.ReplaceAll(ticketInfo.Line.String, "\n", "")
	cleanedMessage := strings.ReplaceAll(ticketInfo.Message.String, "\n", "")

	stations := data.GetStationsList()
	station, ok := stations[cleanedStationId]
	if !ok {
		logger.Log.Error().Msg("Station not found")
		return utils.TicketInspectorResponse{}, fmt.Errorf("station not found")
	}

	direction, ok := stations[cleanedDirectionId]
	if !ok {
		logger.Log.Error().Msg("Direction not found")
		return utils.TicketInspectorResponse{}, fmt.Errorf("direction not found")
	}

	if ticketInfo.IsHistoric {
		// As the historic data is not a real entry it has no timestamp, so we need to calculate one
		ticketInfo.Timestamp = calculateHistoricDataTimestamp(startTime, endTime)
		logger.Log.Debug().Msgf("Setting timestamp to %s for historic data", ticketInfo.Timestamp)
	}

	ticketInspectorInfo := utils.TicketInspectorResponse{
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
	}
	return ticketInspectorInfo, nil
}
