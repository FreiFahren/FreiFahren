package logger

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"gopkg.in/natefinch/lumberjack.v2"

	"github.com/FreiFahren/backend/utils"
)

var wg sync.WaitGroup

var Log zerolog.Logger

type APIHook struct {
	Endpoint string
}

func (h *APIHook) Run(e *zerolog.Event, level zerolog.Level, message string) {
	if level >= zerolog.ErrorLevel {
		wg.Add(1)
		go func() {
			payload := map[string]string{
				"console_line": message,
				"system":       "backend",
			}
			Log.Info().Msg("Sending error to the API with the following payload: " + message)
			jsonPayload, err := json.Marshal(payload)
			if err != nil {
				return
			}

			// Make the POST request
			resp, err := http.Post(h.Endpoint, "application/json", bytes.NewBuffer(jsonPayload))
			if err != nil {
				return
			}
			defer resp.Body.Close()
			wg.Done()
		}()
	}
}

func Init() {

	envPath, err := utils.FindEnvFile()
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	err = godotenv.Load(envPath)
	if err != nil {
		log.Fatal("Error loading .env file")
	}

	logFile := &lumberjack.Logger{
		Filename:   "app.log",
		MaxSize:    10, // megabytes
		MaxBackups: 7,
		MaxAge:     7, // days
		Compress:   true,
		LocalTime:  true,
	}

	// Create a console writer
	consoleWriter := zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: "2006-01-02 15:04:05"}

	// Create a multi-writer that writes to both file and console
	multi := zerolog.MultiLevelWriter(logFile, consoleWriter)

	// only show the filename and line number
	zerolog.CallerMarshalFunc = func(_ uintptr, file string, line int) string {
		return filepath.Base(file) + ":" + strconv.Itoa(line)
	}

	// Use the multi-writer when creating the logger
	Log = zerolog.New(multi).Level(zerolog.DebugLevel).With().Timestamp().Caller().Logger()

	if os.Getenv("STATUS") != "dev" {
		apiEndpoint := os.Getenv("TELEGRAM_BOTS_URL") + "/report-failure"
		Log = Log.Hook(&APIHook{Endpoint: apiEndpoint})
	}
}
