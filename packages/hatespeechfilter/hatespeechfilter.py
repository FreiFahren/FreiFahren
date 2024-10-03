from flask import Flask, request, jsonify
import waitress
from transformers import AutoTokenizer, AutoModelForSequenceClassification, pipeline

# Initialize the Flask app
app = Flask(__name__)

# Load the model and tokenizer
tokenizer = AutoTokenizer.from_pretrained("chrisrtt/gbert-multi-class-german-hate")
model = AutoModelForSequenceClassification.from_pretrained("chrisrtt/gbert-multi-class-german-hate")
classifier = pipeline('sentiment-analysis', model=model, tokenizer=tokenizer)

@app.route('/classify', methods=['POST'])
def classify_text():
    # Get the JSON data from the request
    data = request.get_json()
    
    # Check if 'text' is in the request
    if 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    text = data['text']
    
    # Classify the text
    result = classifier(text)
    
    # Return the result as JSON
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9090)