# utility file to store the bot instances to avoid circular imports

from telebot import TeleBot
from telegram_bots.config import WATCHER_BOT_TOKEN, NLP_BOT_TOKEN

watcher_bot = TeleBot(WATCHER_BOT_TOKEN)
nlp_bot = TeleBot(NLP_BOT_TOKEN)