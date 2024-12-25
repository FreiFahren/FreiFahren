import os
from dotenv import load_dotenv


load_dotenv()

FREIFAHREN_CHAT_ID = os.getenv("FREIFAHREN_CHAT_ID")
NLP_BOT_TOKEN = os.getenv("NLP_BOT_TOKEN")

TELEGRAM_BOTS_URL = os.getenv("TELEGRAM_BOTS_URL")
BACKEND_URL = os.getenv("BACKEND_URL")
REPORT_PASSWORD = os.getenv("REPORT_PASSWORD")
