package Rstats

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/utils"
)

//go:embed risk_model.r
var embeddedRiskModelScript []byte

//go:embed segments_v4.RDS
var embeddedSegmentsRDS []byte

func RunRiskModel() error {
	basePath := "."
	scriptPath := filepath.Join(basePath, "Rstats")
	outputPath := filepath.Join(scriptPath, "output")
	jsonPath := filepath.Join(scriptPath, "ticket_data.json")

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		if err = os.Mkdir(scriptPath, 0755); err != nil {
			return fmt.Errorf("(rScripts.go) failed to create script directory: %w", err)
		}
	}

	if _, err := os.Stat(outputPath); os.IsNotExist(err) {
		if err = os.Mkdir(outputPath, 0755); err != nil {
			return fmt.Errorf("(rScripts.go) failed to create output directory: %w", err)
		}
	}

	err := os.WriteFile("Rstats/segments_v4.RDS", embeddedSegmentsRDS, 0644)
	if err != nil {
		log.Fatalf("(rScripts.go) Failed to write file: %v", err)
	}

	if err := fetchAndSaveRecentTicketInspectors(jsonPath); err != nil {
		return fmt.Errorf("(rScripts.go) failed to fetch data and save: %w", err)
	}

	if err := executeRiskModelScript(); err != nil {
		return fmt.Errorf("(rScripts.go) failed to execute risk model script: %w", err)
	}

	if err := CleanupOldFiles(outputPath); err != nil {
		return fmt.Errorf("(rScripts.go) failed to cleanup old files: %w", err)
	}

	return nil
}

func fetchAndSaveRecentTicketInspectors(jsonPath string) error {
	ticketInspectors, err := database.GetLatestTicketInspectors()
	if err != nil {
		return fmt.Errorf("(rScripts.go) failed to fetch tickets: %w", err)
	}

	if err := simplifyAndSaveTicketInspectors(ticketInspectors, jsonPath); err != nil {
		return fmt.Errorf("(rScripts.go) failed to simplify and save ticket inspectors: %w", err)
	}

	return nil
}

func executeRiskModelScript() error {
	runRscriptCmd := exec.Command("Rscript", "-")

	// Set the R script as the standard input
	runRscriptCmd.Stdin = bytes.NewReader(embeddedRiskModelScript)

	outputFromRscript, err := runRscriptCmd.CombinedOutput()
	if err != nil {
		log.Println(string(outputFromRscript))
		return fmt.Errorf("(rScripts.go) failed to run R script: %w", err)
	}
	log.Println(string(outputFromRscript))
	return nil
}

func simplifyAndSaveTicketInspectors(ticketInspectors []utils.TicketInspector, filePath string) error {
	var simplifiedTickets []utils.SimplifiedTicketInspector

	// If no ticket inspectors, write an empty JSON array to the file
	if len(ticketInspectors) == 0 {
		emptyJson := []byte("[]")
		if err := os.WriteFile(filePath, emptyJson, 0644); err != nil {
			return fmt.Errorf("(rScripts.go) failed to write empty JSON data to file: %w", err)
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
		return fmt.Errorf("(rScripts.go) failed to marshal data to JSON: %w", err)
	}

	// Save to file
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("(rScripts.go) failed to write JSON data to file: %w", err)
	}

	return nil
}

func CleanupOldFiles(outputPath string) error {
	entries, err := os.ReadDir(outputPath)
	if err != nil {
		log.Fatalf("(rScripts.go) Failed to read directory: %v", err)
		return err
	}

	var jsonFiles []os.FileInfo
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), ".json") {
			info, err := entry.Info()
			if err != nil {
				log.Printf("Failed to get FileInfo for %s: %v\n", entry.Name(), err)
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
				log.Printf("Failed to delete file: %s, error: %v\n", file.Name(), err)
				return err
			}
		}
	}

	return nil
}
