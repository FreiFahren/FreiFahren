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


def fetch_id(name, entity_type):
    if not name:
        return None

    url = f"{BACKEND_URL}/data/id?name={name}"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()  # Raises an HTTPError for bad responses (4xx or 5xx)
        
        station_id = response.text
        
        if station_id:
            logger.info(f"Received {entity_type} id from the backend: {station_id}")
            return station_id
        else:
            logger.error(f"Unexpected response format from backend: {data}")
            return None

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 404:
            logger.info(f"Station not found: {e.response.json().get('error', 'No error message provided')}")
        else:
            logger.error(f"HTTP error occurred: {e}")
        return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching {entity_type} id: {e}")
        return None
    except ValueError as e:  # Includes JSONDecodeError
        logger.error(f"Error decoding JSON response: {e}")
        return None
