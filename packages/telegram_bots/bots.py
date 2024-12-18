# utility file to store the bot instances to avoid circular imports

from telebot import TeleBot
from telegram_bots.config import NLP_BOT_TOKEN

nlp_bot = TeleBot(NLP_BOT_TOKEN)
