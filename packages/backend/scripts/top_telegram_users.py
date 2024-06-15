import psycopg2
import os
from dotenv import load_dotenv


def create_connection():
    load_dotenv()
    db_name = os.getenv('DB_NAME')
    db_user = os.getenv('DB_USER')
    db_password = os.getenv('DB_PASSWORD')
    db_host = os.getenv('DB_HOST')
    db_port = os.getenv('DB_PORT')
    conn = psycopg2.connect(dbname=db_name, user=db_user, password=db_password, host=db_host, port=db_port)
    return conn


def get_top_author_ids():
    conn = create_connection()
    cur = conn.cursor()
    query = """
        SELECT author, COUNT(*) as count
        FROM ticket_info
        WHERE author IS NOT NULL
        GROUP BY author
        ORDER BY count DESC
        LIMIT 20
    """
    cur.execute(query)
    result = cur.fetchall()
    cur.close()
    conn.close()
    return [item[0] for item in result]


def get_last_message_for_author(author_id):
    conn = create_connection()
    cur = conn.cursor()
    query = f"""
        SELECT message
        FROM ticket_info
        WHERE author = '{author_id}'
        ORDER BY timestamp DESC
        LIMIT 1
    """
    cur.execute(query)
    result = cur.fetchone()
    cur.close()
    conn.close()
    return result[0]


if __name__ == '__main__':
    top_author_ids = get_top_author_ids()
    for author_id in top_author_ids:
        last_message = get_last_message_for_author(author_id)
        print(f'Author: {author_id}, last message: {last_message}')