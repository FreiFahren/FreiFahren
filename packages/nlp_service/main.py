from nlp_service.config.config import SENTRY_DSN
from nlp_service.utils.logger import setup_logger

# Import the services. The services initialize themselves in their respective files
from nlp_service.services.api_adapter import flask_app
from nlp_service.services.telegram_adapter import nlp_bot

import sentry_sdk
from waitress import serve

import traceback
import sys
import threading


if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        # Set traces_sample_rate to 1.0 to capture 100%
        # of transactions for tracing.
        traces_sample_rate=1.0,
        # Set profiles_sample_rate to 1.0 to profile 100%
    # of sampled transactions.
    # We recommend adjusting this value in production.
    profiles_sample_rate=1.0,
    )
else:
    print("No SENTRY_DSN found, skipping Sentry initialization")


def create_service():
    try:
        logger = setup_logger()

        # Start telegram thread in a different thread
        logger.info("Starting the natural language processing bot...")

        telegram_thread = threading.Thread(target=lambda: nlp_bot.polling(non_stop=True, timeout=60))
        telegram_thread.daemon = True  # This ensures the thread will be killed when the main program exits
        telegram_thread.start()

        # Run the Flask app in the main thread
        logger.info("Starting the Flask server...")
        serve(flask_app, host="0.0.0.0", port=3434)

    except Exception as e:
        error_message = f"Error in natural language processing bot: {str(e)}\n{traceback.format_exc()}"
        logger.error(error_message)
        sys.exit(1)

if __name__ == "__main__":
    create_service()
