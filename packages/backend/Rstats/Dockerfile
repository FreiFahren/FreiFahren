FROM rocker/rstudio:latest

# Create a directory for the R library path
RUN mkdir -p /usr/local/lib/R/site-library

# Set the R library path to the created directory
ENV R_LIBS=/usr/local/lib/R/site-library

# Specify the R library path as a mount point
VOLUME /usr/local/lib/R/site-library

RUN apt-get clean all && \
    apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y \
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

# Set the working directory to the directory where the Dockerfile and risk_model.r script are located
WORKDIR /home/docker

RUN mkdir -p /home/docker/output 
Run mkdir -p /home/docker/Rstats

COPY risk_model.r .
COPY segments_v4.RDS /home/docker/Rstats
RUN echo '[{"timestamp": "2024-06-30T15:27:00Z","station_id": "SU-A","line": "U8"},{"timestamp": "2024-06-30T15:38:00Z","station_id": "SU-A","line": "U8"},{"timestamp": "2024-06-30T15:28:00Z","station_id": "SU-A","line": "U8"},{"timestamp": "2024-06-30T15:30:00Z","station_id": "SU-A","line": "U8"},{"timestamp": "2024-06-30T15:35:00Z","station_id": "SU-A","line": "U8"}]' > ticket_data.json

# Run the risk_model.r script
RUN Rscript risk_model.r