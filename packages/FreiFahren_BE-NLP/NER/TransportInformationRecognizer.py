import os
import spacy


class TransportInformationRecognizer:
    def __init__(self, model_path):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        self.model_path = os.path.join(base_dir, model_path)
        self.nlp = spacy.load(f'{self.model_path}')

    # input: text message (string)
    # return: a list of all recognized stations in the text
    def get_recognized_stations(self, text: str) -> list:
        
        match = self.nlp(text)
        matches = []
        for entity in match.ents:
            if entity.label_ == 'STATION':
                matches.append(entity)
            
        return matches

    # input: text message (string)
    # return: a text message with only the recognized stations
    def process_text(self, text: str) -> list:

        doc = self.nlp(text)
        stations = []

        for entity in doc.ents:
            if entity.label_ == 'STATION':
                stations.append(entity.text)

        return stations
    

TextProcessor = TransportInformationRecognizer('models/loss17')
