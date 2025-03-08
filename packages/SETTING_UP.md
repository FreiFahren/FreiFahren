# Setting up your own FreiFahren

Before starting, make sure to have all the environment variables set.

## 1. Environment Variables

There are some .env's that are required for the project to work, especially when using **Docker Compose**.

- `backend/.env`
- `nlp_service/.env`
- `hate_speech_filter/.env`
- `frontend/.env`

### Backend

When using the Postgres container, you need to set the following environment variables:

```plaintext
DB_USER=myuser
DB_PASSWORD=mypassword
DB_HOST=postgres
DB_PORT=5432
DB_NAME=mydatabase

NLP_SERVICE_URL=http://nlp_service:6000
CONTENT_MODERATION_SERVICE_URL=http://content_moderation_service:9090
REPORT_PASSWORD=backend_report_password
```
> NOTE: If you are running your own Postgres server outside of docker, you can change the `DB_HOST` to `host.docker.internal` and the `DB_PORT` to the port of your Postgres server.

- The credentials for the **Postgres database** can be changed in the `docker-compose.yml` file.

- The `NLP_SERVICE_URL` and `CONTENT_MODERATION_SERVICE_URL` are given because they are connected through the `backend-network` in the `docker-compose.yml` file.

- The `REPORT_PASSWORD` is used by the NLP service to bypass rate limiting on the backend.

### NLP Service

```plaintext
BACKEND_URL=http://backend:8080
FREIFAHREN_CHAT_ID=
NLP_BOT_TOKEN=
REPORT_PASSWORD=backend_report_password
RESTART_PASSWORD=123123
SENTRY_DSN=
```

- The `BACKEND_URL` is the URL of the backend (connected through the `backend-network` in the `docker-compose.yml` file).

- The `FREIFAHREN_CHAT_ID` is the chat id of the FreiFahren Telegram group. It can be swapped with any other chat id, where the bot is inside.

- The `NLP_BOT_TOKEN` is the token of the NLP bot. Can be obtained from the [BotFather](https://telegram.me/BotFather).

- The `REPORT_PASSWORD` is used by the NLP service to bypass rate limiting on the backend. Should be the same as the one in the backend.

- The `RESTART_PASSWORD` is used by the NLP service to restart the bot. 

- (optional) The `SENTRY_DSN` is used by the NLP service to send errors to Sentry. 

### Frontend

```sh
REACT_APP_JAWG_ACCESS_TOKEN=YOUR_JAWG_ACCESS_TOKEN
REACT_APP_API_URL=http://localhost:8080

// Map view. Default values are the Berlin view.
REACT_APP_MAP_CENTER_LNG=13.388
REACT_APP_MAP_CENTER_LAT=52.5162
REACT_APP_MAP_BOUNDS_SW_LNG=12.8364646484805
REACT_APP_MAP_BOUNDS_SW_LAT=52.23115511676795
REACT_APP_MAP_BOUNDS_NE_LNG=14.00044556529124
REACT_APP_MAP_BOUNDS_NE_LAT=52.77063424239867
```

- The `REACT_APP_JAWG_ACCESS_TOKEN` is the access token for the JAWG API. It's used to style the map. Can be obtained from the [JAWG API](https://www.jawg.io/).

- The `REACT_APP_API_URL` is the URL of the backend (connected through the `backend-network` in the `docker-compose.yml` file).

- (optional) The `SENTRY_AUTH_TOKEN` is the token for the Sentry project. If you want to use Sentry, make sure to use the `build:prod` command in the `Dockerfile.frontend` file, to build the frontend with **Sentry** enabled.

- You can get the map view bounds easier from [OpenStreetMap](https://www.openstreetmap.org/). Right click to center the map and the coordinates and zoom level will be shown in the URL. 

- Add routes by right clicking on the upper left corner and lower right corner of the map to get North East and South West bounds, shown in the URL as well.

## 2. Commands

Make sure to be in the root directory of the project.

- `docker compose up -d` - Start all the services.
- `docker compose down` - Stop all the services.
- `docker compose build --no-cache` - Build all the services.

## 3. Sentry

To use Sentry, you need to have a Sentry account. You can create one [here](https://sentry.io/signup/).

After creating an account, you need to create a new project. You can do this [here](https://sentry.io/new/).

After creating the project, you need to get the `SENTRY_AUTH_TOKEN` from the project settings.