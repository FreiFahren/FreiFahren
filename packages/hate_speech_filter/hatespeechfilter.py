from fastapi import FastAPI, HTTPException
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


@app.post("/classification/hatespeech")
def classify_text(input_data: TextInput) -> Dict[str, Any]:
    text = input_data.text

    result = classifier(text)

    return {
        "is_hate_speech": result[0]["label"]
        not in ["No Hate Speech", "Sexist Hate Speech"]
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=9090)
