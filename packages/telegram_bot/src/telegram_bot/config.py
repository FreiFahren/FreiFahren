import os

from dotenv import load_dotenv

load_dotenv()


def _required(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


BACKEND_URL = _required("BACKEND_URL").rstrip("/")
MISTRAL_API_KEY = _required("MISTRAL_API_KEY")
REPORT_PASSWORD = _required("REPORT_PASSWORD")
TELEGRAM_BOT_TOKEN = _required("TELEGRAM_BOT_TOKEN")

MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "mistral-small-latest")
