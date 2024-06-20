from datetime import datetime
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv
import requests


def create_connection():
    load_dotenv()
    db_name = os.getenv('DB_NAME')
    db_user = os.getenv('DB_USER')
    db_password = os.getenv('DB_PASSWORD')
    db_host = os.getenv('DB_HOST')
    db_port = os.getenv('DB_PORT')
    conn = psycopg2.connect(dbname=db_name, user=db_user, password=db_password, host=db_host, port=db_port)
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
    print('created table')
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
        print('BACKEND_URL is not set')
        return

    # Prepare the JSON data payload
    data = {
        'timestamp': timestamp.isoformat(),
        'line': line,
        'station': station_name,
        'direction': direction_name,
        'author': None,
        'message': 'BOT'
    }

    headers = {
        'Content-Type': 'application/json'
    }
    
    response = requests.post(url + '/basics/newInspector', json=data, headers=headers)

    if response.status_code != 200:

        print('Failed to send data to the backend. Status code:', response.status_code, 'Response:', response.text)
