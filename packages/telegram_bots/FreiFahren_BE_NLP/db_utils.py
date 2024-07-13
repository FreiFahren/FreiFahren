from datetime import datetime
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
import requests
from telegram_bots.logger import setup_logger

logger = setup_logger()

def insert_ticket_info(
    timestamp: datetime,
    line,
    station_name,
    direction_name
):
    url = os.getenv('BACKEND_URL')
    if url is None:
        logger.error('BACKEND_URL is not set')
        return

    # Prepare the JSON data payload
    data = {
        'timestamp': timestamp.isoformat(),
        'line': line,
        'station': station_name,
        'direction': direction_name,
        'author': 98111116, # ASCII code for 'Bot' to identify telegram reports
        'message': None
    }

    headers = {
        'Content-Type': 'application/json'
    }
    
    response = requests.post(url + '/basics/inspectors', json=data, headers=headers)

    if response.status_code != 200:
        logger.error('Failed to send data to the backend. Status code: %s Response: %s', response.status_code, response.text)
        logger.debug('Failed request data: %s', data)
        logger.debug('Failed request headers: %s', headers)
    else:
        logger.info('Data sent to the backend successfully')
