import requests
from telegram_bots.config import BACKEND_URL, DEV_CHAT_ID, NLP_BOT_URL, TELEGRAM_NEXT_CHECK_TIME
from telegram_bots.bot_utils import send_message
from telegram_bots.bots import watcher_bot
from telegram_bots import logger
import time

logger = logger.setup_logger()

def ping_system(endpoint: str) -> tuple:
    start_time = time.time()
    response = requests.get(endpoint)
    end_time = time.time()
    request_time = end_time - start_time

    return response, request_time


def do_healthcheck(endpoint: str) -> tuple:
    errorlist = []
    request_time = 0

    try:
        response = requests.get(endpoint)
        response.raise_for_status()
    except requests.exceptions.HTTPError as http_error:
        errorlist.append(http_error)
        logger.error(f'Http Error: {http_error}')
    except requests.exceptions.ConnectionError as connection_error:
        errorlist.append(connection_error)
        logger.error(f'Error Connecting: {connection_error}')
    except requests.exceptions.Timeout as timeout:
        errorlist.append(timeout)
        logger.error(f'Timeout Error: {timeout}')
    except requests.exceptions.RequestException as request_exception:
        errorlist.append(request_exception)
        logger.error(f'Request Exception: {request_exception}')
    else:
        response, request_time = ping_system(endpoint)
        logger.info(f'{endpoint} is healthy. The request took {round(request_time * 1000,1)} seconds with {response}.')
    return errorlist, request_time


def check_nlp_bot_status() -> None:
    """Pings the NLP bot's healthcheck endpoint every 60 seconds. 
        If the bot is not alive, it sends a message to the users.
        If the bot is alive, it waits 20 minutes before pinging again.
    """
    waiting_time = TELEGRAM_NEXT_CHECK_TIME
    while True:
        try:
            errorlist, request_time = do_healthcheck(NLP_BOT_URL + '/healthcheck')
            if errorlist:
                send_message(DEV_CHAT_ID, f'NLP bot is not healthy! Please check the logs for more information. Error list: {errorlist}', watcher_bot)
            time.sleep(waiting_time)

        except Exception as e:
            send_message(DEV_CHAT_ID, f'Failed to check the NLP bot status: {e}', watcher_bot)
            logger.error(f'Failed to check the NLP bot status: {e}')\



def check_backend_status() -> None:
    while True:
        errorlist, _ = do_healthcheck(BACKEND_URL)
        if errorlist:
            try:
                send_message(DEV_CHAT_ID, 'Backend is not healthy! Please check the logs for more information.', watcher_bot)
            except Exception as e:
                logger.error(f'Failed to send message: {e}')
        time.sleep(20)
