from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline
from typing import Dict, Any

app = FastAPI()

tokenizer = AutoTokenizer.from_pretrained("chrisrtt/gbert-multi-class-german-hate")
model = AutoModelForSequenceClassification.from_pretrained(
    "chrisrtt/gbert-multi-class-german-hate"
)
classifier = pipeline("sentiment-analysis", model=model, tokenizer=tokenizer)


class TextInput(BaseModel):
    text: str


@app.get("/classification/hatespeech")
async def classify_text(request: Request) -> Dict[str, Any]:
    try:
        body = await request.json()
        text = body.get("text", "")
        if not text:
            raise HTTPException(status_code=400, detail="Text is required")

        result = classifier(text)

        return {
            "is_hate_speech": result[0]["label"]
            not in ["No Hate Speech", "Sexist Hate Speech"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=9090)
