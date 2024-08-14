from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI()

class StoryRequest(BaseModel):
    line: str
    station: str
    direction: str
    message: str

class Inspector(BaseModel):
    line: str
    station: str
    direction: str
    message: str

@app.post("/instagram/stories")
async def create_instagram_story(story: StoryRequest):
    inspector = Inspector(
        line=story.line,
        station=story.station,
        direction=story.direction,
        message=story.message
    )
    
    
    return {"status": "success", "inspector": inspector}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)