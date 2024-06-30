# This file is used to create the bot object for the watcher bot
# Extra file to avoid circular imports

import telebot
from telegram_bots.config import NLP_BOT_TOKEN

nlp_bot = telebot.TeleBot(NLP_BOT_TOKEN)