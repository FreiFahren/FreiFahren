package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"time"

	"github.com/FreiFahren/backend/Rstats"
	"github.com/FreiFahren/backend/data"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

func GetSegmentColors(c echo.Context) error {
	segmentsFiles, err := getSegmentFiles()
	if err != nil {
		return utils.HandleErrorEchoContext(c, err, "Error reading Rstats directory.")
	}

	segmentColors, lastModified, err := loadAndParseRiskModelOutput(segmentsFiles[0])
	if err != nil {
		return utils.HandleErrorEchoContext(c, err, "Error loading risk model file.")
	}

	ifModifiedSince := c.Request().Header.Get("If-Modified-Since")
	modifiedSince, err := utils.CheckIfModifiedSince(ifModifiedSince, lastModified)
	if err != nil {
		return utils.HandleErrorEchoContext(c, err, "Error checking if the data has been modified: %v")
	}
	if !modifiedSince {
		// Return 304 Not Modified if the data hasn't been modified since the provided time
		return c.NoContent(http.StatusNotModified)
	}

	// Transform segmentColors from []utils.RiskModelJSON to utils.RiskModelResponse
	segmentColorsMap := make(map[string]string)
	for _, segment := range segmentColors {
		segmentColorsMap[segment.Sid] = segment.Color
	}

	duplicates := data.GetDuplicateSegments()

	AssignSameColorToSegmentsWithSameStations(segmentColorsMap, duplicates)

	RiskModelResponse := utils.RiskModelResponse{
		LastModified:  lastModified.Format("2006-01-02T15:04:05Z07:00"),
		SegmentColors: segmentColorsMap,
	}

	return c.JSONPretty(http.StatusOK, RiskModelResponse, "  ")
}

func AssignSameColorToSegmentsWithSameStations(segmentColorsMap map[string]string, duplicates map[string][]string) {
	for original, duplicatesArray := range duplicates {
		if color, found := segmentColorsMap[original]; found {
			originalPrefix := getSegmentType(original)
			for _, duplicate := range duplicatesArray {
				if originalPrefix == getSegmentType(duplicate) { // Only assign the color if the segment type is the same
					segmentColorsMap[duplicate] = color
				}
			}
		}
	}
}

func getSegmentType(segmentID string) string {
	return segmentID[:1] // By getting the first character we know if it is a Ubahn or Sbahn segment
}

func loadAndParseRiskModelOutput(file os.FileInfo) ([]utils.RiskModelJSON, time.Time, error) {
	filePath := "Rstats/output/" + file.Name()

	fileData, err := os.ReadFile(filePath)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("(getSegmentColors.go) error reading file: %w", err)
	}

	segmentData, err := parseRiskModelJSON(fileData)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("(getSegmentColors.go) error parsing JSON data: %w", err)
	}

	lastModified, err := getLastModifiedTime(file)
	if err != nil {
		return nil, time.Time{}, fmt.Errorf("(getSegmentColors.go) error getting last modified time: %w", err)
	}

	return segmentData, lastModified, nil
}

func getSegmentFiles() ([]os.FileInfo, error) {
	segmentsFiles, err := os.ReadDir("Rstats/output/")
	if err != nil {
		return nil, err
	}

	if len(segmentsFiles) == 0 {
		Rstats.RunRiskModel()
		return nil, fmt.Errorf("no files found in output directory")
	}

	// Convert os.DirEntry to os.FileInfo and sort the files by modification time, most recent first
	fileInfos := make([]os.FileInfo, 0, len(segmentsFiles))
	for _, entry := range segmentsFiles {
		info, err := entry.Info()
		if err != nil {
			return nil, err
		}
		fileInfos = append(fileInfos, info)
	}

	sort.Slice(fileInfos, func(i, j int) bool {
		return fileInfos[i].ModTime().After(fileInfos[j].ModTime())
	})

	return fileInfos, nil
}

func getLastModifiedTime(file os.FileInfo) (time.Time, error) {
	modTime := file.ModTime()
	// Truncate time to the nearest second to match the precision typically used in HTTP headers
	modTime = modTime.Truncate(time.Second)
	return modTime, nil
}

func parseRiskModelJSON(fileData []byte) ([]utils.RiskModelJSON, error) {
	var segmentData []utils.RiskModelJSON
	if err := json.Unmarshal(fileData, &segmentData); err != nil {
		return nil, fmt.Errorf("(getSegmentColors.go) error unmarshalling JSON: %w", err)
	}
	return segmentData, nil
}
