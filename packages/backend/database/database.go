package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
	"github.com/lib/pq"
	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

func OpenDB() error {
	var err error

	p, err := sql.Open("sqlite3", os.Getenv("DB_URL")+"?_time_format=sqlite")
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to create a connection pool")
	}

	db = p

	return nil
}
func CloseDB() {
	if db != nil {
		db.Close()
	}
}

func InsertTicketInfo(timestamp *time.Time, author *int64, message, line, stationName, stationId, directionName, directionId *string) error {
	logger.Log.Debug().Msg("Inserting ticket info")

	sql := `
    INSERT INTO ticket_info (timestamp, message, author, line, station_name, station_id, direction_name, direction_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `

	// Convert *string and *int64 directly to interface{} for pgx
	values := []interface{}{timestamp, message, author, line, stationName, stationId, directionName, directionId}

	logger.Log.Info().Msg("Inserting ticket info into the database")
	_, err := db.Exec(sql, values...)

	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to insert ticket info")
		return err
	}
	return nil
}

func getLastNonHistoricTimestamp() (*time.Time, error) {
	var err error
	logger.Log.Debug().Msg("Getting last non-historic timestamp")

	sqlTimestamp := `
        SELECT MAX(timestamp)
        FROM ticket_info;
    `
	row := db.QueryRow(sqlTimestamp)
	var lastNonHistoricTimestampString sql.NullString
	if err = row.Scan(&lastNonHistoricTimestampString); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get last non-historic timestamp")
		return nil, err
	}

	if !lastNonHistoricTimestampString.Valid {
		return nil, nil
	}

	var lastNonHistoricTimestamp time.Time
	lastNonHistoricTimestamp, err = time.Parse("2006-01-02 15:04:05", lastNonHistoricTimestampString.String)

	if err != nil {
		return nil, fmt.Errorf("failed to parse timestamp: %v", err)
	}

	return &lastNonHistoricTimestamp, nil
}

func executeGetHistoricStationsSQL(hour, weekday, remaining int, excludedStationIDs []string, lastNonHistoricTimestamp time.Time) ([]utils.TicketInspector, error) {
	logger.Log.Debug().Msg("Executing SQL query to get historic stations")

	sql := `
		SELECT station_id
		FROM ticket_info
		WHERE strftime('%H', timestamp) = ?1
			AND strftime('%w', timestamp) = ?2
			AND station_name IS NOT NULL
			AND station_id IS NOT NULL
			AND station_id NOT IN (SELECT value FROM json_each(?4))
		GROUP BY station_id
		ORDER BY COUNT(station_id) DESC
		LIMIT ?3;`

	// Remove any newlines and spaces from the excluded station IDs
	for i, station := range excludedStationIDs {
		if strings.Contains(station, "\n") {
			station = strings.ReplaceAll(station, "\n", "")
			station = strings.ReplaceAll(station, " ", "")
			excludedStationIDs[i] = station
		}
	}

	rows, err := db.Query(sql, hour, weekday, remaining, pq.Array(excludedStationIDs))
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to execute SQL query")
		return nil, err
	}
	defer rows.Close()

	var ticketInfoList []utils.TicketInspector
	for rows.Next() {
		var ticketInfo utils.TicketInspector
		if err := rows.Scan(&ticketInfo.StationID); err != nil {
			logger.Log.Error().Err(err).Msg("Error scanning row")
			return nil, err
		}

		// Set parameters for historic data
		ticketInfo.Timestamp = lastNonHistoricTimestamp
		ticketInfo.IsHistoric = true
		ticketInfoList = append(ticketInfoList, ticketInfo)
	}

	if err := rows.Err(); err != nil {
		logger.Log.Error().Err(err).Msg("Error iterating rows")
		return nil, err
	}

	return ticketInfoList, nil
}

func GetHistoricStations(
	timestamp time.Time,
	remaining int,
	maxRecursiveCalls int,
	excludedStationIDs []string,
) ([]utils.TicketInspector, error) {
	logger.Log.Debug().Msg("Getting historic stations")

	if maxRecursiveCalls < 0 {
		return nil, fmt.Errorf("maximum recursion depth exceeded")
	}

	lastNonHistoricTimestamp, err := getLastNonHistoricTimestamp()
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get last non-historic timestamp")
		return nil, err
	}

	if lastNonHistoricTimestamp == nil {
		return []utils.TicketInspector{}, nil
	}

	hour := timestamp.Hour()
	weekday := int(timestamp.Weekday())

	ticketInfoList, err := executeGetHistoricStationsSQL(hour, weekday, remaining, excludedStationIDs, *lastNonHistoricTimestamp)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to execute get historic stations SQL")
		return nil, err
	}

	// Decrease remaining by the number of new stations
	remaining -= len(ticketInfoList)

	if remaining > 0 && maxRecursiveCalls > 0 {
		broaderTimestamp := timestamp.Add(-1 * time.Hour)
		// Add the new station IDs to the list of excluded station IDs
		for _, ticketInfo := range ticketInfoList {
			excludedStationIDs = append(excludedStationIDs, ticketInfo.StationID)
		}

		moreTicketInfoList, err := GetHistoricStations(broaderTimestamp, remaining, maxRecursiveCalls-1, excludedStationIDs)
		if err != nil {
			logger.Log.Error().Err(err).Msg("Failed to get more historic stations")
			return nil, err
		}

		ticketInfoList = append(ticketInfoList, moreTicketInfoList...)
	}

	return ticketInfoList, nil
}

func GetLatestTicketInspectors() ([]utils.TicketInspector, error) {
	logger.Log.Debug().Msg("Getting latest ticket inspectors")

	sql := `
		SELECT timestamp, station_id, direction_id, line,
		CASE WHEN author IS NULL THEN  message ELSE NULL END AS message 
		FROM ticket_info
		WHERE station_name IS NOT NULL AND station_id IS NOT NULL;`
	// WHERE datetime(timestamp) >= datetime('now', '-60 minutes')

	logger.Log.Info().Msg("Getting latest ticket inspectors")

	rows, err := db.Query(sql)

	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get latest ticket inspectors")
		return nil, err
	}

	defer rows.Close()

	var ticketInfoList []utils.TicketInspector

	for rows.Next() {
		var ticketInfo utils.TicketInspector
		if err := rows.Scan(&ticketInfo.Timestamp, &ticketInfo.StationID, &ticketInfo.DirectionID, &ticketInfo.Line, &ticketInfo.Message); err != nil {
			logger.Log.Error().Err(err).Msg("Error scanning row")
			return nil, err
		}
		// logger.Log.Debug().Msgf("Timestamp: %v, StationID: %s, DirectionID: %s, Line: %s, Message: %s", ticketInfo.Timestamp, ticketInfo.StationID, ticketInfo.DirectionID, ticketInfo.Line, ticketInfo.Message)
		ticketInfoList = append(ticketInfoList, ticketInfo)
	}

	if err := rows.Err(); err != nil {
		logger.Log.Error().Err(err).Msg("Error iterating rows")
		return nil, err
	}

	return ticketInfoList, nil
}

func GetLatestUpdateTime() (time.Time, error) {
	logger.Log.Debug().Msg("Getting latest update time")

	var lastUpdateTimeString string

	sql := `SELECT MAX(timestamp) FROM ticket_info;`

	err := db.QueryRow(sql).Scan(&lastUpdateTimeString)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get latest update time")
		return time.Time{}, err
	}

	var lastUpdateTime time.Time
	lastUpdateTime, err = time.Parse("2006-01-02 15:04:05", lastUpdateTimeString)

	if err != nil {
		log.Fatalf("Failed to parse timestamp: %v\n", err)
	}

	return lastUpdateTime, nil
}

func GetNumberOfSubmissionsInLast24Hours() (int, error) {
	logger.Log.Debug().Msg("Getting number of submissions in last 24 hours")

	var count int

	sql := `
		SELECT COUNT(*) 
		FROM ticket_info 
		WHERE timestamp >= datetime('now', '-24 hours');`

	err := db.QueryRow(sql).Scan(&count)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get number of submissions in last 24 hours")
		return 0, err
	}

	return count, nil
}

func RoundOldTimestamp() {
	logger.Log.Debug().Msg("Rounding old timestamps")

	sql := `
		UPDATE ticket_info
		SET timestamp = strftime('%Y-%m-%d %H:00:00', timestamp)
		WHERE timestamp < datetime('now', '-4 hours');`

	_, err := db.Exec(sql)
	if err != nil {
		logger.Log.Panic().Err(err).Msg("Failed to round old timestamps")
	}
}
