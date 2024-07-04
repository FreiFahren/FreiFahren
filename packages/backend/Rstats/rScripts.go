package Rstats

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
)

func RunRiskModel() error {
	logger.Log.Debug().Msg("Running risk model")

	basePath := "."
	scriptPath := filepath.Join(basePath, "Rstats")
	outputPath := filepath.Join(scriptPath, "output")
	jsonPath := filepath.Join(scriptPath, "ticket_data.json")

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		if err = os.Mkdir(scriptPath, 0755); err != nil {
			logger.Log.Error().Err(err).Msg("Failed to create Rstats directory")
			return err
		}
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		if err = os.Mkdir(outputPath, 0755); err != nil {
			logger.Log.Error().Err(err).Msg("Failed to create output directory")
			return err
		}
	}

	if err := fetchAndSaveRecentTicketInspectors(jsonPath); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to fetch and save recent ticket inspectors")
		return err
	}

	if err := executeRiskModelScript(jsonPath, outputPath); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to execute risk model script")
		return err
	}

	if err := CleanupOldFiles(outputPath); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to cleanup old files")
		return err
	}

	return nil
}

func fetchAndSaveRecentTicketInspectors(jsonPath string) error {
	logger.Log.Debug().Msg("Fetching and saving recent ticket inspectors")

	ticketInspectors, err := database.GetLatestTicketInspectors()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get latest ticket inspectors")
		return err
	}

	if err := simplifyAndSaveTicketInspectors(ticketInspectors, jsonPath); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to simplify and save ticket inspectors")
		return err
	}

	return nil
}

func executeRiskModelScript(jsonPath string, outputPath string) error {
	// Read the file
	data, err := ioutil.ReadFile(jsonPath)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to read file")
		return err
	}

	// Create a new POST request with the file content as the request body
	req, err := http.NewRequest("POST", os.Getenv("RISK_API_URL")+"/run", bytes.NewBuffer(data))
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to create request")
		return err
	}

	// Set the content type to JSON
	req.Header.Set("Content-Type", "application/json")

	// Send the request
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to send request")
		return err
	}
	defer resp.Body.Close()

	// Read the response
	respBody, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to read response body")
		return err
	}
	logger.Log.Debug().Msgf("Response body: %s", respBody)

	// Get the current time and format it as a string
	timestamp := time.Now().Format("2006-01-02T15:04:05")

	// Construct the filename with the timestamp
	filename := fmt.Sprintf("risk_model%s.json", timestamp)
	fmt.Printf("respBody: %v", respBody)
	// Save the response body to a file
	outputPath = filepath.Join(outputPath, filename)
	err = ioutil.WriteFile(outputPath, respBody, 0644)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to write response body to file")
		return err
	}

	logger.Log.Debug().Msgf("Response body saved to %s", outputPath)

	return nil
}

func simplifyAndSaveTicketInspectors(ticketInspectors []utils.TicketInspector, filePath string) error {
	logger.Log.Debug().Msg("Simplifying and saving ticket inspectors")

	var simplifiedTickets []utils.SimplifiedTicketInspector

	// If no ticket inspectors, write an empty JSON array to the file
	if len(ticketInspectors) == 0 {
		emptyJson := []byte("[]")
		if err := os.WriteFile(filePath, emptyJson, 0644); err != nil {
			logger.Log.Error().Err(err).Msg("Failed to write empty JSON data to file")
			return err
		}
		return nil
	}

	for _, ticket := range ticketInspectors {
		simplified := utils.SimplifiedTicketInspector{
			Timestamp: ticket.Timestamp.Format(time.RFC3339),
			StationID: ticket.StationID,
		}

		// Handle nullable fields
		if ticket.Line.Valid {
			simplified.Line = ticket.Line.String
		}
		if ticket.DirectionID.Valid {
			simplified.DirectionID = ticket.DirectionID.String
		}

		simplifiedTickets = append(simplifiedTickets, simplified)
	}

	// Serialize simplified data to JSON
	data, err := json.MarshalIndent(simplifiedTickets, "", "  ")
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to marshal JSON data")
		return err
	}

	// Save to file
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to write JSON data to file")
		return err
	}

	logger.Log.Debug().Msg("Ticket inspectors saved to file successfully " + filePath)

	return nil
}

func CleanupOldFiles(outputPath string) error {
	logger.Log.Debug().Msg("Cleaning up old files")

	entries, err := os.ReadDir(outputPath)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to read directory")
		return err
	}

	var jsonFiles []os.FileInfo
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".json") {
			info, err := entry.Info()
			if err != nil {
				logger.Log.Error().Err(err).Msg("Failed to get file info")
				continue
			}
			jsonFiles = append(jsonFiles, info)
		}
	}

	// Delete oldest files if there are more than 10
	if len(jsonFiles) > 10 {
		sort.Slice(jsonFiles, func(i, j int) bool {
			return jsonFiles[i].ModTime().Before(jsonFiles[j].ModTime())
		})
		for _, file := range jsonFiles[:len(jsonFiles)-10] {
			err := os.Remove(filepath.Join(outputPath, file.Name()))
			if err != nil {
				logger.Log.Error().Err(err).Msg("Failed to remove file")
				return err
			}
		}
	}

	return nil
}
