from telethon import TelegramClient
from datetime import datetime, timedelta, timezone
import asyncio
import os
from dotenv import load_dotenv
import random

load_dotenv()

api_id = os.getenv('API_ID')
print(api_id)
api_hash = os.getenv('API_HASH')
print(api_hash)

session_file = 'Get1000Messages'
group_identifier = '@freifahren_BE'

client = TelegramClient(session_file, api_id, api_hash)


async def get_messages(group_identifier):
    await client.start()
    print('Client Created')

    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=7)

    hourly_messages = {}

    # Fetch messages within the last 7 days, up to a limit
    all_messages = await client.get_messages(group_identifier, limit=10000)
    
    for message in all_messages:
        if start_time <= message.date <= end_time:
            # Format the message date to round down to the nearest hour
            hour = message.date.replace(minute=0, second=0, microsecond=0)
            if hour not in hourly_messages:
                hourly_messages[hour] = []
            hourly_messages[hour].append((
                message.message,
                message.date.strftime('%Y-%m-%d %H:%M:%S')
            ))
    
    # Select up to 15 random messages from each hourly group
    selected_messages = []
    for _hour, messages in hourly_messages.items():
        if len(messages) > 15:
            selected_messages.extend(random.sample(messages, 15))
        else:
            selected_messages.extend(messages)

    await client.disconnect()
    return selected_messages

if __name__ == '__main__':
    messages = asyncio.run(get_messages(group_identifier))

    # Save the selected messages to a text file
    with open('group_messages.txt', 'w', encoding='utf-8') as file:
        for message_text in messages:
            file.write(message_text[0] + '\n')
