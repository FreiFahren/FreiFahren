package navigation

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/FreiFahren/backend/api/prediction"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/logger"
)

// Custom error types
type ValidationError struct {
	message string
}

func (e *ValidationError) Error() string {
	return e.message
}

type EngineError struct {
	message string
}

func (e *EngineError) Error() string {
	return e.message
}

type Position struct {
	Name               string  `json:"name"`
	StopID             string  `json:"stopId"`
	Lat                float64 `json:"lat"`
	Lon                float64 `json:"lon"`
	Level              float64 `json:"level"`
	VertexType         string  `json:"vertexType"`
	Departure          *string `json:"departure,omitempty"`
	ScheduledDeparture *string `json:"scheduledDeparture,omitempty"`
	Arrival            *string `json:"arrival,omitempty"`
	ScheduledArrival   *string `json:"scheduledArrival,omitempty"`
	ScheduledTrack     *string `json:"scheduledTrack,omitempty"`
	Track              *string `json:"track,omitempty"`
}

type LegGeometry struct {
	Points string `json:"points"`
	Length int    `json:"length"`
}

type Leg struct {
	Mode               string      `json:"mode"`
	From               Position    `json:"from"`
	To                 Position    `json:"to"`
	Duration           int         `json:"duration"`
	StartTime          string      `json:"startTime"`
	EndTime            string      `json:"endTime"`
	ScheduledStartTime string      `json:"scheduledStartTime"`
	ScheduledEndTime   string      `json:"scheduledEndTime"`
	RealTime           bool        `json:"realTime"`
	Headsign           *string     `json:"headsign,omitempty"`
	RouteColor         *string     `json:"routeColor,omitempty"`
	RouteTextColor     *string     `json:"routeTextColor,omitempty"`
	AgencyName         *string     `json:"agencyName,omitempty"`
	AgencyURL          *string     `json:"agencyUrl,omitempty"`
	AgencyID           *string     `json:"agencyId,omitempty"`
	TripID             *string     `json:"tripId,omitempty"`
	RouteShortName     *string     `json:"routeShortName,omitempty"`
	Source             *string     `json:"source,omitempty"`
	IntermediateStops  []Position  `json:"intermediateStops,omitempty"`
	LegGeometry        LegGeometry `json:"legGeometry"`
}

type Itinerary struct {
	Duration       int     `json:"duration"`
	StartTime      string  `json:"startTime"`
	EndTime        string  `json:"endTime"`
	Transfers      int     `json:"transfers"`
	Legs           []Leg   `json:"legs"`
	CalculatedRisk float64 `json:"calculated_risk,omitempty"`
}

type RouteRequest struct {
	StartStation string `json:"startStation"`
	EndStation   string `json:"endStation"`
}

type RouteResponse struct {
	RequestParameters map[string]interface{} `json:"requestParameters"`
	DebugOutput       map[string]interface{} `json:"debugOutput"`
	From              Position               `json:"from"`
	To                Position               `json:"to"`
	Direct            []interface{}          `json:"direct"`
	Itineraries       []Itinerary            `json:"itineraries"`
}

type EnrichedRouteResponse struct {
	RequestParameters map[string]interface{} `json:"requestParameters"`
	DebugOutput       map[string]interface{} `json:"debugOutput"`
	From              Position               `json:"from"`
	To                Position               `json:"to"`
	Direct            []interface{}          `json:"direct"`
	SafestRoute       *Itinerary             `json:"safestRoute"`
	AlternativeRoutes []Itinerary            `json:"alternativeRoutes"`
}

func calculateLegRisk(leg *Leg, riskData *prediction.RiskData) float64 {
	// Skip walking legs
	if leg.Mode == "WALK" {
		return 0
	}

	line := leg.RouteShortName
	if line == nil {
		return 0
	}

	// Create a slice of all stops in order (from -> intermediate -> to)
	allStops := make([]Position, 0, len(leg.IntermediateStops)+2)
	allStops = append(allStops, leg.From)
	allStops = append(allStops, leg.IntermediateStops...)
	allStops = append(allStops, leg.To)

	var totalRisk float64
	var segmentCount int

	// Calculate risk for each consecutive pair of stops
	for i := 0; i < len(allStops)-1; i++ {
		// Get station IDs from the engines format
		fromID := ""
		if id := allStops[i].StopID; id != "" {
			if parts := strings.Split(id, ":"); len(parts) > 0 {
				fromID = parts[len(parts)-1]
			}
		}

		toID := ""
		if id := allStops[i+1].StopID; id != "" {
			if parts := strings.Split(id, ":"); len(parts) > 0 {
				toID = parts[len(parts)-1]
			}
		}

		if fromID == "" || toID == "" {
			continue
		}

		// Try both directions of the segment
		forwardKey := fmt.Sprintf("%s.%s:%s", *line, fromID, toID)
		reverseKey := fmt.Sprintf("%s.%s:%s", *line, toID, fromID)

		if risk, exists := riskData.SegmentsRisk[forwardKey]; exists {
			totalRisk += risk.Risk
			segmentCount++
			continue
		}

		if risk, exists := riskData.SegmentsRisk[reverseKey]; exists {
			totalRisk += risk.Risk
			segmentCount++
		}
	}

	if segmentCount > 0 {
		return totalRisk / float64(segmentCount)
	}
	return 0
}

func calculateItineraryRisk(itinerary *Itinerary, riskData *prediction.RiskData) float64 {
	var totalRisk float64
	var transitLegs int

	for i := range itinerary.Legs {
		risk := calculateLegRisk(&itinerary.Legs[i], riskData)
		totalRisk += risk
		if itinerary.Legs[i].Mode != "WALK" {
			transitLegs++
		}
	}

	if transitLegs > 0 {
		return totalRisk / float64(transitLegs)
	}
	return 0
}

func translateEngineStationId(engineId string) string {
	// Get the stations map
	stationsMap := data.GetStationsMap()

	// Extract the middle numbers from the engine ID
	// Example: "de-VBB_de:11000:900110521::4" -> "900110521"
	parts := strings.Split(engineId, ":")
	if len(parts) < 3 {
		return engineId // Return original if format doesn't match
	}
	middleNumbers := parts[2]

	// Iterate through the stations map to find a matching station
	for freifahrenId, mappedEngineId := range stationsMap {
		// Extract middle numbers from mapped engine ID
		mappedParts := strings.Split(mappedEngineId, ":")
		if len(mappedParts) < 3 {
			continue
		}
		mappedMiddleNumbers := mappedParts[2]

		// Compare middle numbers
		if middleNumbers == mappedMiddleNumbers {
			return freifahrenId
		}
	}

	return engineId // Return original if no match found
}

func translateStationIds(position *Position) {
	if position.StopID != "" {
		position.StopID = translateEngineStationId(position.StopID)
	}
}

func translateStationName(stationId string) string {
	// Get the stations list which contains the station details
	stationsList := data.GetStationsList()

	// Look up the station in the list
	if station, exists := stationsList[stationId]; exists {
		return station.Name
	}

	return "" // Return empty string if no translation found
}

func removeRedundantWalkingLegs(itinerary *Itinerary) {
	// Filter out walking legs with same from and to stop ID
	filteredLegs := make([]Leg, 0)
	for _, leg := range itinerary.Legs {
		if leg.Mode == "WALK" && leg.From.StopID == leg.To.StopID {
			continue // Skip this leg
		}
		filteredLegs = append(filteredLegs, leg)
	}
	itinerary.Legs = filteredLegs
}

func translateResponseStations(response *RouteResponse) {
	// Translate From and To station IDs
	translateStationIds(&response.From)
	translateStationIds(&response.To)

	// Translate station names using the translated IDs
	if translatedName := translateStationName(response.From.StopID); translatedName != "" {
		response.From.Name = translatedName
	}
	if translatedName := translateStationName(response.To.StopID); translatedName != "" {
		response.To.Name = translatedName
	}

	// Translate station IDs in all itineraries and remove redundant walking legs
	for i := range response.Itineraries {
		for j := range response.Itineraries[i].Legs {
			// Translate From and To station IDs in each leg
			translateStationIds(&response.Itineraries[i].Legs[j].From)
			translateStationIds(&response.Itineraries[i].Legs[j].To)

			// Translate station names using the translated IDs
			if translatedName := translateStationName(response.Itineraries[i].Legs[j].From.StopID); translatedName != "" {
				response.Itineraries[i].Legs[j].From.Name = translatedName
			}
			if translatedName := translateStationName(response.Itineraries[i].Legs[j].To.StopID); translatedName != "" {
				response.Itineraries[i].Legs[j].To.Name = translatedName
			}

			// also translate the headsign
			if response.Itineraries[i].Legs[j].Headsign != nil {
				*response.Itineraries[i].Legs[j].Headsign = translateStationName(*response.Itineraries[i].Legs[j].Headsign)
			}

			// Translate station IDs and names in intermediate stops
			for k := range response.Itineraries[i].Legs[j].IntermediateStops {
				translateStationIds(&response.Itineraries[i].Legs[j].IntermediateStops[k])
				if translatedName := translateStationName(response.Itineraries[i].Legs[j].IntermediateStops[k].StopID); translatedName != "" {
					response.Itineraries[i].Legs[j].IntermediateStops[k].Name = translatedName
				}
			}
		}
		// Remove redundant walking legs after translation
		removeRedundantWalkingLegs(&response.Itineraries[i])
	}
}

func GenerateItineraries(req RouteRequest) (*EnrichedRouteResponse, error) {
	// Get station IDs using the map
	stationsMap := data.GetStationsMap()
	startStationId, exists := stationsMap[req.StartStation]
	if !exists {
		return nil, &ValidationError{message: "Invalid start station ID"}
	}

	endStationId, exists := stationsMap[req.EndStation]
	if !exists {
		return nil, &ValidationError{message: "Invalid end station ID"}
	}

	// Construct the URL with query parameters
	engineURL := fmt.Sprintf("%s/plan", os.Getenv("ENGINE_URL"))
	currentTime := time.Now().UTC().Format(time.RFC3339)

	queryParams := url.Values{}
	queryParams.Set("time", currentTime)
	queryParams.Set("fromPlace", startStationId)
	queryParams.Set("toPlace", endStationId)
	queryParams.Set("arriveBy", "false")
	queryParams.Set("timetableView", "true")
	queryParams.Set("pedestrianProfile", "FOOT")
	queryParams.Set("preTransitModes", "WALK")
	queryParams.Set("postTransitModes", "WALK")
	queryParams.Set("directModes", "WALK")
	queryParams.Set("requireBikeTransport", "false")

	// Make request to the engine
	resp, err := http.Get(engineURL + "?" + queryParams.Encode())
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to fetch route from engine")
		return nil, &EngineError{message: "Failed to fetch route from engine"}
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, &EngineError{message: "Engine returned non-200 status code"}
	}

	// Decode engine response directly into our struct
	var engineResp RouteResponse
	if err := json.NewDecoder(resp.Body).Decode(&engineResp); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to decode engine response")
		return nil, fmt.Errorf("failed to decode engine response: %w", err)
	}

	// Translate all station IDs to FreiFahren format
	translateResponseStations(&engineResp)

	// Get current risk data
	riskData, ok := prediction.Cache.Get()
	if !ok {
		var err error
		riskData, err = prediction.ExecuteRiskModel()
		if err != nil {
			logger.Log.Error().Err(err).Msg("Failed to get risk data")
			return nil, fmt.Errorf("failed to get risk data: %w", err)
		}
	}

	// Calculate risk for all itineraries
	var allItineraries []Itinerary
	var safestRouteIndex int
	var lowestRisk float64

	for i := range engineResp.Itineraries {
		engineResp.Itineraries[i].CalculatedRisk = calculateItineraryRisk(&engineResp.Itineraries[i], riskData)

		// Keep track of the safest route
		if i == 0 || engineResp.Itineraries[i].CalculatedRisk < lowestRisk {
			safestRouteIndex = i
			lowestRisk = engineResp.Itineraries[i].CalculatedRisk
		}

		allItineraries = append(allItineraries, engineResp.Itineraries[i])
	}

	// Filter out the safest route from alternative routes while preserving order
	// order is preserved as the engine already returns the itereraries by how good they are
	alternativeRoutes := make([]Itinerary, 0, len(allItineraries)-1)
	for i, itin := range allItineraries {
		if i != safestRouteIndex {
			alternativeRoutes = append(alternativeRoutes, itin)
		}
	}

	// Limit to top 10 itineraries in total (including safest route)
	maxTotal := 10
	if len(alternativeRoutes) > maxTotal-1 {
		alternativeRoutes = alternativeRoutes[:maxTotal-1]
	}

	// Construct final response
	response := &EnrichedRouteResponse{
		RequestParameters: engineResp.RequestParameters,
		DebugOutput:       engineResp.DebugOutput,
		From:              engineResp.From,
		To:                engineResp.To,
		Direct:            engineResp.Direct,
		SafestRoute:       &allItineraries[safestRouteIndex],
		AlternativeRoutes: alternativeRoutes,
	}

	return response, nil
}
