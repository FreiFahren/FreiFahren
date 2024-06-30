from flask import Flask, request
from telegram_bots.logger import setup_logger
from telegram_bots.bot import send_message
from telegram_bots.config import FREIFAHREN_CHAT_ID

app = Flask(__name__)

logger = setup_logger()

@app.route('/healthcheck', methods=['GET'])
def backend_failure() -> tuple:
    logger.info('Healthcheck endpoint was hit with a healthcheck call.')
    return {'status': 'success'}, 200


@app.route('/report-inspector', methods=['POST'])
def report_inspector() -> tuple:
    line = request.json.get('line', None)
    station = request.json.get('station', None)
    direction = request.json.get('direction', None)
    message = request.json.get('message', None)

    logger.info(f'Received a report from an inspector: Line: {line}, Station: {station}, Direction: {direction}, Message: {message}')

    telegram_message = ' Über app.freifahren.org gab es folgende Meldung:'
    telegram_message += f'\nStation: {station}'
    if line:
        telegram_message += f'\nLine: {line}'
    if direction:
        telegram_message += f'\nRichtung: {direction}'
    if message:
        telegram_message += f'\nBeschreibung: {message}'
    
    send_message(FREIFAHREN_CHAT_ID, telegram_message)

    return {'status': 'success'}, 200
