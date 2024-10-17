# Hate Speech Filter

## Performance

If "Sexist Hate Speech" is being excluded from the results the following metrics were achieved:

-   Accuracy: 0.93
-   Precision: 0.97
-   Recall: 0.87
-   F1 Score: 0.92

## Running the Application

To run the application using Docker, execute the following command:

```bash
docker run --rm -it $(docker buildx build -q .)
```

This command builds the Docker image and runs the container interactively.

## Classifying Text

Once the application is running, you can classify text by sending a POST request to the classification endpoint. Use the following `curl` command to test the classification:

```bash
curl -X GET http://localhost:9090/classification/hatespeech \
-H "Content-Type: application/json" \
-d '{"text": "Fünf Kontrolleure an der S42"}'
```

This command sends a JSON payload containing the text you want to classify.

### Expected Output

The output will be json to indicate whether the text is hate speech or not.

```json
{
    "is_hate_speech": false
}
```
