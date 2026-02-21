#!/bin/zsh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$APP_DIR/backend/Archiev-Back"
FRONTEND_DIR="$APP_DIR/frontend/achive-front"
RUNTIME_DIR="$APP_DIR/.runtime"
LOG_DIR="$RUNTIME_DIR/logs"
PID_DIR="$RUNTIME_DIR/pids"
MONGO_DATA_DIR="$HOME/data/db"

mkdir -p "$LOG_DIR" "$PID_DIR" "$MONGO_DATA_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

require_command node
require_command npm

echo "Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install

if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cat > "$BACKEND_DIR/.env" <<'ENV'
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/ama-archive
UPLOAD_DIR=uploads
ENV
  echo "Created backend/Archiev-Back/.env with local defaults."
fi

echo "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install

echo "Building frontend for production..."
npm run build

echo ""
echo "Setup completed successfully."
echo "Next: double-click Start_AMA.command"

if [[ -t 0 ]]; then
  read '?Press Enter to close...'
fi
