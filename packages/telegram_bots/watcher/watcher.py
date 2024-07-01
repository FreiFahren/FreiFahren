import time
from telegram_bots.config import DEV_CHAT_ID, BACKEND_URL, NLP_BOT_URL
from telegram_bots.bot_utils import send_message
from telegram_bots.watcher.healthcheck import check_backend_status, do_healthcheck, check_nlp_bot_status
from telegram_bots.watcher.app import watcher_app
from telegram_bots.watcher.bot import watcher_bot, start_bot
import threading
import subprocess
from telegram_bots import logger

logger = logger.setup_logger()

def start_nlp_bot_process():
    logger.info('Starting the NLP bot process...')
    # Run the NLP bot process. All errors will be received
    nlp_bot_process = subprocess.Popen(['python3', '-m', 'telegram_bots.FreiFahren_BE_NLP.main'], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    
    # Collect all output lines into a list
    output_lines = nlp_bot_process.stdout.readlines()
    output_lines = [line.decode().strip() for line in output_lines]  # Decode bytes to string and remove trailing newline

    # Now all output lines are in the output_lines list
    for console_line in output_lines:
    # If the console_line indicates an error, handle it
        if console_line:
            print(console_line)  # Print the line before handling the error
            handle_nlp_bot_error(console_line)

    # Check if the process has exited
    if nlp_bot_process.poll() is not None:
        logger.error("NLP bot process has exited with code ", nlp_bot_process.returncode)
        send_message(DEV_CHAT_ID, "NLP bot process has exited. Please check the logs: ", nlp_bot_process.returncode, watcher_bot)


def handle_nlp_bot_error(console_line):
    logger.error(f"Error detected in other in NLP_Bot's output: {console_line}")
    send_message(DEV_CHAT_ID, f"Error detected in NLP_Bot's output: {console_line}", watcher_bot)
    check_nlp_bot_status()


def start_watcher_threads():
    logger.info('Starting the watcher threads...')

    nlp_bot_thread = threading.Thread(target=start_nlp_bot_process)
    watcher_bot_thread = threading.Thread(target=start_bot)

    backend_health_thread = threading.Thread(target=check_backend_status)
    nlp_bot_health_thread = threading.Thread(target=check_nlp_bot_status)

    logger.debug('NLP bot thread started')

    nlp_bot_thread.start()
    watcher_bot_thread.start()

    backend_health_thread.start()
    nlp_bot_health_thread.start()


if __name__ == '__main__':
    logger.info('Starting the watcher bot...')

    @watcher_bot.message_handler(commands=['checkhealth'])
    def healthcheck(message):
        send_message(message.chat.id, 'Checking the backend health...', watcher_bot)

        backend_errlist, request_time = do_healthcheck(BACKEND_URL)
        if backend_errlist:
            send_message(message.chat.id, f'Backend is not healthy!\nPlease check the logs for more information. \nThe request took {request_time * 1000} milliseconds and failed with: {backend_errlist}.', watcher_bot)
        else:
            send_message(message.chat.id, f'Backend is healthy!\nThe request took {request_time * 1000} milliseconds.', watcher_bot)

        send_message(message.chat.id, 'Checking the NLP bot health...', watcher_bot)
        
        nlp_errlist, request_time = do_healthcheck(NLP_BOT_URL + '/healthcheck')
        if nlp_errlist:
            send_message(message.chat.id, f'NLP bot is not healthy!\nPlease check the logs for more information.\nThe request took {request_time * 1000} milliseconds and failed with: {nlp_errlist}.', watcher_bot)
        else:
            send_message(message.chat.id, f'NLP bot is healthy!\n The request took {request_time * 1000} milliseconds.', watcher_bot)
    
    start_watcher_threads()
    logger.info("Waitress serve WATCHER_BOT")
        
    from waitress import serve
    serve(watcher_app, host='127.0.0.1', port=6000)
    

    