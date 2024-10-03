# Use the official Python image as a base
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements.txt file into the container
COPY requirements.txt .

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Expose port 9090
EXPOSE 9090

# Command to run the application using Waitress
CMD ["waitress-serve", "--port=9090", "hatespeechfilter:app"]