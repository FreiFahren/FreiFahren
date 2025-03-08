# FreiFahren NLP Service Documentation

## Overview

This service provides Natural Language Processing (NLP) capabilities for the FreiFahren system. It processes messages about ticket inspectors in Berlin's public transportation system, extracting relevant information through various natural language processing techniques.

### Components

1. **NLP Processing**: Extracts information about ticket inspectors from messages using NER and other NLP techniques.
2. **Telegram Integration**: Interfaces with Telegram to receive and process messages.
3. **API Layer**: Provides endpoints for health checks, error reporting, and data transmission.

### Project Structure

```
nlp_service/
├── config/             # Configuration settings and language rules
├── core/               # Core NLP processing logic
│   ├── NER/            # Named Entity Recognition components
│   ├── data/           # Data files for NLP processing
│   ├── extractors/     # Feature extraction modules
│   └── testing/        # Test utilities
├── services/           # External service integrations
│   ├── api_adapter.py  # Flask API implementation
│   └── telegram_adapter.py # Telegram bot integration
├── utils/              # Utility functions
│   ├── database.py     # Database connectivity
│   └── logger.py       # Logging configuration
├── main.py             # Application entry point
├── Dockerfile.nlp_service # Container definition
├── Pipfile             # Pipenv dependency management
└── requirements.txt    # Traditional pip requirements
```

## Setup

### Environment Variables

Create a `.env` file in the root directory with the following content:

```shell
BACKEND_URL=http://localhost:8080
FREIFAHREN_CHAT_ID=[TELEGRAM_CHAT_ID]
NLP_BOT_TOKEN=[YOUR_BOT_TOKEN]
REPORT_PASSWORD=[SECURE_PASSWORD]
RESTART_PASSWORD=[SECURE_PASSWORD]
DB_USER=[DATABASE_USER]
DB_NAME=[DATABASE_NAME]
DB_HOST=[DATABASE_HOST]
DB_PORT=[DATABASE_PORT]
DB_PASSWORD=[DATABASE_PASSWORD]
SENTRY_DSN=[OPTIONAL_SENTRY_DSN]
```

### Dependencies

You can install dependencies using either pipenv or pip:

#### Using Pipenv (recommended)

```shell
pipenv install
pipenv shell
```

#### Using Pip

```shell
pip3 install -r requirements.txt
```

### Running the Application

Run the application by executing:

```shell
python -m nlp_service.main
```
> NOTE: Make sure to be in the `packages/` directory, to execute the `nlp_service.main` module

This will start all components in a single process.

## How it Works

1. **Initialization**:
   - The main script sets up the environment, connects to Sentry (if configured), and initializes components.
   - It starts the Telegram bot in a separate thread and runs the Flask server in the main thread.

2. **NLP Processing**:
   - Messages are received through the Telegram bot.
   - The core NLP components (in the `core/` directory) process these messages to extract ticket inspector information.
   - Various extractors and NER models identify key entities such as locations, times, and transport details.

3. **API Layer**:
   - The Flask application provides endpoints for:
     - Health monitoring
     - Manual inspector reporting
     - Data exchange with other system components

4. **Data Management**:
   - Processed information is stored in a PostgreSQL database.
   - Communication with the backend service provides consolidated data access.

## Docker Deployment

The service can be containerized using the provided Dockerfile:

```shell
docker build -f Dockerfile.nlp_service -t freifahren-nlp-service .
docker run -p 6000:6000 --env-file .env freifahren-nlp-service
```

or go into the root directory and run:

```shell
docker compose up 
```


## Logging

The system uses a custom logger that writes to both stdout and a file (`app.log`).
