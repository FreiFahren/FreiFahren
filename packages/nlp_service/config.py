import os
from dotenv import load_dotenv


load_dotenv()

FREIFAHREN_CHAT_ID = os.getenv("FREIFAHREN_CHAT_ID")
NLP_BOT_TOKEN = os.getenv("NLP_BOT_TOKEN")


BACKEND_URL = os.getenv("BACKEND_URL")
# this password is to avoid rate limiting for the nlp service
REPORT_PASSWORD = os.getenv("REPORT_PASSWORD")
# this is to restart the nlp service
RESTART_PASSWORD = os.getenv("RESTART_PASSWORD")
SENTRY_DSN = os.getenv("SENTRY_DSN")
