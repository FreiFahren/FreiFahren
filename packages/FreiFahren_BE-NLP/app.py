from flask import Flask, request
from logging_utils import setup_logger
import sys 
sys.path.append('../')

app = Flask(__name__)

logger = setup_logger()

@app.route('/healthcheck', methods=['GET'])
def backend_failure() -> tuple:
    logger.info('Healthcheck endpoint was hit with a healthcheck call.')
    return {'status': 'success'}, 200

@app.route('/send_message', methods=['POST'])
def send_message() -> tuple:
    chat_id = request.json.get('chat_id', '')
    message = request.json.get('message', '')
    logger.info(f'Send message endpoint was hit with a send message call: {chat_id}, {message}')
    
    send_message(chat_id, message)
    
    return {'status': 'success'}, 200
