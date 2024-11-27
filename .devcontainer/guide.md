###

Run this to stop and remove all the current containers (optional)

```shell
docker stop $(docker ps -aq)
docker container prune
```

Make sure to have .docker_env file in project root directory.

###

Run

```shell
docker compose up -d --build
```

to start the all the containers in `.devcontainer` in detached mode.

###

Run

```shell
docker exec ff-backend go run main.go
```

to run the backend server.
