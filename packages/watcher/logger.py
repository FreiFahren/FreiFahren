import logging
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime

class CustomFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        # Convert timestamp to local time and format to ISO 8601
        local_time = datetime.fromtimestamp(record.created)  # Assumes local timezone
        
        return local_time.isoformat()


def setup_logger():
    logger = logging.getLogger(__name__)
    
    # Check if logger already has handlers
    if not logger.handlers:
        logger.setLevel(logging.DEBUG)  # Set the log level to DEBUG to capture all types of logs

        # rotate file at midnight and keep 7 days of logs
        file_handler = TimedRotatingFileHandler('app.log', when='midnight', interval=1, backupCount=7, utc=True)

        # Create formatters and add it to handlers
        log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s (%(filename)s:%(lineno)d)'
        formatter = CustomFormatter(log_format)
        file_handler.setFormatter(formatter)

        logger.addHandler(file_handler)

    return logger
