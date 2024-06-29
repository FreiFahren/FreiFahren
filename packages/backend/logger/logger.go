package logger

import (
	"bytes"
	"encoding/json"
	"fmt"
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
	fmt.Println("APIHook Run")
	if level >= zerolog.ErrorLevel {
		wg.Add(1)
		go func() {
			fmt.Println("APIHook go func")
			// Prepare the payload
			payload := map[string]string{"error_message": message}
			jsonPayload, err := json.Marshal(payload)
			if err != nil {
				fmt.Println("Error marshalling JSON")
				return
			}

			// Make the POST request
			resp, err := http.Post(h.Endpoint, "application/json", bytes.NewBuffer(jsonPayload))
			if err != nil {
				fmt.Println("Error sending error message to API")
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

	Log = zerolog.New(logFile).With().Timestamp().Caller().Logger()

	// Set up API hook
	apiEndpoint := os.Getenv("WATCHER_HOST") + "/failure-report"
	Log.Hook(&APIHook{Endpoint: apiEndpoint})
}
