package navigation

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/FreiFahren/backend/api/prediction"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

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

	// Get station IDs from the engines format
	fromID := ""
	if id := leg.From.StopID; id != "" {
		if parts := strings.Split(id, ":"); len(parts) > 0 {
			fromID = parts[len(parts)-1]
		}
	}

	toID := ""
	if id := leg.To.StopID; id != "" {
		if parts := strings.Split(id, ":"); len(parts) > 0 {
			toID = parts[len(parts)-1]
		}
	}

	if fromID == "" || toID == "" {
		return 0
	}

	// Try both directions of the segment
	forwardKey := fmt.Sprintf("%s.%s:%s", *line, fromID, toID)
	reverseKey := fmt.Sprintf("%s.%s:%s", *line, toID, fromID)

	if risk, exists := riskData.SegmentsRisk[forwardKey]; exists {
		return risk.Risk
	}
	if risk, exists := riskData.SegmentsRisk[reverseKey]; exists {
		return risk.Risk
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

func GetItineraries(c echo.Context) error {
	logger.Log.Info().Msg("GET /itineraries")
	var req RouteRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid request body",
		})
	}

	// Get station IDs using the map
	stationsMap := data.GetStationsMap()
	startStationId, exists := stationsMap[req.StartStation]
	if !exists {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid start station ID",
		})
	}

	endStationId, exists := stationsMap[req.EndStation]
	if !exists {
		return c.JSON(http.StatusBadRequest, map[string]string{
			"error": "Invalid end station ID",
		})
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
		return c.JSON(http.StatusBadGateway, map[string]string{
			"error": "Failed to fetch route from engine",
		})
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return c.JSON(http.StatusBadGateway, map[string]string{
			"error": "Engine returned non-200 status code",
		})
	}

	// Decode engine response directly into our struct
	var engineResp RouteResponse
	if err := json.NewDecoder(resp.Body).Decode(&engineResp); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to decode engine response")
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"error": "Failed to decode engine response",
		})
	}

	// Get current risk data
	riskData, ok := prediction.Cache.Get()
	if !ok {
		var err error
		riskData, err = prediction.ExecuteRiskModel()
		if err != nil {
			logger.Log.Error().Err(err).Msg("Failed to get risk data")
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"error": "Failed to get risk data",
			})
		}
	}

	// Calculate risk for all itineraries
	var allItineraries []Itinerary
	for i := range engineResp.Itineraries {
		engineResp.Itineraries[i].CalculatedRisk = calculateItineraryRisk(&engineResp.Itineraries[i], riskData)
		allItineraries = append(allItineraries, engineResp.Itineraries[i])
	}

	// Sort by risk to find safest route
	sort.Slice(allItineraries, func(i, j int) bool {
		return allItineraries[i].CalculatedRisk < allItineraries[j].CalculatedRisk
	})

	// Construct final response
	response := EnrichedRouteResponse{
		RequestParameters: engineResp.RequestParameters,
		DebugOutput:       engineResp.DebugOutput,
		From:              engineResp.From,
		To:                engineResp.To,
		Direct:            engineResp.Direct,
		SafestRoute:       &allItineraries[0],
		AlternativeRoutes: allItineraries[1:],
	}

	// write response to file for deugging
	// todo: remove this before deployment
	file2, err := os.Create("response.json")
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to create file")
	}
	json.NewEncoder(file2).Encode(response)

	return c.JSON(http.StatusOK, response)
}
