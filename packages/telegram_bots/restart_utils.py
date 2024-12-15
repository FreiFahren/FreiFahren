from telegram_bots.logger import setup_logger

from telebot.apihelper import ApiTelegramException
import threading
import traceback
import random
import time
import sys


MAX_RESTARTS = 3
logger = setup_logger()

class RestartableThread(threading.Thread):
    """
    A custom Thread class that automatically restarts the target function on exceptions.
    
    This class wraps a target function and restarts it up to MAX_RESTARTS times if it
    encounters an exception. It also notifies developers about restarts and termination.

    Attributes:
        target_func (callable): The function to be executed in the thread.
        restart_count (int): The number of times the thread has been restarted.
        args (tuple): Arguments to be passed to the target function.
    """
    def __init__(self, target, name, args=()):
        super().__init__(target=self.run_with_restart, name=name, daemon=True)
        self.target_func = target
        self.restart_count = 0
        self.args = args
        
    def run_with_restart(self):
        """
        Run the target function with automatic restart on exceptions.

        This method executes the target function and restarts it if an exception occurs,
        up to MAX_RESTARTS times. It notifies developers about each restart and when
        the thread terminates due to reaching the maximum restart limit.
        """
        while self.restart_count < MAX_RESTARTS:
            try:
                self.target_func(*self.args)
    
            except Exception as e:
                self.restart_count += 1
                error_message = f"Thread {self.name} stopped. Restarting ({self.restart_count}/{MAX_RESTARTS})..."
                logger.error(f"{error_message} Error: {str(e)}")
                
                if self.restart_count >= MAX_RESTARTS:
                    final_message = f"Thread {self.name} has reached max restarts. Stopping."
                    logger.critical(final_message)
                    break
                time.sleep(5)  # Wait before restarting
        
        logger.critical(f"Thread {self.name} has terminated.")
        

def thread_exception_handler(args):
    """
    Global exception handler for threads.
    
    This function is called when an uncaught exception occurs in a thread. It logs the
    exception and sends a message to the developers with the exception details.
    """
    if isinstance(args, threading.ExceptHookArgs):
        exc_type, exc_value, exc_traceback = args.exc_type, args.exc_value, args.exc_traceback
    else:
        exc_type, exc_value, exc_traceback = sys.exc_info()
    
    console_line = f"Uncaught exception in thread: {exc_value}, {traceback.format_exc()}, {exc_traceback}"
    logger.error(f"Thread Exception Handler: {console_line}")

def exponential_backoff(attempt: int, max_delay=300):
    return min(max_delay, (2 ** attempt) + (random.randint(0, 1000) / 1000))

def run_safely(func: callable, bot_name: str) -> None:
    """
    Execute a function with error handling and exponential backoff.

    This function wraps the execution of 'func' with error handling for ApiTelegramException
    and other exceptions. It implements an exponential backoff strategy for retries and
    raises an exception after exceeding the maximum number of retries to trigger the
    thread restart mechanism.

    Args:
        func (callable): The function to be executed safely.
        bot_name (str): The name of the bot or component for logging purposes.

    Raises:
        Exception: When the maximum number of retries is exceeded.
    """
    logger.info(f"Running {bot_name} with error handling...")
    attempt = 0
    max_retries = 10
    
    while True:
        try:
            func()
            attempt = 0  # Reset attempt count on success
        except ApiTelegramException as e:
            attempt += 1
            if e.error_code == 502:
                wait_time = exponential_backoff(attempt)
                logger.error(f"{bot_name}: Received 502 error. Attempt {attempt}. Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                logger.error(f"{bot_name}: Received {e.error_code} error. Attempt {attempt}. Retrying in 10 seconds...")
                time.sleep(10)
        except Exception as e:
            attempt += 1
            logger.error(f"{bot_name}: Received {e.error_code} error. Attempt {attempt}. Retrying in 10 seconds...")
            
            if attempt > max_retries:
                logger.critical(f"{bot_name} exceeded maximum retries. Raising exception to trigger restart.")
                raise  # This will trigger the thread restart mechanism
            
            wait_time = exponential_backoff(attempt)
            logger.info(f"{bot_name}: Retrying in {wait_time} seconds... (Attempt {attempt}/{max_retries})")
            time.sleep(wait_time)
