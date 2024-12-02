# Use the official Python image as a base
FROM pytorch/pytorch

# Set the working directory in the container
WORKDIR /app

# Copy the requirements.txt file into the container
COPY requirements.txt .

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code into the container
COPY . .

# Command to run the application using uvicorn
CMD ["uvicorn", "hatespeechfilter:app", "--host", "0.0.0.0", "--port", "9090"]