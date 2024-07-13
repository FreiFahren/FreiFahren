package inspector

import (
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/FreiFahren/backend/api/getStationName"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

// @Summary Retrieve information about recent ticket inspector reports
//
// @Description Fetches the most recent ticket inspector reports from the database and returns them as a JSON array.
// @Description If there are not enough recent reports, the endpoint will fetch additional historic reports to meet the required amount.
// @Description The required amount is determined by the current time of the day and the day of the week, ensuring the most relevant and timely information is provided to the user.
//
// @Tags basics
//
// @Accept json
// @Produce json
//
// @Param If-Modified-Since header string false "Standard HTTP header used to make conditional requests; the response will include the requested data only if it has changed since this date and time."
//
// @Success 200 {object} []utils.TicketInspectorResponse "A JSON array of ticket inspector information, each entry includes details such as timestamp, station, direction, line, and historic flag."
// @Failure 304 {object} nil "Returns an empty response indicating that the requested data has not changed since the time provided in the 'If-Modified-Since' header."
// @Failure 500 {string} string "Internal Server Error: An error occurred while processing the request."
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
	ticketInfoList, err := database.GetLatestTicketInspectors()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting latest station coordinates")
		return c.NoContent(http.StatusInternalServerError)
	}

	currentHistoricDataThreshold := calculateHistoricDataThreshold()

	if len(ticketInfoList) < currentHistoricDataThreshold {
		numberOfHistoricDataToFetch := currentHistoricDataThreshold - len(ticketInfoList)
		ticketInfoList, err = FetchAndAddHistoricData(ticketInfoList, numberOfHistoricDataToFetch)
		if err != nil {
			logger.Log.Error().Err(err).Msg("Error fetching and adding historic data")
			return c.NoContent(http.StatusInternalServerError)
		}

	}

	ticketInspectorList := []utils.TicketInspectorResponse{}
	for _, ticketInfo := range ticketInfoList {
		ticketInspector, err := constructTicketInspectorInfo(ticketInfo)
		if err != nil {
			logger.Log.Error().Err(err).Msg("Error constructing ticket inspector info")
			return c.NoContent(http.StatusInternalServerError)
		}
		ticketInspectorList = append(ticketInspectorList, ticketInspector)
	}

	filteredTicketInspectorList := removeDuplicateStations(ticketInspectorList)

	return c.JSONPretty(http.StatusOK, filteredTicketInspectorList, "")
}

func IdToCoordinates(id string) (float64, float64, error) {
	logger.Log.Debug().Msg("Getting station coordinates")

	var stations = data.GetStationsList()

	station, ok := stations[id]
	if !ok {
		return 0, 0, fmt.Errorf("station ID %s not found", id)
	}

	return station.Coordinates.Latitude, station.Coordinates.Longitude, nil
}

func removeDuplicateStations(ticketInspectorList []utils.TicketInspectorResponse) []utils.TicketInspectorResponse {
	logger.Log.Debug().Msg("Removing duplicate stations")

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
	logger.Log.Debug().Msg("Fetching and adding historic data")

	currentStationIDs := make(map[string]bool)
	for _, ticketInfo := range ticketInfoList {
		currentStationIDs[ticketInfo.StationID] = true
	}

	excludedStationIDs := utils.GetKeysFromMap(currentStationIDs)
	historicDataList, err := database.GetHistoricStations(time.Now().UTC(), remaining, 24, excludedStationIDs)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting historic stations")
		return nil, err
	}

	// Add the historic data to the list
	ticketInfoList = append(ticketInfoList, historicDataList...)

	return ticketInfoList, nil
}

func constructTicketInspectorInfo(ticketInfo utils.TicketInspector) (utils.TicketInspectorResponse, error) {
	logger.Log.Debug().Msg("Constructing ticket inspector info")

	cleanedStationId := strings.ReplaceAll(ticketInfo.StationID, "\n", "")
	cleanedDirectionId := strings.ReplaceAll(ticketInfo.DirectionID.String, "\n", "")
	cleanedLine := strings.ReplaceAll(ticketInfo.Line.String, "\n", "")
	cleanedMessage := strings.ReplaceAll(ticketInfo.Message.String, "\n", "")

	stationLat, stationLon, err := IdToCoordinates(cleanedStationId)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting station coordinates")
		return utils.TicketInspectorResponse{}, err
	}

	stationName, err := getStationName.IdToStationName(cleanedStationId)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting station name")
		return utils.TicketInspectorResponse{}, err
	}

	directionName, directionLat, directionLon := "", float64(0), float64(0)
	if ticketInfo.DirectionID.Valid {
		directionName, err = getStationName.IdToStationName(cleanedDirectionId)
		if err != nil {
			logger.Log.Error().Err(err).Msg("Error getting direction name")
			return utils.TicketInspectorResponse{}, err
		}
		directionLat, directionLon, err = IdToCoordinates(cleanedDirectionId)
		if err != nil {
			logger.Log.Error().Err(err).Msg("Error getting direction coordinates")
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
