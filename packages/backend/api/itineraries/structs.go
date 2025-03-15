package itineraries

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

type BasePosition[T any] struct {
	Name               string  `json:"name"`
	StopID             string  `json:"stopId"`
	Lat                float64 `json:"lat"`
	Lon                float64 `json:"lon"`
	Departure          *string `json:"departure,omitempty"`
	ScheduledDeparture *string `json:"scheduledDeparture,omitempty"`
	Arrival            *string `json:"arrival,omitempty"`
	ScheduledArrival   *string `json:"scheduledArrival,omitempty"`
}

type EnginePosition struct {
	BasePosition[any]
	Level          float64 `json:"level"`
	VertexType     string  `json:"vertexType"`
	ScheduledTrack *string `json:"scheduledTrack,omitempty"`
	Track          *string `json:"track,omitempty"`
}

type ResponsePosition struct {
	BasePosition[any]
}

type Position = EnginePosition

type LegGeometry struct {
	Points string `json:"points"`
	Length int    `json:"length"`
}

type BaseLeg[P any, G any] struct {
	Mode               string  `json:"mode"`
	From               P       `json:"from"`
	To                 P       `json:"to"`
	Duration           int     `json:"duration"`
	StartTime          string  `json:"startTime"`
	EndTime            string  `json:"endTime"`
	ScheduledStartTime string  `json:"scheduledStartTime"`
	ScheduledEndTime   string  `json:"scheduledEndTime"`
	RouteShortName     *string `json:"routeShortName,omitempty"`
	IntermediateStops  []P     `json:"intermediateStops,omitempty"`
	LegGeometry        G       `json:"legGeometry"`
}

// Alias for backward compatibility
type Itinerary = EngineItinerary
type Leg = EngineLeg

type EngineLeg struct {
	BaseLeg[Position, LegGeometry]
	RealTime       bool    `json:"realTime"`
	Headsign       *string `json:"headsign,omitempty"`
	RouteColor     *string `json:"routeColor,omitempty"`
	RouteTextColor *string `json:"routeTextColor,omitempty"`
	AgencyName     *string `json:"agencyName,omitempty"`
	AgencyURL      *string `json:"agencyUrl,omitempty"`
	AgencyID       *string `json:"agencyId,omitempty"`
	TripID         *string `json:"tripId,omitempty"`
	Source         *string `json:"source,omitempty"`
}

type ResponseLeg struct {
	BaseLeg[ResponsePosition, LegGeometry]
}

type BaseItinerary[L any] struct {
	Duration       int     `json:"duration"`
	StartTime      string  `json:"startTime"`
	EndTime        string  `json:"endTime"`
	Transfers      int     `json:"transfers"`
	Legs           []L     `json:"legs"`
	CalculatedRisk float64 `json:"calculated_risk,omitempty"`
}

type EngineItinerary struct {
	BaseItinerary[Leg]
}

type ResponseItinerary struct {
	BaseItinerary[ResponseLeg]
}

type ItineraryRequest struct {
	StartStation string `json:"startStation"`
	EndStation   string `json:"endStation"`
}

type EngineResponse struct {
	RequestParameters map[string]interface{} `json:"requestParameters"`
	DebugOutput       map[string]interface{} `json:"debugOutput"`
	From              Position               `json:"from"`
	To                Position               `json:"to"`
	Direct            []interface{}          `json:"direct"`
	Itineraries       []Itinerary            `json:"itineraries"`
}

type ItinerariesResponse struct {
	RequestParameters      map[string]interface{} `json:"requestParameters"`
	DebugOutput            map[string]interface{} `json:"debugOutput"`
	From                   ResponsePosition       `json:"from"`
	To                     ResponsePosition       `json:"to"`
	SafestItinerary        *ResponseItinerary     `json:"safestItinerary"`
	AlternativeItineraries []ResponseItinerary    `json:"alternativeItineraries"`
}
