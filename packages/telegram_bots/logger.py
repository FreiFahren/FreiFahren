import logging
import sys
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime, timezone


class CustomFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        local_time = datetime.fromtimestamp(record.created)
        return local_time.isoformat()


def setup_logger():
    logger = logging.getLogger(__name__)
    
    # Check if logger already has handlers
    if not logger.handlers:
        logger.setLevel(logging.DEBUG)  # Set the log level to DEBUG to capture all types of logs

        # rotate file at midnight and keep 7 days of logs
        file_handler = TimedRotatingFileHandler('app.log', when='midnight', interval=1, backupCount=7, utc=True)

        # Create console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.ERROR)

        # Create formatters and add it to handlers
        log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s (%(filename)s:%(lineno)d)'
        formatter = CustomFormatter(log_format)
        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)

        logger.addHandler(file_handler)
        logger.addHandler(console_handler)

    return logger