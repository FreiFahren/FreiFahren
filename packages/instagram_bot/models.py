from pydantic import BaseModel


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
