from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

app = Flask(__name__)

tokenizer = AutoTokenizer.from_pretrained("chrisrtt/gbert-multi-class-german-hate")
model = AutoModelForSequenceClassification.from_pretrained("chrisrtt/gbert-multi-class-german-hate")
classifier = pipeline('sentiment-analysis', model=model, tokenizer=tokenizer)

@app.route('/classification', methods=['POST'])
def classify_text():
    data = request.get_json()
    
    if 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data['text']
    
    result = classifier(text)
    
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9090)
    