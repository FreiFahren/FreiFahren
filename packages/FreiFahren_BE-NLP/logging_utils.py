import logging
from logging.handlers import TimedRotatingFileHandler
from datetime import datetime, timezone

class CustomFormatter(logging.Formatter):
    def formatTime(self, record, datefmt=None):
        # Convert timestamp to UTC and format to ISO 8601
        utc_time = datetime.fromtimestamp(record.created, timezone.utc)
        if record.levelno == logging.INFO:
            # Round to the nearest minute to avoid storing data with which the user could be identified
            modified = utc_time.replace(second=0, microsecond=0)
        else:
            # Keep full timestamp for other levels
            modified = utc_time
        
        return modified.isoformat()

def setup_logger():
    # Create a custom logger
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.DEBUG)  # Set the log level to DEBUG to capture all types of logs

    # Keep no backups, for data minimization purposes
    file_handler = TimedRotatingFileHandler('app.log', when='midnight', interval=1, backupCount=0, utc=True)

    # Create formatters and add it to handlers
    log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s (%(filename)s:%(lineno)d)'
    formatter = CustomFormatter(log_format)
    file_handler.setFormatter(formatter)

    logger.addHandler(file_handler)

    return logger
