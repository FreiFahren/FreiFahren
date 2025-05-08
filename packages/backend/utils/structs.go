package utils

import (
	"database/sql"
	"time"
)

type Station struct {
	Id          string      `json:"id"`
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

// Is used within the backend primarily to fetch from the database
type TicketInspector struct {
	Timestamp   time.Time      `json:"timestamp"`
	StationId   string         `json:"station_id"`
	Line        sql.NullString `json:"line"`         // NullString is used to handle NULL values from the database
	DirectionId sql.NullString `json:"direction_id"` // NullString is used to handle NULL values from the database
	IsHistoric  bool           `json:"isHistoric"`
	Author      sql.NullInt64  `json:"author"`  // NullInt64 is used to handle NULL BigInt values from the database
	Message     sql.NullString `json:"message"` // NullString is used to handle NULL Text values from the database
}

// Is used when posting a new inspector
type InspectorRequest struct {
	Timestamp   time.Time `json:"timestamp"`
	Line        string    `json:"line"`
	StationId   string    `json:"stationId"`
	DirectionId string    `json:"directionId"`
	Author      int64     `json:"author,omitempty"` // is always null or 98111116 (ASCII for "BOT") when getting data from the telegram bot
	Message     string    `json:"message,omitempty"`
}

// InsertPointers holds pointers to the fields necessary for inserting data into the database.
type InsertPointers struct {
	TimestampPtr   *time.Time
	AuthorPtr      *int64
	MessagePtr     *string
	LinePtr        *string
	StationIdPtr   *string
	DirectionIdPtr *string
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

type StationListEntry struct {
	Name        string           `json:"name"`
	Coordinates CoordinatesEntry `json:"coordinates"`
	Lines       []string         `json:"lines"`
}

type CoordinatesEntry struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

type GeoJSONCRS struct {
	Type       string                 `json:"type"`
	Properties map[string]interface{} `json:"properties"`
}

type SegmentProperties struct {
	Sid       string `json:"sid"`
	Line      string `json:"line"`
	LineColor string `json:"line_color"`
}

type SegmentGeometry struct {
	Type        string      `json:"type"`
	Coordinates [][]float64 `json:"coordinates"`
}

type SegmentFeature struct {
	Type       string            `json:"type"`
	Properties SegmentProperties `json:"properties"`
	Geometry   SegmentGeometry   `json:"geometry"`
}

type SegmentsCollection struct {
	Type     string           `json:"type"`
	Name     string           `json:"name"`
	CRS      GeoJSONCRS       `json:"crs"`
	Features []SegmentFeature `json:"features"`
}
