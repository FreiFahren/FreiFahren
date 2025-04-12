package logger

import (
	"log"
	"os"
	"path/filepath"
	"strconv"

	"github.com/FreiFahren/backend/utils"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"gopkg.in/natefinch/lumberjack.v2"
)

var Log zerolog.Logger

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
}
