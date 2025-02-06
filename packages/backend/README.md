# FreiFahren Backend

## Overview

The FreiFahren backend is a service built in Go that powers a public transportation monitoring system. It provides APIs for:

- Tracking ticket inspector locations
- Calculating distances between stations
- Managing transit lines and stations
- Risk prediction for inspector appearances
- Real-time statistics and reporting

## Architecture

The backend consists of several key components:

1. **Core API Services** (`/api/`)
   - Distance calculation (Dijkstra's algorithm)
   - Inspector tracking and reporting
   - Station and line management
   - Risk prediction model

2. **Python Risk Model** (`/api/prediction/`)
   - Machine learning model for predicting inspector presence
   - Uses Beta-Binomial distribution for risk assessment
   - Real-time color-coded segment risk levels

3. **Caching Layer** (`/caching/`)
   - ETag-based caching
   - In-memory cache for frequently accessed data

4. **Database Layer**
   - PostgreSQL database for storing reports and statistics
   - Reader/Writer separation for improved performance

## Prerequisites

- Go 1.22+
- PostgreSQL 13+
- Python 3.9+ (for risk prediction model)
- Docker (optional)

## Environment Variables

Create a `.env` file with:

```plaintext
DB_USER=myuser
DB_PASSWORD=mypassword
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mydatabase
```

## Running with Docker

1. Build the image:
```bash
docker build -f Dockerfile.backend -t freifahren-backend .
```

2. Run the container:
```bash
docker run -p 8080:8080 \
  --env-file .env \
  freifahren-backend
```

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/brandesdavid/FreiFahren
cd FreiFahren/packages/backend
```

2. Install Go dependencies:
```bash
go mod download
```

3. Install Python dependencies:
```bash
cd api/prediction
pip install -r requirements.txt
cd ../..
```

4. Run the server:
```bash
go run main.go
```

For hot reloading during development:
```bash
reflex -c reflex.conf
```

## Docker Configuration

The backend uses a multi-stage Dockerfile (reference: `packages/backend/Dockerfile.prod.backend`):

```dockerfile
FROM golang as backend

WORKDIR /project
COPY . /project
RUN go install

# Setup Python environment for risk prediction
COPY api/prediction/requirements.txt /project/api/prediction/requirements.txt
RUN apt-get update && apt-get install -y python3 python3-pip python3-venv
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install -r /project/api/prediction/requirements.txt

EXPOSE 8080
CMD ["go", "run", "main.go"]
```

## API Documentation

The API is documented using Swagger. Once running, visit:
```
http://localhost:8080/swagger/index.html
```

## Testing

Run the test suite with:
```bash
go test ./...
```

Integration tests are in the `integration_tests` folder, while unit tests are located alongside their respective packages with `_test` suffix.

## Data Embedding

The backend embeds static data (stations, lines) into the binary for improved portability. New data can be added by modifying `embedJSONFiles.go` and using the `//go:embed` directive.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

For more detailed information about specific components, refer to the inline documentation in the source code.
