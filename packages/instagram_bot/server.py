import os

import uvicorn
from fastapi import FastAPI, HTTPException
from image import create_image
from instagram import post_instagram_story
from models import Inspector, StoryRequest

app = FastAPI()

@app.post('/instagram/stories')
async def create_instagram_story(story: StoryRequest) -> dict:
    inspector = Inspector(
        line=story.line,
        station=story.station,
        direction=story.direction,
        message=story.message
    )

    img_bytes = create_image(inspector)
    folder_path = './images'

    # Save the image to a file
    with open(f'{folder_path}/story.png', 'wb') as f:
        f.write(img_bytes.read()
    )

    try:
        # Post the image to Instagram as a story
        success = post_instagram_story(f'{folder_path}/story.png')
        if success:
            return {'status': 'success', 'message': 'Story posted successfully'}
        else:
            return {'status': 'error', 'message': 'Failed to post story'}
    except HTTPException as e:
        return {'status': 'error', 'message': str(e.detail)}
    finally:
        # cleanup the image file
        os.remove(f'{folder_path}/story.png')



if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000)
