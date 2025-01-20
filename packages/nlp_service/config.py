import os
from dotenv import load_dotenv


load_dotenv()

FREIFAHREN_CHAT_ID = os.getenv("FREIFAHREN_CHAT_ID")
NLP_BOT_TOKEN = os.getenv("NLP_BOT_TOKEN")

NLP_SERVICE_URL = os.getenv("NLP_SERVICE_URL")
BACKEND_URL = os.getenv("BACKEND_URL")
REPORT_PASSWORD = os.getenv("REPORT_PASSWORD")
RESTART_PASSWORD = os.getenv("RESTART_PASSWORD")
