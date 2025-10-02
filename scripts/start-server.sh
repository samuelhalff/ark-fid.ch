#!/bin/bash
# start-server.sh
# Deploy helper to kill old processes, load .env, and start fresh server

set -euo pipefail
BASE="/srv/customer/sites/ark-fid.ch"
PID_FILE="$BASE/ark-fid.pid"
ENV_FILE="$BASE/shared/.env"

echo "[start-server] Starting at $(date)"

# --- Kill old process ---
echo "[start-server] Killing old process..."
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    kill -9 "$OLD_PID" 2>/dev/null || true
    echo "[start-server] Killed PID $OLD_PID"
  fi
  rm -f "$PID_FILE"
fi

pkill -9 -f 'node.*server.js' 2>/dev/null || true
pkill -9 -f next-server 2>/dev/null || true
sleep 2

# --- Load .env ---
if [ -f "$ENV_FILE" ]; then
  echo "[start-server] Loading env from $ENV_FILE"
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "[start-server] WARNING: no $ENV_FILE found"
fi

# Ensure symlink for current release
if [ -f "$ENV_FILE" ] && [ -L "$BASE/current" ]; then
  ln -sfn "$ENV_FILE" "$BASE/current/.env"
fi

# --- Start server ---
cd "$BASE/current"
PORT="${PORT:-3000}"
export PORT

# Log what we're actually running
ACTUAL_RELEASE=$(basename "$(readlink -f "$BASE/current")")
BUILD_ID=$(cat .next/BUILD_ID 2>/dev/null || echo "UNKNOWN")
echo "[start-server] ========================================="
echo "[start-server] Starting release: $ACTUAL_RELEASE"
echo "[start-server] BUILD_ID: $BUILD_ID"
echo "[start-server] Path: $PWD"
echo "[start-server] Port: $PORT"
echo "[start-server] ========================================="

echo "[start-server] Starting server in $PWD on port $PORT"
nohup node server.js > "$BASE/server.out" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"
echo "[start-server] Started PID $NEW_PID"

# --- Cleanup releases ---
RELEASES_DIR="$BASE/releases"
keep=4
releases=$(ls -1 "$RELEASES_DIR" | sort)
count=$(echo "$releases" | wc -l | tr -d " ")
if [ "$count" -gt "$keep" ]; then
  to_delete=$((count - keep))
  echo "[start-server] Cleaning up $to_delete old releases"
  echo "$releases" | head -n "$to_delete" | while read -r d; do
    [ -n "$d" ] && rm -rf "$RELEASES_DIR/$d"
  done
else
  echo "[start-server] No old releases to clean"
fi

echo "[start-server] Done at $(date)"
exit 0
