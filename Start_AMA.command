#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$APP_DIR/backend/Archiev-Back"
FRONTEND_DIR="$APP_DIR/frontend/achive-front"
RUNTIME_DIR="$APP_DIR/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
PID_DIR="$RUNTIME_DIR/pids"
DEFAULT_LOCAL_MONGO_DBPATH="$HOME/data/db"
MONGO_DATA_DIR="${AMA_MONGO_DBPATH:-$DEFAULT_LOCAL_MONGO_DBPATH}"

BACKEND_PORT="4000"
MONGO_PORT="27017"
APP_URL="http://localhost:${BACKEND_PORT}"
FRONTEND_DIST_DIR="$FRONTEND_DIR/dist"
BACKEND_LOG="$LOG_DIR/backend.log"
MONGO_LOG="$LOG_DIR/mongod.log"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
MONGO_PID_FILE="$PID_DIR/mongod.pid"
MONGO_URI_VALUE=""

mkdir -p "$LOG_DIR" "$PID_DIR" "$MONGO_DATA_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

is_port_open() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_http() {
  local url="$1"
  local retries="${2:-40}"

  for ((i = 1; i <= retries; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

ensure_backend_env() {
  if [[ ! -f "$BACKEND_DIR/.env" ]]; then
    cat > "$BACKEND_DIR/.env" <<'ENV'
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/ama-archive
UPLOAD_DIR=uploads
ENV
    echo "Created backend/Archiev-Back/.env with local defaults."
  fi
}

read_mongo_uri() {
  if [[ ! -f "$BACKEND_DIR/.env" ]]; then
    MONGO_URI_VALUE=""
    return 0
  fi

  local value
  value="$(grep -E '^MONGO_URI=' "$BACKEND_DIR/.env" | tail -n 1 | cut -d'=' -f2- || true)"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  MONGO_URI_VALUE="$value"
}

needs_local_mongodb() {
  if [[ -z "$MONGO_URI_VALUE" ]]; then
    return 0
  fi

  if [[ "$MONGO_URI_VALUE" == *"localhost"* || "$MONGO_URI_VALUE" == *"127.0.0.1"* ]]; then
    return 0
  fi

  return 1
}

start_mongodb() {
  if is_port_open "$MONGO_PORT"; then
    echo "MongoDB is already running on port ${MONGO_PORT}."
    return 0
  fi

  echo "Starting MongoDB using dbpath: ${MONGO_DATA_DIR}"
  mkdir -p "$MONGO_DATA_DIR"

  if command -v mongod >/dev/null 2>&1; then
    rm -f "$MONGO_PID_FILE"
    nohup mongod \
      --dbpath "$MONGO_DATA_DIR" \
      --logpath "$MONGO_LOG" \
      --logappend \
      --bind_ip 127.0.0.1 \
      --port "$MONGO_PORT" >/dev/null 2>&1 &
    local mongo_pid="$!"
    echo "$mongo_pid" > "$MONGO_PID_FILE"
    sleep 2
  fi

  if is_port_open "$MONGO_PORT"; then
    echo "MongoDB started."
    return 0
  fi

  if [[ -f "$MONGO_LOG" ]] && grep -q "Permission denied" "$MONGO_LOG"; then
    echo "MongoDB failed due to file permissions in ${MONGO_DATA_DIR}."
    echo "Run this once to fix ownership:"
    echo "  sudo chown -R \"$USER\":staff \"${MONGO_DATA_DIR}\""
    echo "Then run Start_AMA.command again (without sudo)."
    exit 1
  fi

  echo "Could not start MongoDB automatically."
  echo "Install MongoDB, then run this file again."
  exit 1
}

start_backend() {
  if [[ -f "$BACKEND_PID_FILE" ]]; then
    local existing_pid
    existing_pid="$(cat "$BACKEND_PID_FILE" 2>/dev/null || true)"
    if [[ -n "$existing_pid" ]] && kill -0 "$existing_pid" >/dev/null 2>&1; then
      echo "Backend already running (PID ${existing_pid})."
      return 0
    fi
    rm -f "$BACKEND_PID_FILE"
  fi

  echo "Starting backend..."
  cd "$BACKEND_DIR"
  nohup env NODE_ENV=production FRONTEND_DIST_DIR="$FRONTEND_DIST_DIR" node index.js > "$BACKEND_LOG" 2>&1 &
  local backend_pid="$!"
  echo "$backend_pid" > "$BACKEND_PID_FILE"
  cd "$APP_DIR"
}

ensure_frontend_build() {
  if [[ -f "$FRONTEND_DIST_DIR/index.html" ]]; then
    return 0
  fi

  echo "Frontend build not found. Building now..."
  cd "$FRONTEND_DIR"
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    npm install
  fi
  npm run build
  cd "$APP_DIR"
}

require_command node
require_command npm
require_command curl
require_command lsof

if [[ ! -d "$BACKEND_DIR/node_modules" ]]; then
  echo "Backend dependencies not found. Installing..."
  cd "$BACKEND_DIR"
  npm install
  cd "$APP_DIR"
fi

ensure_backend_env
read_mongo_uri
ensure_frontend_build
if needs_local_mongodb; then
  start_mongodb
else
  echo "Using external MongoDB from MONGO_URI. Skipping local MongoDB startup."
fi
start_backend

if ! wait_for_http "${APP_URL}/api/health" 45; then
  echo "Backend failed to start. Last log lines:"
  tail -n 40 "$BACKEND_LOG" || true
  exit 1
fi

echo "AMA Archive is ready at ${APP_URL}"
if [[ "${AMA_NO_OPEN:-0}" == "1" ]]; then
  echo "Browser auto-open skipped (AMA_NO_OPEN=1)."
else
  open "$APP_URL"
fi
