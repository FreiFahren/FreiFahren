import uvicorn
from fastapi import FastAPI
from image import create_image
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

    return {'status': 'success', 'inspector': inspector}

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000)
