# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container to /app
WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first
COPY nlp_service/requirements.txt /app/nlp_service/requirements.txt
RUN pip install --no-cache-dir -U pip && \
    pip install --no-cache-dir wheel && \
    pip install --no-cache-dir -r nlp_service/requirements.txt

# Add the current directory contents into the container at /app
COPY nlp_service/ /app/nlp_service

# Copy the .env file into the container
COPY nlp_service/.env .env

# Run the command to start the main application
CMD ["python3", "-m", "nlp_service.main"]
