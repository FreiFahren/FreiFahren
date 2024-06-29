from datetime import datetime
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv
import requests
from logging_utils import setup_logger

logger = setup_logger()


def create_connection():
    load_dotenv()
    db_name = os.getenv('DB_NAME')
    db_user = os.getenv('DB_USER')
    db_password = os.getenv('DB_PASSWORD')
    db_host = os.getenv('DB_HOST')
    db_port = os.getenv('DB_PORT')

    conn = psycopg2.connect(dbname=db_name, user=db_user, password=db_password, host=db_host, port=db_port)
    if conn is None:
        logger.error('Failed to connect to the database')
        logger.debug('DB_NAME: %s, DB_USER: %s, DB_PASSWORD: %s, DB_HOST: %s, DB_PORT: %s', db_name, db_user, db_password, db_host, db_port)
        raise Exception('Failed to connect to the database')
    else:
        logger.info('Connected to the database')

    return conn


def create_table_if_not_exists():
    conn = create_connection()
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cursor = conn.cursor()
    cursor.execute(sql.SQL('''
        CREATE TABLE IF NOT EXISTS ticket_info (
            id SERIAL PRIMARY KEY,
            timestamp TIMESTAMP NOT NULL,
            message TEXT NOT NULL,
            author BIGINT NOT NULL,
            line VARCHAR(3),
            station_name VARCHAR(255),
            station_id VARCHAR(10),
            direction_name VARCHAR(255),
            direction_id VARCHAR(10)
        );
    '''))
    cursor.close()
    conn.close()


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
    
    response = requests.post(url + '/basics/newInspector', json=data, headers=headers)

    if response.status_code != 200:
        logger.error('Failed to send data to the backend. Status code: %s Response: %s', response.status_code, response.text)
        logger.debug('Failed request data: %s', data)
        logger.debug('Failed request headers: %s', headers)
    else:
        logger.info('Data sent to the backend successfully')
