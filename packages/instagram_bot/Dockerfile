# Use the official Bun image as a parent image
FROM oven/bun:1.0.15

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

# Expose the port the app runs on
EXPOSE 8000

# Run the app when the container launches
CMD ["bun", "run", "start"]