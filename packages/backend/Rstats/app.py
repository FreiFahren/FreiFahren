import waitress
import flask
import subprocess
import csv
import json

import os
import glob

app = flask.Flask(__name__)

def get_newest_file():
    list_of_files = glob.glob('Rstats/output/risk_model_*.json')  # get list of all matching files
    if not list_of_files:  # if list is empty, no matching files
        return None
    newest_file = max(list_of_files, key=os.path.getctime)  # get the newest file
    return newest_file

def clean_output_directory():
    files = glob.glob('Rstats/output/*')
    for f in files:
        os.remove(f)

@app.route('/run', methods=['POST'])
def run():
    clean_output_directory()
    ticket_data = flask.request.content_type == 'text/csv' and list(csv.reader(flask.request.data.decode().splitlines())) or 'Error: Invalid content type'
    print(ticket_data)

    # Save the received data as a CSV file
    with open('Rstats/ticket_data.csv', 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(ticket_data)

    result = subprocess.run(['Rscript', 'risk_model.r'], stdout=subprocess.PIPE)
    newest_file = get_newest_file()

    if newest_file is None:
        return "Error: No output file found", 500

    with open(newest_file, 'r') as f:
        data = json.load(f)

    return data, 200


@app.route('/health', methods=['GET'])
def health():
    return "Success", 200


if __name__ == '__main__':
    waitress.serve(app, port=7878, host='0.0.0.0')
