from flask import Flask, request
from telegram_bots.logger import setup_logger
from telegram_bots.bot_utils import send_message
from telegram_bots.config import FREIFAHREN_CHAT_ID
from telegram_bots.FreiFahren_BE_NLP.bot import nlp_bot

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

    telegram_message = 'Über app.freifahren.org gab es folgende Meldung:'
    telegram_message += '\n'
    telegram_message += f'\n<b>Station</b>: {station}'
    if line:
        telegram_message += f'\n<b>Line</b>: {line}'
    if direction:
        telegram_message += f'\n<b>Richtung</b>: {direction}'
    if message:
        telegram_message += f'\n<b>Beschreibung</b>: {message}'
    
    # commented due to not being released yet
    #send_message(FREIFAHREN_CHAT_ID, telegram_message, nlp_bot)

    return {'status': 'success'}, 200
