import time
from config import DEV_CHAT_ID, BACKEND_URL, NLP_BOT_URL
from bot import start_bot, watcherbot, send_message
from healthcheck import check_backend_status, do_healthcheck, check_nlp_bot_status
from app import app
from logger import logger

import threading
import subprocess


def start_nlp_bot_process():
    # Run the NLP bot process. All errors will be received
    nlp_bot = subprocess.Popen(['python3', '../FreiFahren_BE-NLP/main.py'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    # Continuously read its output. 
    # If we have receive a console_line, it has to be an error
    for console_line in iter(nlp_bot.stdout.readline, b''):
        console_line = console_line.decode().strip()  # Decode bytes to string and remove trailing newline
        # If the console_line indicates an error, handle it
        if console_line:
            handle_nlp_bot_error(console_line)

        # Check if the process has exited
        if nlp_bot.poll() is not None:
            logger.error("NLP bot process has exited with code ", nlp_bot.returncode)
            send_message(DEV_CHAT_ID, "NLP bot process has exited. Please check the logs: ", nlp_bot.returncode)
            break


def handle_nlp_bot_error(console_line):
    logger.error(f"Error detected in other in NLP_Bot's output: {console_line}")
    send_message(DEV_CHAT_ID, f"Error detected in NLP_Bot's output: {console_line}")
    check_nlp_bot_status()


def start_watcher_threads():
    nlp_bot_thread = threading.Thread(target=start_nlp_bot_process)
    watcher_bot_thread = threading.Thread(target=start_bot)

    backend_health_thread = threading.Thread(target=check_backend_status)
    nlp_bot_health_thread = threading.Thread(target=check_nlp_bot_status)

    # Sleep for a short time to avoid busy waiting
    nlp_bot_thread.start()
    while not nlp_bot_thread.is_alive():
        time.sleep(0.1)

    watcher_bot_thread.start()
    while not watcher_bot_thread.is_alive():
        time.sleep(0.1)

    backend_health_thread.start()
    nlp_bot_health_thread.start()


if __name__ == '__main__':
    @watcherbot.message_handler(commands=['checkhealth'])
    def healthcheck(message):
        watcherbot.send_message(message.chat.id, 'Checking the backend health...')

        backend_errlist, request_time = do_healthcheck(BACKEND_URL)
        if backend_errlist:
            watcherbot.send_message(message.chat.id, f'Backend is not healthy!\nPlease check the logs for more information. \nThe request took {request_time * 1000} milliseconds and failed with: {backend_errlist}.')
        else:
            watcherbot.send_message(message.chat.id, f'Backend is healthy!\nThe request took {request_time * 1000} milliseconds.')

        watcherbot.send_message(message.chat.id, 'Checking the NLP bot health...')
        
        nlp_errlist, request_time = do_healthcheck(NLP_BOT_URL + '/healthcheck')
        if nlp_errlist:
            watcherbot.send_message(message.chat.id, f'NLP bot is not healthy!\nPlease check the logs for more information.\nThe request took {request_time * 1000} milliseconds and failed with: {nlp_errlist}.')
        else:
            watcherbot.send_message(message.chat.id, f'NLP bot is healthy!\n The request took {request_time * 1000} milliseconds.')
        
    start_watcher_threads()
    
    
    app.run(port=5000)