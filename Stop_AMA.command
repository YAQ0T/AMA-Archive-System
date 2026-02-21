#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$APP_DIR/.runtime/pids"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
MONGO_PID_FILE="$PID_DIR/mongod.pid"

stop_pid_from_file() {
  local pid_file="$1"
  local label="$2"

  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"

  if [[ -z "$pid" ]]; then
    rm -f "$pid_file"
    return 0
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    echo "Stopping ${label} (PID ${pid})..."
    kill "$pid" >/dev/null 2>&1 || true

    for _ in {1..10}; do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done

    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  fi

  rm -f "$pid_file"
}

stop_pid_from_file "$BACKEND_PID_FILE" "backend"
stop_pid_from_file "$MONGO_PID_FILE" "local MongoDB"

echo "AMA Archive stop script completed."
