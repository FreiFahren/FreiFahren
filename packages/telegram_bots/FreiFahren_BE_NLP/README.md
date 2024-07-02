# Freifahren

## Overview

This repository focuses on the natural language processing (NLP) and data handling of these community reports to maintain high accuracy and reliability.

**Current Accuracy:** As of now, our system successfully processes 82.7% of incoming messages with perfect accuracy, while the remaining 17.3% encounter minor errors.

## Getting Started

### Prerequisites

- Python version 3.6 or newer

### Installation

1. First, clone the repository to your local machine:
   ```bash
   git clone https://github.com/brandesdavid/FreiFahren
2. Install the necessary Python packages:
    `pip install -r requirements.txt`
3. Acquire a Bot API Token by creating a new bot through [BotFather](https://t.me/botFather) and set it as the BOT_TOKEN environment variable.

### Running the Bot
Execute the following command to start the bot from the package's root directory:
`python3 -m telegram_bots.watcher.watcher`

This will launch the watcher bot, which will start the NLP Bot as a subprocess, watch the errors and begin processing messages from the designated Telegram group.
Upon launch, the bot begins processing messages from the Telegram group, applying our custom NLP algorithms to extract and validate data in real-time.

## How it Works

### Message Processing

Upon detecting a new message, the bot activates the extract_data function to parse and interpret the content. This involves identifying key details such as the station, line, and direction of the reported ticket inspector sightings, along with the timestamp of the event.

The `extract_ticket_inspector_info` Function
This function operates in two stages:
1. **Initial Extraction:** It first attempts to determine the station, line, and direction directly from the user's message.
2. **Data Validation:** Subsequently, it validates and corrects this preliminary data against a pre-compiled database of stations, lines, and directions to ensure accuracy.

Detailed Functions
- `find_station`: Utilizes a Named Entity Recognition (NER) model to pinpoint stations within messages, refined through fuzzy matching against a comprehensive station database.

- `find_line`: Employs a straightforward word search to identify mentioned transit lines, based on a list of lines within the Berlin public transport network.

- `find_direction`: Splits the message at directional keywords (e.g., "towards") to isolate and identify subsequent station names, aiding in the determination of the inspector's direction.

### Data Validation
The validation process employs specific rules to fine-tune the accuracy of extracted data, such as handling directionless Ringbahn reports, adjusting for reports of inspectors disembarking, and reconciling directions with invalid or nonexistent stations.

This structured and meticulous approach ensures that Freifahren remains a reliable resource for navigating Berlin's public transport system free from unwelcome surprises.
