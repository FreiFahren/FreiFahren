package Rstats

import (
	"bytes"
	_ "embed"
	"encoding/csv"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
)

func RunRiskModel() error {
	logger.Log.Debug().Msg("Running risk model")

	basePath := "."
	scriptPath := filepath.Join(basePath, "Rstats")
	outputPath := filepath.Join(scriptPath, "output")
	csvPath := filepath.Join(scriptPath, "ticket_data.csv")

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

	if err := fetchAndSaveRecentTicketInspectors(csvPath); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to fetch and save recent ticket inspectors")
		return err
	}

	if err := executeRiskModelScript(csvPath, outputPath); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to execute risk model script")
		return err
	}

	if err := CleanupOldFiles(outputPath); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to cleanup old files")
		return err
	}

	return nil
}

func fetchAndSaveRecentTicketInspectors(csvPath string) error {
	logger.Log.Debug().Msg("Fetching and saving recent ticket inspectors")

	startTime := time.Now().UTC().Add(-time.Hour)
	endTime := time.Now().UTC()
	ticketInspectors, err := database.GetLatestTicketInspectors(startTime, endTime)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get latest ticket inspectors")
		return err
	}

	if err := simplifyAndSaveTicketInspectors(ticketInspectors, csvPath); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to simplify and save ticket inspectors")
		return err
	}

	return nil
}

func executeRiskModelScript(csvPath string, outputPath string) error {
	// Read the file
	data, err := ioutil.ReadFile(csvPath)
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
	req.Header.Set("Content-Type", "text/csv")

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

	// Get the current time and format it as a string
	timestamp := time.Now().Format("2006-01-02T15:04:05")

	// Construct the filename with the timestamp
	filename := fmt.Sprintf("risk_model%s.json", timestamp)
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

	file, err := os.Create(filePath)
	if err != nil {
		return fmt.Errorf("(rScripts.go) failed to create CSV file: %w", err)
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	// Write CSV header
	header := []string{"Timestamp", "StationID", "Lines", "DirectionID"}
	if err := writer.Write(header); err != nil {
		return fmt.Errorf("(rScripts.go) failed to write CSV header: %w", err)
	}

	// If no ticket inspectors, just write the header
	if len(ticketInspectors) == 0 {
		return nil
	}

	for _, ticket := range ticketInspectors {
		var lines []string
		if ticket.Line.Valid {
			lines = append(lines, ticket.Line.String)
		} else {
			stations := data.GetStationsList()
			lines = stations[ticket.StationID].Lines
		}

		directionID := ""
		if ticket.DirectionID.Valid {
			directionID = ticket.DirectionID.String
		}

		row := []string{
			ticket.Timestamp.Format(time.RFC3339),
			ticket.StationID,
			strings.Join(lines, "|"), // Join multiple lines with a pipe character
			directionID,
		}

		if err := writer.Write(row); err != nil {
			logger.Log.Error().Err(err).Msg("Failed to write row")
			return err
		}
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
