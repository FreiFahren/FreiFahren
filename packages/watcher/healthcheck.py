import requests
from config import BACKEND_URL, DEV_CHAT_ID
from bot import watcherbot
from logger import logger
import time 


def check_backend_status() -> None:
    while True:
        errorlist, _ = do_backend_healthcheck()
        if errorlist:
            try:
                watcherbot.send_message(DEV_CHAT_ID, 'Backend is not healthy! Please check the logs for more information.')
            except Exception as e:
                logger.error(f'Failed to send message: {e}')
        time.sleep(20)
        
def ping_backend() -> tuple:
    start_time = time.time()
    response = requests.get(BACKEND_URL)
    end_time = time.time()
    request_time = end_time - start_time
    
    return response, request_time

def do_backend_healthcheck() -> tuple:
    errorlist = []
    request_time = 0
    
    try:
        response = requests.get(BACKEND_URL)
        response.raise_for_status()
    except requests.exceptions.HTTPError as errh:
        errorlist.append(errh)
        logger.error(f'Http Error: {errh}')
    except requests.exceptions.ConnectionError as errc:
        errorlist.append(errc)
        logger.error(f'Error Connecting: {errc}')
    except requests.exceptions.Timeout as errt:
        errorlist.append(errt)
        logger.error(f'Timeout Error: {errt}')
    except requests.exceptions.RequestException as err:
        errorlist.append(err)
        logger.error(f'Request Exception: {err}')
    else:
        response, request_time = ping_backend()
        logger.info(f'Backend is healthy. The request took {round(request_time * 1000,1)} seconds with {response}.')
    
    return errorlist, request_time
