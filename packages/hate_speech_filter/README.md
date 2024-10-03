# Hate Speech Filter

## Running the Application

To run the application using Docker, execute the following command:

```bash
docker run --rm -it $(docker buildx build -q .)
```

This command builds the Docker image and runs the container interactively.

## Classifying Text

Once the application is running, you can classify text by sending a POST request to the classification endpoint. Use the following `curl` command to test the classification:

```bash
curl -X POST http://88.99.56.234:9090/classification \
-H "Content-Type: application/json" \
-d '{"text": "Fünf Kontrolleure an der S42"}'
```

This command sends a JSON payload containing the text you want to classify. 

### Expected Output

The output will be:

```json
[{"label":"No Hate Speech","score":0.8406059741973877}]
```
