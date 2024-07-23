from datetime import datetime
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
import requests
from telegram_bots.logger import setup_logger
from telegram_bots.config import BACKEND_URL

logger = setup_logger()

def insert_ticket_info(
    timestamp: datetime,
    line,
    station_id,
    direction_id,
):

    logger.info('Inserting ticket info into the database')
    logger.debug('Timestamp: %s, Line: %s, Station: %s, Direction: %s', timestamp, line, station_id, direction_id)

    # Prepare the JSON data payload
    url = BACKEND_URL + '/basics/inspectors'
    data = {
        'timestamp': timestamp.isoformat(),
        'line': line,
        'stationId': station_id,
        'directionId': direction_id,
        'author': 98111116, # ASCII code for 'Bot' to identefy messages sent by the bot
        'message': None
    }
    headers = {
        'Content-Type': 'application/json'
    }
    
    response = requests.post(url, json=data, headers=headers)

    if response.status_code != 200:
        logger.error('Failed to send data to the url: %s. Status code: %s Response: %s', url, response.status_code, response.text)
        logger.debug('Failed request data: %s', data)
        logger.debug('Failed request headers: %s', headers)
    else:
        logger.info('Data sent to the backend successfully')
        logger.debug("data: %s", data)
