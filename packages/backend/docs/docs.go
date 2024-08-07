// Package docs Code generated by swaggo/swag. DO NOT EDIT
package docs

import "github.com/swaggo/swag"

const docTemplate = `{
    "schemes": {{ marshal .Schemes }},
    "swagger": "2.0",
    "info": {
        "description": "{{escape .Description}}",
        "title": "{{.Title}}",
        "contact": {},
        "version": "{{.Version}}"
    },
    "host": "{{.Host}}",
    "basePath": "{{.BasePath}}",
    "paths": {
        "/basics/inspectors": {
            "get": {
                "description": "This endpoint retrieves ticket inspector reports from the database within a specified time range.\nIt supports filtering by start and end timestamps,\nand checks if the data has been modified since the last request using the \"If-Modified-Since\" header.",
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "basics"
                ],
                "summary": "Retrieve information about ticket inspector reports",
                "parameters": [
                    {
                        "type": "string",
                        "description": "Start timestamp (RFC3339 format)",
                        "name": "start",
                        "in": "query"
                    },
                    {
                        "type": "string",
                        "description": "End timestamp (RFC3339 format)",
                        "name": "end",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "type": "array",
                            "items": {
                                "$ref": "#/definitions/utils.TicketInspectorResponse"
                            }
                        }
                    },
                    "400": {
                        "description": "Bad Request",
                        "schema": {
                            "type": "string"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error",
                        "schema": {
                            "type": "string"
                        }
                    }
                }
            },
            "post": {
                "description": "Accepts a JSON payload with details about a ticket inspector's current location.\nThis endpoint validates the provided data, processes necessary computations for linking stations and lines,\ninserts the data into the database, and triggers an update to the risk model used in operational analysis.\nIf the 'timestamp' field is not provided in the request, the current UTC time truncated to the nearest minute is used automatically.",
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "basics"
                ],
                "summary": "Submit ticket inspector data",
                "parameters": [
                    {
                        "description": "Data about the inspector's location and activity",
                        "name": "inspectorData",
                        "in": "body",
                        "required": true,
                        "schema": {
                            "$ref": "#/definitions/utils.InspectorRequest"
                        }
                    },
                    {
                        "type": "string",
                        "description": "Timestamp of the report in ISO 8601 format (e.g., 2006-01-02T15:04:05Z); if not provided, the current time is used",
                        "name": "timestamp",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Successfully processed and inserted the inspector data with computed linkages and risk model updates.",
                        "schema": {
                            "$ref": "#/definitions/utils.ResponseData"
                        }
                    },
                    "400": {
                        "description": "Bad Request: Missing or incorrect parameters provided."
                    },
                    "500": {
                        "description": "Internal Server Error: Error during data processing or database insertion."
                    }
                }
            }
        },
        "/data/id": {
            "get": {
                "description": "Fetches the unique identifier for a station by its name from the StationsMap. This endpoint performs a case-insensitive search and ignores spaces in the station name.\nThe Ids have format Line prefix that has the format \"SU\" followed by an abbreviation of the station name. For example \"SU-A\" for the station \"Alexanderplatz\".",
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "data"
                ],
                "summary": "Retrieve Station ID by Name",
                "parameters": [
                    {
                        "type": "string",
                        "description": "Station name",
                        "name": "name",
                        "in": "query",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "The station id",
                        "schema": {
                            "type": "object",
                            "additionalProperties": {
                                "type": "string"
                            }
                        }
                    },
                    "404": {
                        "description": "Error message",
                        "schema": {
                            "type": "object",
                            "additionalProperties": {
                                "type": "string"
                            }
                        }
                    }
                }
            }
        },
        "/data/list": {
            "get": {
                "description": "This endpoint returns a comprehensive list of all train stations and lines.\nOptionally, it can return only a list of lines or stations based on the provided query parameters.",
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "data"
                ],
                "summary": "Retrieves stations and lines information",
                "parameters": [
                    {
                        "type": "string",
                        "description": "Set to 'true' to retrieve only the list of lines.",
                        "name": "lines",
                        "in": "query"
                    },
                    {
                        "type": "string",
                        "description": "Set to 'true' to retrieve only the list of stations.",
                        "name": "stations",
                        "in": "query"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "OK",
                        "schema": {
                            "$ref": "#/definitions/utils.AllStationsAndLinesList"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error: Unable to process the request.",
                        "schema": {
                            "type": "string"
                        }
                    }
                }
            }
        },
        "/risk-prediction/segment-colors": {
            "get": {
                "description": "Fetches the latest risk assessments for transit segments, returned as color codes representing the risk level. You can find out more about the risk level calculation in the documentation.\nThe response includes the last modified timestamp of the risk model data to support conditional GET requests.",
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "Risk Prediction"
                ],
                "summary": "Get risk colors for segments",
                "parameters": [
                    {
                        "type": "string",
                        "description": "Standard HTTP header used to make conditional requests; the response will include the risk colors only if they have changed since this date and time.",
                        "name": "If-Modified-Since",
                        "in": "header"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Successfully retrieved the color-coded risk levels for each segment.",
                        "schema": {
                            "$ref": "#/definitions/utils.RiskModelResponse"
                        }
                    },
                    "304": {
                        "description": "No changes: The data has not been modified since the last request date provided in the 'If-Modified-Since' header.",
                        "schema": {
                            "type": "none"
                        }
                    },
                    "500": {
                        "description": "Internal Server Error: Error during the processing of the request."
                    }
                }
            }
        },
        "/station": {
            "get": {
                "description": "Fetches the name of a station by its unique identifier from the StationsMap.\nThe Ids have format Line prefix that has the format \"SU\" followed by an abbreviation of the station name. For example \"SU-A\" for the station \"Alexanderplatz\".",
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "data"
                ],
                "summary": "Retrieve Name by Station ID",
                "parameters": [
                    {
                        "type": "string",
                        "description": "Station Id",
                        "name": "id",
                        "in": "query",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "The station id",
                        "schema": {
                            "type": "string"
                        }
                    },
                    "404": {
                        "description": "Error getting station name",
                        "schema": {
                            "type": "string"
                        }
                    }
                }
            }
        },
        "/transit/distance": {
            "get": {
                "description": "Returns the shortest number of stations between an inspector's station and a given user's latitude and longitude coordinates.\nThe distance calculation employs Dijkstra's algorithm to determine the minimal stops required to reach the nearest station from the given coordinates.",
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "transit"
                ],
                "summary": "Calculate shortest distance to a station",
                "parameters": [
                    {
                        "type": "string",
                        "description": "The station ID of the inspector's current location.",
                        "name": "inspectorStationId",
                        "in": "query",
                        "required": true
                    },
                    {
                        "type": "string",
                        "description": "The latitude of the user's location.",
                        "name": "userLat",
                        "in": "query",
                        "required": true
                    },
                    {
                        "type": "string",
                        "description": "The longitude of the user's location.",
                        "name": "userLon",
                        "in": "query",
                        "required": true
                    }
                ],
                "responses": {
                    "200": {
                        "description": "The shortest distance in terms of the number of station stops between the inspector's station and the user's location.",
                        "schema": {
                            "type": "int"
                        }
                    },
                    "500": {
                        "description": "An error occurred in processing the request."
                    }
                }
            }
        }
    },
    "definitions": {
        "utils.AllStationsAndLinesList": {
            "type": "object",
            "properties": {
                "lines": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            }
                        }
                    }
                },
                "stations": {
                    "type": "object",
                    "additionalProperties": {
                        "$ref": "#/definitions/utils.StationListEntry"
                    }
                }
            }
        },
        "utils.Coordinates": {
            "type": "object",
            "properties": {
                "latitude": {
                    "type": "number"
                },
                "longitude": {
                    "type": "number"
                }
            }
        },
        "utils.CoordinatesEntry": {
            "type": "object",
            "properties": {
                "latitude": {
                    "type": "number"
                },
                "longitude": {
                    "type": "number"
                }
            }
        },
        "utils.InspectorRequest": {
            "type": "object",
            "properties": {
                "author": {
                    "description": "is always null or 98111116 (ASCII for \"BOT\") when getting data from the telegram bot",
                    "type": "integer"
                },
                "directionId": {
                    "type": "string"
                },
                "line": {
                    "type": "string"
                },
                "message": {
                    "type": "string"
                },
                "stationId": {
                    "type": "string"
                },
                "timestamp": {
                    "type": "string"
                }
            }
        },
        "utils.ResponseData": {
            "type": "object",
            "properties": {
                "author": {
                    "type": "integer"
                },
                "direction": {
                    "$ref": "#/definitions/utils.Station"
                },
                "line": {
                    "type": "string"
                },
                "message": {
                    "type": "string"
                },
                "station": {
                    "$ref": "#/definitions/utils.Station"
                },
                "timestamp": {
                    "type": "string"
                }
            }
        },
        "utils.RiskModelResponse": {
            "type": "object",
            "properties": {
                "last_modified": {
                    "type": "string"
                },
                "segment_colors": {
                    "type": "object",
                    "additionalProperties": {
                        "type": "string"
                    }
                }
            }
        },
        "utils.Station": {
            "type": "object",
            "properties": {
                "coordinates": {
                    "$ref": "#/definitions/utils.Coordinates"
                },
                "id": {
                    "type": "string"
                },
                "lines": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    }
                },
                "name": {
                    "type": "string"
                }
            }
        },
        "utils.StationListEntry": {
            "type": "object",
            "properties": {
                "coordinates": {
                    "$ref": "#/definitions/utils.CoordinatesEntry"
                },
                "lines": {
                    "type": "array",
                    "items": {
                        "type": "string"
                    }
                },
                "name": {
                    "type": "string"
                }
            }
        },
        "utils.TicketInspectorResponse": {
            "type": "object",
            "properties": {
                "direction": {
                    "$ref": "#/definitions/utils.Station"
                },
                "isHistoric": {
                    "type": "boolean"
                },
                "line": {
                    "description": "String is used so that it can easily be handled by the frontend",
                    "type": "string"
                },
                "message": {
                    "type": "string"
                },
                "station": {
                    "$ref": "#/definitions/utils.Station"
                },
                "timestamp": {
                    "type": "string"
                }
            }
        }
    }
}`

// SwaggerInfo holds exported Swagger Info so clients can modify it
var SwaggerInfo = &swag.Spec{
	Version:          "1.0",
	Host:             "localhost:8080",
	BasePath:         "/",
	Schemes:          []string{},
	Title:            "FreiFahren API Documentation",
	Description:      "API for the FreiFahren project, responsible for collecting and serving data about ticket inspectors on public transport.",
	InfoInstanceName: "swagger",
	SwaggerTemplate:  docTemplate,
	LeftDelim:        "{{",
	RightDelim:       "}}",
}

func init() {
	swag.Register(SwaggerInfo.InstanceName(), SwaggerInfo)
}
