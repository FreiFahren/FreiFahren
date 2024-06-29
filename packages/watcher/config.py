import os
from dotenv import load_dotenv


load_dotenv()

DEV_BOT_TOKEN = os.getenv('DEV_BOT_TOKEN')
BACKEND_URL = os.getenv('BACKEND_URL')
DEV_CHAT_ID = os.getenv('DEV_CHAT_ID')
***REMOVED***

TELEGRAM_NEXT_CHECK_TIME = 60
TELEGRAM_TIMEOUT = 5
TELEGRAM_CHECKING_MESSAGE = 'Hey, are you alive?'
TELEGRAM_RESPONSE_MESSAGE = 'Yes, I am alive'