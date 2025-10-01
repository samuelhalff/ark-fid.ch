#!/bin/bash
set -e

# Usage: ./redeploy-only.sh [--no-restart]
# --no-restart: Upload and extract files but don't restart the server

RESTART_SERVER=true
if [ "$1" = "--no-restart" ]; then
  RESTART_SERVER=false
  echo "⚠️  Running in no-restart mode (files only)"
fi

source .env

if [ ! -d "dist" ]; then
  echo "❌ No dist folder found. Run npm run build first."
  exit 1
fi

echo "📦 Creating tarball from existing dist..."
tar -czf quick-deploy.tar.gz -C dist .

echo "📤 Uploading to server..."
sshpass -p "$DEPLOY_SSH_PASSWORD" scp -P "$DEPLOY_SSH_PORT" -o StrictHostKeyChecking=no \
  quick-deploy.tar.gz "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST:/tmp/"

echo "🚀 Deploying..."
sshpass -p "$DEPLOY_SSH_PASSWORD" ssh -p "$DEPLOY_SSH_PORT" -o StrictHostKeyChecking=no \
  "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST" "
  set -e
  BASE=/srv/customer/sites/ark-fid.ch
  REL=\$BASE/releases/\$(date +%Y%m%d-%H%M%S)
  
  # Create and extract to new release directory
  mkdir -p \$REL
  cd \$REL
  
  # Verify tarball exists
  if [ ! -f /tmp/quick-deploy.tar.gz ]; then
    echo '❌ Tarball not found on server'
    exit 1
  fi
  
  # Extract and verify
  tar -xzf /tmp/quick-deploy.tar.gz
  if [ ! -f server.js ]; then
    echo '❌ Extraction failed - server.js not found'
    rm -rf \$REL
    exit 1
  fi
  
  rm /tmp/quick-deploy.tar.gz
  
  # Link .env file
  ln -sf \$BASE/.env .env
  
  # Verify critical files exist
  if [ ! -d .next/static/css ]; then
    echo '❌ CSS files missing from release'
    rm -rf \$REL
    exit 1
  fi
  
  echo '✅ Release validated'
  
  # Only restart server if requested
  if [ '$RESTART_SERVER' = 'true' ]; then
    echo 'Switching to new release and restarting server...'
    ln -sfn \$REL \$BASE/current
    
    # Kill by PID file
    if [ -f \$BASE/.pid ]; then
      OLD_PID=\$(cat \$BASE/.pid)
      kill -9 \$OLD_PID 2>/dev/null || true
      rm -f \$BASE/.pid
    fi
    # Kill any Node.js processes (more aggressive pattern)
    pkill -9 -f 'node.*server\.js' || true
    sleep 2
    
    cd \$BASE/current
    PORT=3000 nohup node server.js > \$BASE/server.out 2>&1 & echo \$! > \$BASE/.pid
    
    sleep 3
    curl -fsS http://127.0.0.1:3000/ && echo '✅ Server OK' || echo '❌ Server failed'
  else
    echo '⚠️  Files uploaded to \$REL but not activated'
    echo '   To activate: ssh to server and run:'
    echo '   ln -sfn \$REL /srv/customer/sites/ark-fid.ch/current && systemctl restart your-service'
  fi
"

echo "✅ Deployment complete!"
