#!/bin/bash
# Quick remote check - Run this to see what's actually deployed
# Usage: ./check-deployed.sh

if [ ! -f .env ]; then
  echo "❌ .env file not found. Cannot connect to server."
  exit 1
fi

source .env

if [ -z "$DEPLOY_SSH_USER" ] || [ -z "$DEPLOY_SSH_HOST" ] || [ -z "$DEPLOY_SSH_PASSWORD" ]; then
  echo "❌ Missing SSH credentials in .env"
  exit 1
fi

echo "🔍 Checking deployed version on server..."
echo ""

sshpass -p "$DEPLOY_SSH_PASSWORD" ssh -p "${DEPLOY_SSH_PORT:-22}" -o StrictHostKeyChecking=no \
  "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST" 'bash -s' << 'ENDSSH'
  BASE="/srv/customer/sites/ark-fid.ch"
  
  echo "📦 Current Release:"
  if [ -L "$BASE/current" ]; then
    RELEASE=$(basename "$(readlink -f "$BASE/current")")
    echo "   $RELEASE"
  else
    echo "   ❌ No current symlink!"
  fi
  
  echo ""
  echo "🔖 BUILD_ID:"
  if [ -f "$BASE/current/.next/BUILD_ID" ]; then
    cat "$BASE/current/.next/BUILD_ID"
  else
    echo "   ❌ BUILD_ID not found"
  fi
  
  echo ""
  echo "🚀 Process Status:"
  if [ -f "$BASE/ark-fid.pid" ]; then
    PID=$(cat "$BASE/ark-fid.pid")
    if kill -0 "$PID" 2>/dev/null; then
      echo "   ✅ Running (PID: $PID)"
      PROC_DIR=$(pwdx "$PID" 2>/dev/null | awk '{print $2}')
      echo "   Working dir: $PROC_DIR"
    else
      echo "   ❌ Not running (stale PID)"
    fi
  else
    echo "   ⚠️  No PID file"
  fi
  
  echo ""
  echo "📊 Latest 5 Releases:"
  ls -1t "$BASE/releases" 2>/dev/null | head -5 | while read r; do
    if [ -L "$BASE/current" ] && [ "$(readlink -f "$BASE/current")" = "$BASE/releases/$r" ]; then
      echo "   → $r (CURRENT)"
    else
      echo "     $r"
    fi
  done
  
  echo ""
  echo "📝 Recent Server Logs (last 10 lines):"
  tail -10 "$BASE/server.out" 2>/dev/null | sed 's/^/   /'
ENDSSH

echo ""
echo "✅ Check complete!"
