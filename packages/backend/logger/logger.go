package logger

import (
	"path/filepath"
	"strconv"

	"github.com/rs/zerolog"
	"gopkg.in/natefinch/lumberjack.v2"
)

var Log zerolog.Logger

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
}
