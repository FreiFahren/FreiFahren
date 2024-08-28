package utils

import (
	"database/sql"
	"time"
)

// This is the struct that we will use to store the data from the StationsList.json file
// getId.go

type Station struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Coordinates Coordinates `json:"coordinates"`
	Lines       []string    `json:"lines"`
}

type Coordinates struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// TicketInspector and TicketInspectorResponse are two different structs to avoid issues when sening null values to the frontend

// Is used to create a JSON reponse to the frontend
type TicketInspectorResponse struct {
	Timestamp  time.Time `json:"timestamp"`
	Station    Station   `json:"station"`
	Direction  Station   `json:"direction"`
	Line       string    `json:"line"` // String is used so that it can easily be handled by the frontend
	IsHistoric bool      `json:"isHistoric"`
	Message    string    `json:"message,omitempty"`
}

// Is used to simplify the data before saving it to a file
type SimplifiedTicketInspector struct {
	Timestamp   string   `json:"timestamp"`
	StationID   string   `json:"station_id"`
	Lines       []string `json:"line,omitempty"`
	DirectionID string   `json:"direction_id,omitempty"`
}

// Is used within the backend primarily to fetch from the database
type TicketInspector struct {
	Timestamp   time.Time      `json:"timestamp"`
	StationID   string         `json:"station_id"`
	Line        sql.NullString `json:"line"`         // NullString is used to handle NULL values from the database
	DirectionID sql.NullString `json:"direction_id"` // NullString is used to handle NULL values from the database
	IsHistoric  bool           `json:"isHistoric"`
	Author      sql.NullInt64  `json:"author"`  // NullInt64 is used to handle NULL BigInt values from the database
	Message     sql.NullString `json:"message"` // NullString is used to handle NULL Text values from the database
}

// Is used when posting a new inspector
type InspectorRequest struct {
	Timestamp   time.Time `json:"timestamp"`
	Line        string    `json:"line"`
	StationID   string    `json:"stationId"`
	DirectionID string    `json:"directionId"`
	Author      int64     `json:"author,omitempty"` // is always null or 98111116 (ASCII for "BOT") when getting data from the telegram bot
	Message     string    `json:"message,omitempty"`
}

// InsertPointers holds pointers to the fields necessary for inserting data into the database.
type InsertPointers struct {
	TimestampPtr     *time.Time
	AuthorPtr        *int64
	MessagePtr       *string
	LinePtr          *string
	StationNamePtr   *string
	StationIDPtr     *string
	DirectionNamePtr *string
	DirectionIDPtr   *string
}

// When sending the response of what was posted
type ResponseData struct {
	Timestamp time.Time `json:"timestamp"`
	Line      string    `json:"line"`
	Station   Station   `json:"station"`
	Direction Station   `json:"direction"`
	Author    int64     `json:"author,omitempty"`
	Message   string    `json:"message,omitempty"`
}

// getAllStationsAndLines.go

type StationListEntry struct {
	Name        string           `json:"name"`
	Coordinates CoordinatesEntry `json:"coordinates"`
	Lines       []string         `json:"lines"`
}

type CoordinatesEntry struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type AllStationsAndLinesList struct {
	Lines    []map[string][]string       `json:"lines"`
	Stations map[string]StationListEntry `json:"stations"`
}

// getStationDistance.go

// the stopovers between the station and the destination
type Journeys struct {
	Journey []Journey `json:"journeys"`
}

type Journey struct {
	Legs []Leg `json:"legs"`
}

type Leg struct {
	Stopovers []Stopover `json:"stopovers"`
}

type Stopover struct {
	Stop Stop `json:"stop"`
}

type Stop struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// the nearby station to the given coordinates
type NearbyStations struct {
	Type        string   `json:"type"`
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Location    Location `json:"location"`
	Products    Products `json:"products"`
	StationDHID string   `json:"stationDHID"`
	Distance    int      `json:"distance"`
}

type Location struct {
	Type      string  `json:"type"`
	ID        string  `json:"id"`
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type Products struct {
	Suburban bool `json:"suburban"`
	Subway   bool `json:"subway"`
	Tram     bool `json:"tram"`
	Bus      bool `json:"bus"`
	Ferry    bool `json:"ferry"`
	Express  bool `json:"express"`
	Regional bool `json:"regional"`
}

// GeoJSON structs

type RiskModelJSON struct {
	Sid   string `json:"sid"`
	Line  string `json:"line"`
	Color string `json:"color"`
}

type RiskModelResponse struct {
	LastModified  string            `json:"last_modified"`
	SegmentColors map[string]string `json:"segment_colors"`
}