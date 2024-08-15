import os

from fastapi import HTTPException
from instabot import Bot


def post_instagram_story(image_path: str) -> bool:
    username = os.getenv('INSTAGRAM_USERNAME')
    password = os.getenv('INSTAGRAM_PASSWORD')

    bot = Bot()
    bot.login(username=username, password=password)

    if bot.upload_story_photo(image_path):
        return True
    else:
        raise HTTPException(status_code=500, detail='Failed to post story to Instagram')
