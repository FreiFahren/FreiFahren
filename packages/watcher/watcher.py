
from bot import start_bot, watcherbot, do_telegram_bot_healthcheck
from healthcheck import check_backend_status, do_backend_healthcheck
from app import app
from logger import setup_logger
from logger import logger
import threading



def start_watcher_threads():
    bot_thread = threading.Thread(target=start_bot)
    backend_health_thread = threading.Thread(target=check_backend_status)
    check_telegram_status_thread = threading.Thread(target=do_telegram_bot_healthcheck)

    bot_thread.start()
    backend_health_thread.start()
    check_telegram_status_thread.start()
    

if __name__ == '__main__':
    logger = setup_logger()

    @watcherbot.message_handler(commands=['checkhealth'])
    def healthcheck(message):
        watcherbot.send_message(message.chat.id, 'Checking the backend health...')

        backend_errlist, request_time = do_backend_healthcheck()
        if backend_errlist:
            watcherbot.send_message(message.chat.id, f'Backend is not healthy! Please check the logs for more information. The request took {request_time * 1000} milliseconds and failed with {backend_errlist}.')
        else:
            watcherbot.send_message(message.chat.id, f'Backend is healthy! The request took {request_time * 1000} milliseconds.')
        
        
        
    start_watcher_threads()
    

    # Start the Flask app in the main thread
    app.run(port=5000)