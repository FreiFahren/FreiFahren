# Use the official Python image as the base image
FROM python:3.9

# Set the working directory in the Docker container
WORKDIR /app

# Copy the current directory contents into the container
COPY . /app

# Install any dependencies in the requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Set environment variables
# Prevents Python from writing pyc files to disc
ENV PYTHONDONTWRITEBYTECODE 1
# Prevents Python from buffering stdout and stderr
ENV PYTHONUNBUFFERED 1

# Expose the port the app runs on
EXPOSE 5432

# Command to run the application
CMD ["python", "./main.py"]
