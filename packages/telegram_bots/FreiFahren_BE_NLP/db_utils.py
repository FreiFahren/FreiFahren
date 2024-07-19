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
    # Prepare the JSON data payload
    data = {
        'timestamp': timestamp.isoformat(),
        'line': line,
        'station': station_id,
        'direction': direction_id,
        'author': 98111116, # ASCII code for 'Bot' to identefy messages sent by the bot
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
