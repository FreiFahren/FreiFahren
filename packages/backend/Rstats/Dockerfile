FROM rocker/rstudio:latest

# Create a directory for the R library path
RUN mkdir -p /usr/local/lib/R/site-library

# Set the R library path to the created directory
ENV R_LIBS=/usr/local/lib/R/site-library

# Specify the R library path as a mount point
VOLUME /usr/local/lib/R/site-library

# Install the OpenSSH server package and Python dependencies
RUN apt-get clean all && \
    apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y \
    python3-pip \
    python3-venv \
    python3-full \
    libcurl4-openssl-dev \
    libssl-dev libxml2-dev \
    libfontconfig1-dev \
    libudunits2-dev \ 
    libharfbuzz-dev \
    libfribidi-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    && apt-get clean all && \
    apt-get purge && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

RUN Rscript -e "install.packages(c('tidyverse', 'pacman'));"

# Set the working directory
WORKDIR /home/docker

# Create required directories
RUN mkdir -p /home/docker/Rstats
RUN mkdir -p /home/docker/Rstats/output

# Create and activate virtual environment
RUN python3 -m venv /home/docker/venv
ENV PATH="/home/docker/venv/bin:$PATH"

# Copy files
COPY risk_model.r .
COPY Rstats/segments/segments_v5.RDS /home/docker/Rstats/segments/
COPY requirements.txt .
COPY app.py .

RUN echo '[{"timestamp": "2024-06-30T15:27:00Z","station_id": "SUM-A","line": "U8"},{"timestamp": "2024-06-30T15:38:00Z","station_id": "SUM-A","line": "U8"},{"timestamp": "2024-06-30T15:28:00Z","station_id": "SUM-A","line": "U8"},{"timestamp": "2024-06-30T15:30:00Z","station_id": "SUM-A","line": "U8"},{"timestamp": "2024-06-30T15:35:00Z","station_id": "SUM-A","line": "U8"}]' > Rstats/ticket_data.json

# Install Python packages in virtual environment
RUN pip install --no-cache-dir -r requirements.txt

# Run the app
CMD ["python3", "app.py"]