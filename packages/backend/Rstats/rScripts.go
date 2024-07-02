package Rstats

import (
	"bytes"
	_ "embed"
	"encoding/csv"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/database"
	"github.com/FreiFahren/backend/utils"
)

//go:embed risk_model.r
var embeddedRiskModelScript []byte

//go:embed segments_v5.RDS
var embeddedSegmentsRDS []byte

func RunRiskModel() error {
	basePath := "."
	scriptPath := filepath.Join(basePath, "Rstats")
	outputPath := filepath.Join(scriptPath, "output")
	csvPath := filepath.Join(scriptPath, "ticket_data.csv")

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

	err := os.WriteFile("Rstats/segments_v5.RDS", embeddedSegmentsRDS, 0644)
	if err != nil {
		log.Fatalf("(rScripts.go) Failed to write file: %v", err)
	}

	if err := fetchAndSaveRecentTicketInspectors(csvPath); err != nil {
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

func fetchAndSaveRecentTicketInspectors(csvPath string) error {
	ticketInspectors, err := database.GetLatestTicketInspectors()
	if err != nil {
		return fmt.Errorf("(rScripts.go) failed to fetch tickets: %w", err)
	}

	if err := simplifyAndSaveTicketInspectors(ticketInspectors, csvPath); err != nil {
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
			return fmt.Errorf("(rScripts.go) failed to write CSV row: %w", err)
		}
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
