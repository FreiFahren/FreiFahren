# Use an official Python runtime as a parent image
FROM python:3.9

# Set the working directory in the container to /app
WORKDIR /app

# Add the parent directory contents into the container at /app
ADD ../ /app

# Install any needed packages specified in requirements.txt
CMD ["python3", "telegram_bots/setup.py"]


EXPOSE 5000
EXPOSE 5001

# Run the command to start the watcher
CMD ["python3", "-m", "telegram_bots.watcher.watcher"]