package getSegmentColors

import (
	"encoding/json"
	"net/http"
	"os"
	"sort"
	"time"

	"github.com/FreiFahren/backend/Rstats"
	"github.com/FreiFahren/backend/caching"
	_ "github.com/FreiFahren/backend/docs"
	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
	"github.com/labstack/echo/v4"
)

// @Summary Get risk colors for segments
//
// @Description Fetches the latest risk assessments for transit segments, returned as color codes representing the risk level. You can find out more about the risk level calculation in the documentation.
// @Description The response includes the last modified timestamp of the risk model data to support conditional GET requests.
//
// @Tags Risk Prediction
//
// @Accept json
// @Produce json
//
// @Param If-Modified-Since header string false "Standard HTTP header used to make conditional requests; the response will include the risk colors only if they have changed since this date and time."
//
// @Success 200 {object} utils.RiskModelResponse "Successfully retrieved the color-coded risk levels for each segment."
// @Success 304 {none} nil "No changes: The data has not been modified since the last request date provided in the 'If-Modified-Since' header."
// @Failure 500 "Internal Server Error: Error during the processing of the request."
//
// @Router /risk-prediction/segment-colors [get]
func GetSegmentColors(c echo.Context) error {
	logger.Log.Info().Msg("GET /risk-prediction/segment-colors")

	segmentsFiles, err := getSegmentFiles()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error reading Rstats directory")
		return c.NoContent(http.StatusInternalServerError)
	}

	segmentColors, lastModified, err := loadAndParseRiskModelOutput(segmentsFiles[0])
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error loading risk model file")
		return c.NoContent(http.StatusInternalServerError)
	}

	ifModifiedSince := c.Request().Header.Get("If-Modified-Since")
	modifiedSince, err := caching.CheckIfModifiedSince(ifModifiedSince, lastModified)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error checking if the data has been modified")
		return c.NoContent(http.StatusInternalServerError)
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

	RiskModelResponse := utils.RiskModelResponse{
		LastModified:  lastModified.Format("2006-01-02T15:04:05Z07:00"),
		SegmentColors: segmentColorsMap,
	}

	return c.JSONPretty(http.StatusOK, RiskModelResponse, "  ")
}

func loadAndParseRiskModelOutput(file os.FileInfo) ([]utils.RiskModelJSON, time.Time, error) {
	logger.Log.Debug().Msg("Loading and parsing risk model output")

	filePath := "Rstats/output/" + file.Name()

	fileData, err := os.ReadFile(filePath)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error reading file")
		return nil, time.Time{}, err
	}

	segmentData, err := parseRiskModelJSON(fileData)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error parsing JSON data")
		return nil, time.Time{}, err
	}

	lastModified, err := getLastModifiedTime(file)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error getting last modified time")
		return nil, time.Time{}, err
	}

	return segmentData, lastModified, nil
}

func getSegmentFiles() ([]os.FileInfo, error) {
	logger.Log.Debug().Msg("Getting segment files")

	segmentsFiles, err := os.ReadDir("Rstats/output/")
	if err != nil {
		logger.Log.Error().Err(err).Msg("Error reading Rstats directory")
		return nil, err
	}

	if len(segmentsFiles) == 0 {
		Rstats.RunRiskModel()
		err := os.ErrNotExist

		logger.Log.Error().Err(err).Msg("No files found in output directory")
		return nil, err
	}

	// Convert os.DirEntry to os.FileInfo and sort the files by modification time, most recent first
	fileInfos := make([]os.FileInfo, 0, len(segmentsFiles))
	for _, entry := range segmentsFiles {
		info, err := entry.Info()
		if err != nil {
			logger.Log.Error().Err(err).Msg("Error getting file info")
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
	logger.Log.Debug().Msg("Getting last modified time")

	modTime := file.ModTime().UTC()
	// Truncate time to the nearest second to match the precision typically used in HTTP headers
	modTime = modTime.Truncate(time.Second)
	return modTime, nil
}

func parseRiskModelJSON(fileData []byte) ([]utils.RiskModelJSON, error) {
	logger.Log.Debug().Msg("Parsing risk model JSON")

	var segmentColorMap map[string]string
	if err := json.Unmarshal(fileData, &segmentColorMap); err != nil {
		logger.Log.Error().Err(err).Msg("Error unmarshalling JSON")
		return nil, err
	}

	// Convert map to array of RiskModelJSON
	var segmentData []utils.RiskModelJSON
	for sid, color := range segmentColorMap {
		segmentData = append(segmentData, utils.RiskModelJSON{
			Sid:   sid,
			Color: color,
		})
	}

	return segmentData, nil
}
