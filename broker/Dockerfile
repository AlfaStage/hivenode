# ==============================================================================
# HiveNode Broker — Dockerfile (Multi-stage)
# ==============================================================================
# Stages:
#   - dev: Ambiente de desenvolvimento com air (hot-reload Go)
#   - builder: Compila o binário estático
#   - runner: Imagem final distroless/alpine mínima (~10MB)
# ==============================================================================

# --- Stage 1: Desenvolvimento (hot-reload com air) ---
FROM golang:alpine AS dev
WORKDIR /app

# Instala air para hot-reload em desenvolvimento
RUN go install github.com/air-verse/air@latest

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
EXPOSE 10000 10001
CMD ["air", "-c", ".air.toml"]

# --- Stage 2: Build de produção ---
FROM golang:alpine AS builder
WORKDIR /app

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

# Compila binário estático (sem CGO) para máxima portabilidade
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /broker \
    ./cmd/broker/main.go

# --- Stage 3: Runner de produção ---
FROM alpine:3.20 AS runner

# Certificados SSL para conexões TLS externas (Redis, etc)
RUN apk --no-cache add ca-certificates

WORKDIR /app

# Segurança: roda como user não-root
RUN addgroup -S broker && adduser -S broker -G broker
COPY --from=builder /broker .

USER broker
EXPOSE 10000 10001
ENTRYPOINT ["./broker"]
