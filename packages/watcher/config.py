import os
from dotenv import load_dotenv


load_dotenv()

DEV_BOT_TOKEN = os.getenv('DEV_BOT_TOKEN')
DEV_CHAT_ID = os.getenv('DEV_CHAT_ID')
DEV_BOT_CHAT_ID = os.getenv('DEV_BOT_CHAT_ID')

WATCHER_URL = os.getenv('WATCHER_URL')
NLP_BOT_URL= os.getenv('NLP_BOT_URL')
BACKEND_URL = os.getenv('BACKEND_URL')

TELEGRAM_NEXT_CHECK_TIME = 60
TELEGRAM_TIMEOUT = 5