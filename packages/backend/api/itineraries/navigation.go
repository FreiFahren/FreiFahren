package itineraries

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

func translateResponseStations(response *EngineResponse) {
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

// translateToResponsePosition converts an engine Position to a ResponsePosition
func translateToResponsePosition(pos Position) ResponsePosition {
	return ResponsePosition{
		BasePosition: BasePosition[any]{
			Name:               pos.Name,
			StopID:             pos.StopID,
			Lat:                pos.Lat,
			Lon:                pos.Lon,
			Departure:          pos.Departure,
			ScheduledDeparture: pos.ScheduledDeparture,
			Arrival:            pos.Arrival,
			ScheduledArrival:   pos.ScheduledArrival,
		},
	}
}

// translateToResponseLeg converts an engine Leg to a ResponseLeg
func translateToResponseLeg(leg *Leg) ResponseLeg {
	// Convert from and to positions
	fromPos := translateToResponsePosition(leg.From)
	toPos := translateToResponsePosition(leg.To)

	// Convert intermediate stops
	intermediateStops := make([]ResponsePosition, len(leg.IntermediateStops))
	for i, stop := range leg.IntermediateStops {
		intermediateStops[i] = translateToResponsePosition(stop)
	}

	return ResponseLeg{
		BaseLeg: BaseLeg[ResponsePosition, LegGeometry]{
			Mode:               leg.Mode,
			From:               fromPos,
			To:                 toPos,
			Duration:           leg.Duration,
			StartTime:          leg.StartTime,
			EndTime:            leg.EndTime,
			ScheduledStartTime: leg.ScheduledStartTime,
			ScheduledEndTime:   leg.ScheduledEndTime,
			RouteShortName:     leg.RouteShortName,
			IntermediateStops:  intermediateStops,
			LegGeometry:        leg.LegGeometry,
		},
	}
}

// translateToResponseItinerary converts an engine Itinerary to a ResponseItinerary
func translateToResponseItinerary(itinerary *Itinerary) ResponseItinerary {
	responseLeg := make([]ResponseLeg, len(itinerary.Legs))
	for i, leg := range itinerary.Legs {
		responseLeg[i] = translateToResponseLeg(&leg)
	}

	return ResponseItinerary{
		BaseItinerary: BaseItinerary[ResponseLeg]{
			Duration:       itinerary.Duration,
			StartTime:      itinerary.StartTime,
			EndTime:        itinerary.EndTime,
			Transfers:      itinerary.Transfers,
			Legs:           responseLeg,
			CalculatedRisk: itinerary.CalculatedRisk,
		},
	}
}

func GenerateItineraries(req ItineraryRequest) (*ItinerariesResponse, error) {
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
	var engineResp EngineResponse
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
	alternativeItineraries := make([]Itinerary, 0, len(allItineraries)-1)
	for i, itin := range allItineraries {
		if i != safestRouteIndex {
			alternativeItineraries = append(alternativeItineraries, itin)
		}
	}

	// Limit to top 10 itineraries in total (including safest route)
	maxTotal := 10
	if len(alternativeItineraries) > maxTotal-1 {
		alternativeItineraries = alternativeItineraries[:maxTotal-1]
	}

	// Construct final response
	safestItinerary := translateToResponseItinerary(&allItineraries[safestRouteIndex])
	response := &ItinerariesResponse{
		RequestParameters:      engineResp.RequestParameters,
		DebugOutput:            engineResp.DebugOutput,
		From:                   translateToResponsePosition(engineResp.From),
		To:                     translateToResponsePosition(engineResp.To),
		SafestItinerary:        &safestItinerary,
		AlternativeItineraries: make([]ResponseItinerary, len(alternativeItineraries)),
	}

	// Translate alternative itineraries
	for i, itinerary := range alternativeItineraries {
		response.AlternativeItineraries[i] = translateToResponseItinerary(&itinerary)
	}

	return response, nil
}
