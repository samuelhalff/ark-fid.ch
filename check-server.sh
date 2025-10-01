#!/bin/bash
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
sshpass -p "$DEPLOY_SSH_PASSWORD" ssh -T -p "${DEPLOY_SSH_PORT:-22}" "$DEPLOY_SSH_USER@$DEPLOY_SSH_HOST" "
  echo '=== Current release ==='
  cat /srv/customer/sites/ark-fid.ch/current/.release-info 2>/dev/null || echo 'No release info'
  echo ''
  echo '=== Directory structure ==='
  ls -la /srv/customer/sites/ark-fid.ch/current/.next/ 2>/dev/null || echo 'No .next dir'
  echo ''
  echo '=== Static directory ==='
  ls -la /srv/customer/sites/ark-fid.ch/current/.next/static/ 2>/dev/null | head -20 || echo 'No static dir'
  echo ''
  echo '=== Server logs (last 30 lines) ==='
  tail -30 /srv/customer/sites/ark-fid.ch/server.out
"
