# This file is used to create the bot object for the watcher bot
# Extra file to avoid circular imports

import telebot
from telegram_bots.config import WATCHER_BOT_TOKEN

watcher_bot = telebot.TeleBot(WATCHER_BOT_TOKEN)

def start_bot():
    watcher_bot.infinity_polling()