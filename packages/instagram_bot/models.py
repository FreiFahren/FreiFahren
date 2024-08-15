from pydantic import BaseModel


class StoryRequest(BaseModel):
    """
    StoryRequest is a class that represents the request body for the /instagram/stories endpoint.

    Attributes:
        line: str
        station: str
        direction: str
        message: str
    """
    line: str
    station: str
    direction: str
    message: str

class Inspector(BaseModel):
    """
    Inspector is a class that represents the data that will be displayed in the Instagram story.

    Attributes:
        line: str
        station: str
        direction: str
        message: str
    """
    line: str
    station: str
    direction: str
    message: str
