from flask import Flask, request
from config import DEV_CHAT_ID
from bot import send_message, watcherbot
from logger import logger


app = Flask(__name__)

@app.route('/report-failure', methods=['POST'])
def backend_failure() -> tuple:
    system_name = request.json.get('system', '')
    error_message = request.json.get('error_message', '')
    
    send_message(DEV_CHAT_ID, f'{system_name} send an error message: {error_message} in file {file_name}')
    
    logger.error(f'Received {system_name} failure: {error_message} in file {file_name}')
    
    return {'status': 'success'}, 200

