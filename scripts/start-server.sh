#!/usr/bin/env bash
# start-server.sh - manages Node.js server restart with .env loading
# This file is deployed to: /srv/customer/sites/ark-fid.ch/shared/start-server.sh

set -euo pipefail
BASE="/srv/customer/sites/ark-fid.ch"
PID_FILE="$BASE/ark-fid.pid"
ENV_FILE="$BASE/shared/.env"
LOG="$BASE/deploy.log"

echo "[start-server] Starting at $(date)" >> "$LOG"

# 1. Kill old process
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    echo "[start-server] Stopping old PID $OLD_PID" >> "$LOG"
    kill "$OLD_PID" || true
    sleep 2
    kill -9 "$OLD_PID" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
fi
pkill -9 -f 'node.*server.js' 2>/dev/null || true
pkill -9 -f 'next-server' 2>/dev/null || true
sleep 2

# 2. Load environment variables
if [ -f "$ENV_FILE" ]; then
  echo "[start-server] Loading env from $ENV_FILE" >> "$LOG"
  set -a
  source "$ENV_FILE"
  set +a
  # Explicitly export critical variables for Node.js
  export PORT NODE_ENV INDEXNOW_KEY INDEXNOW_SECRET NEXT_PUBLIC_SITE_URL
  echo "[start-server] Exported env vars: PORT=$PORT, NODE_ENV=$NODE_ENV" >> "$LOG"
  echo "[start-server] INDEXNOW_KEY length: ${#INDEXNOW_KEY}, INDEXNOW_SECRET length: ${#INDEXNOW_SECRET}" >> "$LOG"
else
  echo "[start-server] WARNING: $ENV_FILE not found" >> "$LOG"
fi

# 3. Ensure .env symlink inside current release
if [ -f "$ENV_FILE" ] && [ -L "$BASE/current" ]; then
  ln -sfn "$ENV_FILE" "$BASE/current/.env" || true
fi

# 4. Start new process
cd "$BASE/current"
PORT="${PORT:-3000}"
echo "[start-server] Starting server.js on port $PORT" >> "$LOG"

# Truncate server.out on each start
# Pass environment variables explicitly to nohup/node to ensure they're inherited
env PORT="$PORT" \
    NODE_ENV="${NODE_ENV:-production}" \
    INDEXNOW_KEY="${INDEXNOW_KEY:-}" \
    INDEXNOW_SECRET="${INDEXNOW_SECRET:-}" \
    NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-https://ark-fid.ch}" \
    NEXT_PUBLIC_GA_ID="${NEXT_PUBLIC_GA_ID:-}" \
    nohup node server.js > "$BASE/server.out" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"
echo "[start-server] Started PID $NEW_PID with env vars" >> "$LOG"

# Optional: health check
ATTEMPTS=30
for i in $(seq 1 $ATTEMPTS); do
  if curl -fs "http://127.0.0.1:$PORT/" >/dev/null 2>&1; then
    echo "[start-server] Health check passed" >> "$LOG"
    exit 0
  fi
  sleep 2
done

echo "[start-server] Health check FAILED after $ATTEMPTS tries" >> "$LOG"
exit 1
# Note: The server.out log file can be monitored for startup issues
# Example: tail -f /srv/customer/sites/ark-fid.ch/server.out