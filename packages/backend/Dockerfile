FROM golang:1.22 AS go

WORKDIR /app

COPY . .

RUN go mod download && go mod verify

# TEST
FROM go AS test

CMD ["go", "test", "./..."]
# ---

# DEV
FROM go AS development

ENV GOPATH="$HOME/go"
ENV PATH="$GOPATH/bin:$PATH"

RUN go install github.com/githubnemo/CompileDaemon@latest

CMD ["CompileDaemon", "-log-prefix=false", "-build=go build -o /usr/local/bin/app", "-command=/usr/local/bin/app"]
# ---

# PROD
FROM go AS production

RUN go build -o /usr/local/bin/app .

CMD ["app"]
# ---

