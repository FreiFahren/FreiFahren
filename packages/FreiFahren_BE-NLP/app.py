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

