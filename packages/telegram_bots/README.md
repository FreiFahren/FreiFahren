# FreiFahren Telegram Bot System Documentation

## Overview

This system combines a Natural Language Processing (NLP) bot and a Watcher bot into a single application. It processes messages about ticket inspectors in Berlin's public transportation system and monitors the health of the backend.

### Components
1. **NLP Bot**: Processes incoming messages to extract information about ticket inspectors.
2. **Watcher Bot**: Monitors the health of the backend and the NLP bot.
3. **Flask Application**: Provides endpoints for health checks and error reporting.

### Architecture

The system runs as a single process with multiple threads:
- Main Thread: Runs the Flask application
- NLP Bot Thread: Handles Telegram messages
- Watcher Bot Thread: Responds to health check commands and sends error reports
- Backend Health Check Thread: Periodically checks backend health
- NLP Health Check Thread: Periodically checks NLP bot health

## Setup

### Environment Variables

Create a .env file in the root directory with the following content:
```shell
BACKEND_URL=http://127.0.0.1:8080
WATCHER_BOT_TOKEN=
NLP_BOT_TOKEN=
TELEGERAM_BOTS_URL=http://127.0.0.1:6000
DEV_CHAT_ID=
```

You can get the Watcher and NLP bot tokens from the BotFather. The DEV_CHAT_ID is the chat ID of the developer chat.

### Dependencies
install the dependencies by running:
```shell
pip install -r requirements.txt
```

### Running the Application
Run the application by executing the following command in the packages directory:
```shell
python3 -m telegram_bots.main
```
This will start all components in a single process.

## How it Works

1. **Initialization**:
- The main script sets up the Flask app, NLP bot, and Watcher bot.
- It starts separate threads for NLP bot polling, Watcher bot polling, and health checks.

2. **NLP Bot**:
- Listens for incoming Telegram messages.
- Processes messages to extract ticket inspector information.
- Sends extracted data to the backend.

3. **Watcher Bot**:
- Responds to /checkhealth commands.
- Sends error reports to the developer chat.

4. **Health Checks**:
- Periodically checks the health of the backend and NLP bot.

5. **Flask Application**:
- Provides a /healthcheck endpoint for external health monitoring.
- Offers a /report-inspector endpoint for manual reporting.
- Includes a /report-failure endpoint for error reporting from other components.

6. **Error Handling**:
- Uses a global thread exception handler to catch and report unhandled exceptions
- implements a run_safely function to wrap thread targets for additional error catching.

## Logging
- The system uses a custom logger that writes to both a file (app.log) and the console.