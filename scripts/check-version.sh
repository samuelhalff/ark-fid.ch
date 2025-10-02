#!/bin/bash
# Quick check to verify which version is deployed
# Usage: ssh to server and run this, or: ssh user@server 'bash /path/to/check-version.sh'

BASE="/srv/customer/sites/ark-fid.ch"

echo "Current release:"
if [ -L "$BASE/current" ]; then
  readlink "$BASE/current" | xargs basename
else
  echo "  ERROR: No current symlink"
fi

echo ""
echo "BUILD_ID:"
if [ -f "$BASE/current/.next/BUILD_ID" ]; then
  cat "$BASE/current/.next/BUILD_ID"
else
  echo "  Not found"
fi

echo ""
echo "Process:"
if [ -f "$BASE/ark-fid.pid" ]; then
  PID=$(cat "$BASE/ark-fid.pid")
  if kill -0 "$PID" 2>/dev/null; then
    echo "  Running (PID $PID)"
  else
    echo "  Not running (stale PID)"
  fi
else
  echo "  No PID file"
fi
