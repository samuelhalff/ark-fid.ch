#!/bin/bash
# start-server.sh – manages app restart and keeps only 4 releases
# Place at: /srv/customer/sites/ark-fid.ch/shared/start-server.sh

set -euo pipefail
BASE="/srv/customer/sites/ark-fid.ch"
PID_FILE="$BASE/ark-fid.pid"
ENV_FILE="$BASE/shared/.env"

echo "[start-server] Starting at $(date)"

# 1. Kill old process
echo "[start-server] Killing old process..."
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE" || true)
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" || true
    sleep 2
    kill -9 "$OLD_PID" 2>/dev/null || true
    echo "[start-server] Killed PID $OLD_PID"
  fi
  rm -f "$PID_FILE"
fi

# Clean up any stray node processes
pkill -9 -f 'node.*server.js' 2>/dev/null || true
pkill -9 -f 'next-server' 2>/dev/null || true
sleep 2

# 2. Load environment variables
if [ -f "$ENV_FILE" ]; then
  echo "[start-server] Loading env from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
else
  echo "[start-server] WARNING: No $ENV_FILE found"
fi

# 3. Ensure symlink exists in current release
if [ -f "$ENV_FILE" ] && [ -L "$BASE/current" ]; then
  ln -sfn "$ENV_FILE" "$BASE/current/.env" 2>/dev/null || true
fi

# 4. Start new process
echo "[start-server] Starting server in $BASE/current"
cd "$BASE/current"

# Safe default for PORT
PORT="${PORT-3000}"
export PORT

nohup node server.js > "$BASE/server.out" 2>&1 &
NEW_PID=$!
echo "$NEW_PID" > "$PID_FILE"

echo "[start-server] Started PID $NEW_PID on port $PORT"

# 5. Cleanup old releases (keep last 4)
RELEASES_DIR="$BASE/releases"
keep=4
releases=$(ls -1 "$RELEASES_DIR" 2>/dev/null | sort)
count=$(echo "$releases" | wc -l | tr -d " ")
if [ "$count" -gt "$keep" ]; then
  to_delete=$((count - keep))
  echo "[start-server] Cleaning up $to_delete old releases..."
  echo "$releases" | head -n "$to_delete" | while read -r d; do
    [ -n "$d" ] && rm -rf "$RELEASES_DIR/$d"
  done
fi

echo "[start-server] Done at $(date)"
exit 0
