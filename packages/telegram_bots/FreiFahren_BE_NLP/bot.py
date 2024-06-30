# This file is used to create the bot object for the watcher bot
# Extra file to avoid circular imports

import telebot
from telegram_bots.config import NLP_BOT_TOKEN

nlp_bot = telebot.TeleBot(NLP_BOT_TOKEN)

# function is specific to the NLP bot because we cannot pass args to the threads
def start_bot():
    nlp_bot.infinity_polling()