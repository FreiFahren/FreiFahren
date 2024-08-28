package inspectors

import (
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/FreiFahren/backend/api/getStationName"
	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

var (
	cachedInspectorList []utils.TicketInspectorResponse
	cacheMutex sync.RWMutex
	cacheExpiration time.Time
	cacheDuration = 1 * time.Hour // as a backup if the cacheRefreshTicker is not working
	cacheLastModified   time.Time
	cacheRefreshTicker *time.Ticker
)

func init() {
	cacheRefreshTicker = time.NewTicker(1 * time.Minute)
	go refreshCacheIfNeeded()
}

func refreshCacheIfNeeded() {
	for range cacheRefreshTicker.C {
		cacheMutex.RLock()
		needsRefresh := len(cachedInspectorList) == 0 || time.Since(cachedInspectorList[0].Timestamp) >= time.Hour
		cacheMutex.RUnlock()

		if needsRefresh {
			refreshCache()
		}
	}
}

func refreshCache() {
	logger.Log.Info().Msg("Refreshing inspector cache")
	endTime := time.Now()
	startTime := endTime.Add(-1 * time.Hour)

	newTicketInfoList, err := database.GetLatestTicketInspectors(startTime, endTime)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error fetching new inspector data")
		return
	}

	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	currentHistoricDataThreshold := calculateHistoricDataThreshold()

	// Create a map of existing inspectors for quick lookup
	existingInspectors := make(map[string]utils.TicketInspector)
	for _, inspector := range cachedInspectorList {
		existingInspectors[inspector.Station.ID] = utils.ConvertTicketInspectorResponseToTicketInspector(inspector)
	}

	updatedInspectorList := []utils.TicketInspector{}

	// Process new ticket info
	for _, newTicketInfo := range newTicketInfoList {
		// Case B: New inspector reported or update existing inspector
		if _, exists := existingInspectors[newTicketInfo.StationID]; !exists || newTicketInfo.Timestamp.After(existingInspectors[newTicketInfo.StationID].Timestamp) {
			updatedInspectorList = append(updatedInspectorList, newTicketInfo)
			delete(existingInspectors, newTicketInfo.StationID)
		}
	}

	// Add remaining valid inspectors from the existing cache
	for _, inspector := range existingInspectors {
		if time.Since(inspector.Timestamp) < time.Hour {
			updatedInspectorList = append(updatedInspectorList, inspector)
		}
	}

	// Case A: Add historic data if needed
	if len(updatedInspectorList) < currentHistoricDataThreshold {
		numberOfHistoricDataToFetch := currentHistoricDataThreshold - len(updatedInspectorList)
		
		historicData, err := FetchAndAddHistoricData(updatedInspectorList, numberOfHistoricDataToFetch, startTime)
		if err != nil {
			logger.Log.Error().Err(err).Msg("Error fetching and adding historic data")
		} else {
			updatedInspectorList = historicData
		}
	}

	// Sort the list
	sort.Slice(updatedInspectorList, func(i, j int) bool {
		if updatedInspectorList[i].Timestamp.Equal(updatedInspectorList[j].Timestamp) {
			return updatedInspectorList[i].StationID < updatedInspectorList[j].StationID
		}
		return updatedInspectorList[i].Timestamp.After(updatedInspectorList[j].Timestamp)
	})

	// Convert back to TicketInspectorResponse for caching
	cachedInspectorList = make([]utils.TicketInspectorResponse, len(updatedInspectorList))
	for i, inspector := range updatedInspectorList {
		response, err := constructTicketInspectorInfo(inspector, startTime, endTime)
		if err != nil {
			logger.Log.Error().Err(err).Msg("Error constructing ticket inspector info")
			continue
		}
		cachedInspectorList[i] = response
	}

	cacheExpiration = time.Now().Add(cacheDuration)
	cacheLastModified = time.Now()

	logger.Log.Info().Msgf("Cache refreshed with %d inspectors", len(cachedInspectorList))
}

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
	logger.Log.Debug().Msgf("Cache expiration: %s", cacheExpiration)

	start := c.QueryParam("start")
	end := c.QueryParam("end")

	startTime, endTime := GetTimeRange(start, end)
	isOneHourRange := endTime.Sub(startTime) == time.Hour

	ifModifiedSince := c.Request().Header.Get("If-Modified-Since")

	// Check if cached data is still valid for one-hour range requests
	if isOneHourRange {
        cacheMutex.RLock()
        cacheValid := !cacheExpiration.IsZero() && time.Now().Before(cacheExpiration) && len(cachedInspectorList) > 0
        if cacheValid {
            // Check if-modified-since to avoid rerendering in the frontend when same data is returned
            modifiedSince, err := utils.CheckIfModifiedSince(ifModifiedSince, cacheLastModified)
            if err != nil {
                logger.Log.Error().Err(err).Msg("Error checking if the data has been modified")
            }
            if !modifiedSince {
                cacheMutex.RUnlock()
                return c.NoContent(http.StatusNotModified)
            }
            logger.Log.Debug().Msg("Returning cached inspector list for one-hour range")
            c.Response().Header().Set("Last-Modified", cacheLastModified.Format(time.RFC1123))
            result := make([]utils.TicketInspectorResponse, len(cachedInspectorList))
            copy(result, cachedInspectorList) // copy to ensure thread safety
            cacheMutex.RUnlock()
			logger.Log.Debug().Msgf("Returning cached inspector list for one-hour range: %v", result)
            return c.JSONPretty(http.StatusOK, result, "")
		}
		cacheMutex.RUnlock()
	}

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

	// Sort the list by timestamp, then by station name if timestamps are equal
	sort.Slice(ticketInspectorList, func(i, j int) bool {
		if ticketInspectorList[i].Timestamp.Equal(ticketInspectorList[j].Timestamp) {
			return ticketInspectorList[i].Station.Name < ticketInspectorList[j].Station.Name
		}
		return ticketInspectorList[i].Timestamp.After(ticketInspectorList[j].Timestamp)
	})

	databaseLastModified, err := database.GetLatestInspectorsTimestamp()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting latest update time")
		return c.NoContent(http.StatusInternalServerError)
	}

	// Remove duplicates if start and end time are one hour apart
	// This is done to prevent the MarkerModal from showing the same station twice, whilst the ListModal should show duplicates
	if isOneHourRange {
		ticketInspectorList = removeDuplicateStations(ticketInspectorList)

		// update the cache for one-hour range requests
		cacheMutex.Lock()
		cachedInspectorList = ticketInspectorList
		cacheExpiration = time.Now().Add(cacheDuration)
		cacheLastModified = databaseLastModified // so that the cache time is same as the inspectors timestamp
		cacheMutex.Unlock()
	}

	logger.Log.Debug().Msgf("Returning %d ticket inspectors", len(ticketInspectorList))
	return c.JSONPretty(http.StatusOK, ticketInspectorList, "")
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

	return filteredTicketInspectorList
}

func constructTicketInspectorInfo(ticketInfo utils.TicketInspector, startTime time.Time, endTime time.Time) (utils.TicketInspectorResponse, error) {
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

	if ticketInfo.IsHistoric {
		// As the historic data is not a real entry it has no timestamp, so we need to calculate one
		ticketInfo.Timestamp = calculateHistoricDataTimestamp(startTime, endTime)
		logger.Log.Debug().Msgf("Setting timestamp to %s for historic data", ticketInfo.Timestamp)
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
