from flask import Flask, request
import sys 
sys.path.append('../')

app = Flask(__name__)

@app.route('/healthcheck', methods=['GET'])
def backend_failure() -> tuple:
    return {'status': 'success'}, 200

@app.route('/send_message', methods=['POST'])
def send_message(_chat_id, _message) -> tuple:
    chat_id = request.json.get(_chat_id, '')
    message = request.json.get(_message, '')
    
    send_message(chat_id, message)
    
    return {'status': 'success'}, 200
