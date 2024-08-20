# Use the official Bun image as a parent image
FROM oven/bun:1.0.15

# Switch to root to install packages
USER root

# Install font packages
RUN apt-get update && apt-get install -y \
    fonts-liberation \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Rebuild font cache
RUN fc-cache -f -v

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and bun.lockb
COPY package.json ./
COPY bun.lockb ./

# Install dependencies
RUN bun install

# Copy the rest of your app's source code
COPY . .

# Create a directory for storing images
RUN mkdir -p images

# Make sure the app user owns the images directory
RUN chown -R bun:bun images

# Switch back to the bun user
USER bun

# Expose the port the app runs on
EXPOSE 8000

# Run the app when the container launches
CMD ["bun", "run", "start"]