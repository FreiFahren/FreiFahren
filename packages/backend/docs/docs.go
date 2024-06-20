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
        "/id": {
            "get": {
                "description": "Fetches the unique identifier for a station by its name from the StationsMap. This endpoint performs a case-insensitive search and ignores spaces in the station name.\nThe Ids have format Line prefix that has the format \"SU\" followed by an abbreviation of the station name. For example \"SU-Al\" for the station \"Alexanderplatz\".",
                "consumes": [
                    "application/json"
                ],
                "produces": [
                    "application/json"
                ],
                "tags": [
                    "City Data"
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
                            "type": "string"
                        }
                    },
                    "404": {
                        "description": "Station not found",
                        "schema": {
                            "type": "string"
                        }
                    }
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
