package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/FreiFahren/backend/logger"
	"github.com/FreiFahren/backend/utils"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lib/pq"
)

var pool *pgxpool.Pool
var DB_URL string

func Config() *pgxpool.Config {
	const defaultMaxConns = int32(4)
	const defaultMinConns = int32(0)
	const defaultMaxConnLifetime = time.Hour
	const defaultMaxConnIdleTime = time.Minute * 30
	const defaultHealthCheckPeriod = time.Minute
	const defaultConnectTimeout = time.Second * 5

	DB_URL = fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"))

	dbConfig, err := pgxpool.ParseConfig(DB_URL)
	if err != nil {
		log.Fatal("(database.go) Failed to create a config, error: ", err)
	}

	dbConfig.MaxConns = defaultMaxConns
	dbConfig.MinConns = defaultMinConns
	dbConfig.MaxConnLifetime = defaultMaxConnLifetime
	dbConfig.MaxConnIdleTime = defaultMaxConnIdleTime
	dbConfig.HealthCheckPeriod = defaultHealthCheckPeriod
	dbConfig.ConnConfig.ConnectTimeout = defaultConnectTimeout

	dbConfig.BeforeAcquire = func(ctx context.Context, c *pgx.Conn) bool {
		return true
	}

	dbConfig.AfterRelease = func(c *pgx.Conn) bool {
		return true
	}

	dbConfig.BeforeClose = func(c *pgx.Conn) {
	}

	return dbConfig
}

func CreatePool() {
	logger.Log.Debug().Msg("Creating connection pool to the database")

	var err error

	p, err := pgxpool.NewWithConfig(context.Background(), Config())
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to create a connection pool")
	}

	pool = p

}
func ClosePool() {
	logger.Log.Info().Msg("Closing connection pool to the database")

	if pool != nil {
		pool.Close()
	}
}

func BackupDatabase() {
	logger.Log.Debug().Msg("Backing up database")

	conn, err := pgx.Connect(context.Background(), DB_URL)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to connect to the database")
	}
	defer conn.Close(context.Background())

	// format means: Mon Jan 2 15:04:05 MST 2006
	backupTableName := "backup_" + time.Now().UTC().Format("20060102_150405")
	query := fmt.Sprintf("CREATE TABLE %s AS SELECT * FROM reports", backupTableName)

	_, err = conn.Exec(context.Background(), query)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to backup the database")
	}
}

func CreateReportsTable() {
	logger.Log.Debug().Msg("Creating table reports")

	sql := `
	CREATE TABLE IF NOT EXISTS reports (
		id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
		timestamp TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
		message TEXT,
		author BIGINT,
		line VARCHAR(3),
		station_id VARCHAR(250),
		direction_id VARCHAR(250)
	);
	`

	_, err := pool.Exec(context.Background(), sql)
	if err != nil {
		logger.Log.Panic().Err(err).Msg("Failed to create table")
	}
	logger.Log.Info().Msg("Created table reports")
}

func CreateFeedbackTable() {
	logger.Log.Debug().Msg("Creating table feedback")

	sql := `
	CREATE TABLE IF NOT EXISTS feedback (
		id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
		timestamp TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),
		feedback TEXT NOT NULL
	);
	`

	_, err := pool.Exec(context.Background(), sql)
	if err != nil {
		logger.Log.Panic().Err(err).Msg("Failed to create feedback table")
	}
	logger.Log.Info().Msg("Created table feedback")
}

func InsertTicketInfo(timestamp *time.Time, author *int64, message, line, stationId, directionId *string) error {
	logger.Log.Debug().Msg("Inserting ticket info")

	sql := `
    INSERT INTO reports (timestamp, message, author, line, station_id, direction_id)
    VALUES ($1, $2, $3, $4, $5, $6);
    `

	// Convert *string and *int64 directly to interface{} for pgx
	values := []interface{}{timestamp, message, author, line, stationId, directionId}

	logger.Log.Info().Msg("Inserting ticket info into the database")
	_, err := pool.Exec(context.Background(), sql, values...)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to insert ticket info")
		return err
	}
	return nil
}

func InsertFeedback(feedback string) error {
	logger.Log.Debug().Msg("Inserting feedback")

	sql := `
	INSERT INTO feedback (feedback)
	VALUES ($1);
	`

	_, err := pool.Exec(context.Background(), sql, feedback)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to insert feedback")
		return err
	}
	return nil
}

func getLastNonHistoricTimestamp() (time.Time, error) {
	logger.Log.Debug().Msg("Getting last non-historic timestamp")

	sqlTimestamp := `
        SELECT MAX(timestamp)
        FROM reports;
    `
	row := pool.QueryRow(context.Background(), sqlTimestamp)
	var lastNonHistoricTimestamp time.Time
	if err := row.Scan(&lastNonHistoricTimestamp); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get last non-historic timestamp")
		return time.Time{}, err
	}
	return lastNonHistoricTimestamp, nil
}

func executeGetHistoricStationsSQL(hour, weekday, remaining int, excludedStationIds []string, lastNonHistoricTimestamp time.Time) ([]utils.TicketInspector, error) {
	logger.Log.Debug().Msg("Executing SQL query to get historic stations")

	sql := `
        SELECT (station_id)
        FROM reports
        WHERE EXTRACT(HOUR FROM timestamp) = $1 AND EXTRACT(DOW FROM timestamp) = $2
        AND station_id IS NOT NULL
        AND NOT (station_id = ANY($4))
        GROUP BY station_id
        ORDER BY COUNT(station_id) DESC
        LIMIT $3;
    `

	// Remove any newlines and spaces from the excluded station Ids
	for i, station := range excludedStationIds {
		if strings.Contains(station, "\n") {
			station = strings.ReplaceAll(station, "\n", "")
			station = strings.ReplaceAll(station, " ", "")
			excludedStationIds[i] = station
		}
	}

	rows, err := pool.Query(context.Background(), sql, hour, weekday, remaining, pq.Array(excludedStationIds))
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to execute SQL query")
		return nil, err
	}
	defer rows.Close()

	var ticketInfoList []utils.TicketInspector
	for rows.Next() {
		var ticketInfo utils.TicketInspector
		if err := rows.Scan(&ticketInfo.StationId); err != nil {
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
	startTime time.Time,
	remaining int,
	maxRecursiveCalls int,
	excludedStationIds []string,
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

	hour := startTime.Hour()
	weekday := int(startTime.Weekday())

	ticketInfoList, err := executeGetHistoricStationsSQL(hour, weekday, remaining, excludedStationIds, lastNonHistoricTimestamp)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to execute get historic stations SQL")
		return nil, err
	}

	// Decrease remaining by the number of new stations
	remaining -= len(ticketInfoList)

	if remaining > 0 && maxRecursiveCalls > 0 {
		broaderTimestamp := startTime.Add(-1 * time.Hour)
		// Add the new station Ids to the list of excluded station Ids
		for _, ticketInfo := range ticketInfoList {
			excludedStationIds = append(excludedStationIds, ticketInfo.StationId)
		}

		moreTicketInfoList, err := GetHistoricStations(broaderTimestamp, remaining, maxRecursiveCalls-1, excludedStationIds)
		if err != nil {
			logger.Log.Error().Err(err).Msg("Failed to get more historic stations")
			return nil, err
		}

		ticketInfoList = append(ticketInfoList, moreTicketInfoList...)
	}

	return ticketInfoList, nil
}

func GetLatestTicketInspectors(start, end time.Time, stationId string) ([]utils.TicketInspector, error) {
	logger.Log.Debug().Msg("Getting latest ticket inspectors")

	var sql string
	var rows pgx.Rows
	var err error

	if stationId != "" {
		logger.Log.Debug().Str("stationId", stationId).Msg("Filtering by station ID")
		sql = `SELECT timestamp, station_id, direction_id, line,
                CASE WHEN author IS NULL THEN message ELSE NULL END as message
                FROM reports
                WHERE timestamp >= $1 AND timestamp <= $2
                AND station_id IS NOT NULL
                AND station_id = $3;`

		rows, err = pool.Query(context.Background(), sql, start, end, stationId)
	} else {
		sql = `SELECT timestamp, station_id, direction_id, line,
                CASE WHEN author IS NULL THEN message ELSE NULL END as message
                FROM reports
                WHERE timestamp >= $1 AND timestamp <= $2
                AND station_id IS NOT NULL;`

		rows, err = pool.Query(context.Background(), sql, start, end)
	}

	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get latest ticket inspectors")
		return nil, err
	}

	defer rows.Close()

	var ticketInfoList []utils.TicketInspector

	for rows.Next() {
		var ticketInfo utils.TicketInspector
		if err := rows.Scan(&ticketInfo.Timestamp, &ticketInfo.StationId, &ticketInfo.DirectionId, &ticketInfo.Line, &ticketInfo.Message); err != nil {
			logger.Log.Error().Err(err).Msg("Error scanning row")
			return nil, err
		}
		ticketInfoList = append(ticketInfoList, ticketInfo)
	}

	if err := rows.Err(); err != nil {
		logger.Log.Error().Err(err).Msg("Error iterating rows")
		return nil, err
	}

	return ticketInfoList, nil
}

func GetLatestUpdateTime() (time.Time, error) {
	var lastUpdateTime time.Time

	sql := `SELECT MAX(timestamp) FROM reports;`

	err := pool.QueryRow(context.Background(), sql).Scan(&lastUpdateTime)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get latest update time")
		return time.Time{}, err
	}

	return lastUpdateTime, nil
}

func GetNumberOfSubmissionsInLast24Hours() (int, error) {
	logger.Log.Debug().Msg("Getting number of submissions in last 24 hours")

	var count int

	sql := `SELECT COUNT(*) FROM reports WHERE timestamp >= NOW() AT TIME ZONE 'UTC' - INTERVAL '24 hours';`

	err := pool.QueryRow(context.Background(), sql).Scan(&count)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get number of submissions in last 24 hours")
		return 0, err
	}

	return count, nil
}

func RoundOldTimestamp() {
	logger.Log.Debug().Msg("Rounding old timestamps")

	sql := `UPDATE reports SET timestamp = DATE_TRUNC('hour', timestamp) WHERE timestamp < NOW() AT TIME ZONE 'UTC' - INTERVAL '4 hour';`

	_, err := pool.Exec(context.Background(), sql)
	if err != nil {
		logger.Log.Panic().Err(err).Msg("Failed to round old timestamps")
	}
}

// Gets the the station id that is most common in the given list of stations.
//
// Parameters:
//   - stations: A list of station Ids.
//
// Returns:
//   - The most common station Id.
//   - An error if something went wrong.
func GetMostCommonStationId(stations []string) (string, error) {
	logger.Log.Debug().Msg("Getting most common station Id")

	sql := `
        SELECT station_id
        FROM reports
        WHERE station_id = ANY($1)
        GROUP BY station_id
        ORDER BY COUNT(*) DESC
        LIMIT 1
    `

	rows, err := pool.Query(context.Background(), sql, pq.Array(stations))
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get most common station Id")
		return "", err
	}
	defer rows.Close()

	var stationId string
	if rows.Next() {
		if err := rows.Scan(&stationId); err != nil {
			logger.Log.Error().Err(err).Msg("Error scanning row")
			return "", err
		}
	}

	return stationId, nil
}

// GetNumberOfReports gets the number of reports for a given station and line.
//
// Will filter by station and line if they are not empty. Returns 0 if no reports are found.
func GetNumberOfReports(stationId, lineId string, startTime, endTime time.Time) (int, error) {
	logger.Log.Debug().Msgf("Getting number of reports for station %s and line %s", stationId, lineId)

	sql := `SELECT COUNT(*) FROM reports WHERE timestamp >= $1 AND timestamp <= $2`
	params := []interface{}{startTime, endTime}
	paramCount := 2

	if stationId != "" {
		paramCount++
		sql += fmt.Sprintf(" AND station_id = $%d", paramCount)
		params = append(params, stationId)
	}

	if lineId != "" {
		paramCount++
		sql += fmt.Sprintf(" AND line = $%d", paramCount)
		params = append(params, lineId)
	}

	sql += ";"

	var count int
	err := pool.QueryRow(context.Background(), sql, params...).Scan(&count)
	if err != nil {
		logger.Log.Error().Err(err).Msg("Failed to get number of reports")
		return 0, err
	}

	return count, nil
}
