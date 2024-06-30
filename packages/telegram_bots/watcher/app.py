from flask import Flask, request
from telegram_bots.config import DEV_CHAT_ID
from telegram_bots.watcher.bot import send_message
from telegram_bots import logger


app = Flask(__name__)
logger = logger.setup_logger()


@app.route('/report-failure', methods=['POST'])
def backend_failure() -> tuple:
    system_name = request.json.get('system', '')
    error_message = request.json.get('error_message', '')

    send_message(DEV_CHAT_ID, f'{system_name} send an error message: {error_message}.')

    logger.error(f'Received {system_name} failure: {error_message}.')

    return {'status': 'success'}, 200
