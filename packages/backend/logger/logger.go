package logger

import (
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

	Log = zerolog.New(logFile).With().Timestamp().Caller().Logger()
}
