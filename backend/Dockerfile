# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.22.4
FROM golang:${GO_VERSION}-bookworm AS builder

WORKDIR /app

# Install build deps early
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git && rm -rf /var/lib/apt/lists/*

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/api ./cmd/api

FROM gcr.io/distroless/base-debian12 AS runtime

WORKDIR /srv

COPY --from=builder /out/api /usr/local/bin/ahla-api

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/ahla-api"]
