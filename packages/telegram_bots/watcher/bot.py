# This file is used to create the bot object for the watcher bot
# Extra file to avoid circular imports

import telebot
from telegram_bots.config import DEV_BOT_TOKEN

watcher_bot = telebot.TeleBot(DEV_BOT_TOKEN)