package logger

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/rs/zerolog"
	"gopkg.in/natefinch/lumberjack.v2"
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
				"error_message": message,
				"system":        "backend",
			}
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
	logFile := &lumberjack.Logger{
		Filename:   "app.log",
		MaxSize:    10, // megabytes
		MaxBackups: 7,
		MaxAge:     7, // days
		Compress:   true,
		LocalTime:  true,
	}

	// only show the filename and line number
	zerolog.CallerMarshalFunc = func(_ uintptr, file string, line int) string {
		return filepath.Base(file) + ":" + strconv.Itoa(line)
	}

	Log = zerolog.New(logFile).Level(zerolog.DebugLevel).With().Timestamp().Caller().Logger()

	apiEndpoint := os.Getenv("WATCHER_HOST") + "/report-failure"
	Log = Log.Hook(&APIHook{Endpoint: apiEndpoint})
}
