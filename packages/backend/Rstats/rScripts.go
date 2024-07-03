package Rstats

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
)

//go:embed risk_model.r
var embeddedRiskModelScript []byte

//go:embed segments_v4.RDS
var embeddedSegmentsRDS []byte

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

	err := os.WriteFile("Rstats/segments_v4.RDS", embeddedSegmentsRDS, 0644)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to write segments_v4.RDS")
	}

	if err := fetchAndSaveRecentTicketInspectors(jsonPath); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to fetch and save recent ticket inspectors")
		return err
	}

	if err := executeRiskModelScript(); err != nil {
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

func executeRiskModelScript() error {
	logger.Log.Debug().Msg("Executing risk model script")

	runRscriptCmd := exec.Command("Rscript", "-")

	// Set the R script as the standard input
	runRscriptCmd.Stdin = bytes.NewReader(embeddedRiskModelScript)

	outputFromRscript, err := runRscriptCmd.CombinedOutput()
	if err != nil {
		log.Println(string(outputFromRscript))
		logger.Log.Error().Err(err).Msg("Failed to run Rscript")
		return err
	}
	logger.Log.Info().Str("Rscript output", string(outputFromRscript))
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

	// Delete oldest files if there are more than 10 files
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
