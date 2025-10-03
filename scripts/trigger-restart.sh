#!/bin/bash
set -e

# Trigger application restart via the /api/restart endpoint
# This script should be called after updating the 'current' symlink during deployment
# The endpoint triggers process.exit(0), causing Infomaniak's orchestrator to restart the app

SITE_URL="${SITE_URL:-https://ark-fid.ch}"
RESTART_SECRET="${RESTART_SECRET_TOKEN}"
MAX_RETRIES=3
RETRY_DELAY=5

if [ -z "$RESTART_SECRET" ]; then
    echo "❌ ERROR: RESTART_SECRET_TOKEN environment variable is not set"
    exit 1
fi

echo "🔄 Triggering application restart..."
echo "   Site: $SITE_URL"

# Function to trigger restart
trigger_restart() {
    local attempt=$1
    echo "   Attempt $attempt/$MAX_RETRIES..."
    
    response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $RESTART_SECRET" \
        -H "Content-Type: application/json" \
        --max-time 10 \
        "$SITE_URL/api/restart" 2>&1)
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ]; then
        echo "✅ Restart triggered successfully"
        echo "   Response: $body"
        return 0
    else
        echo "⚠️  Restart request returned HTTP $http_code"
        echo "   Response: $body"
        return 1
    fi
}

# Try to trigger restart with retries
success=false
for attempt in $(seq 1 $MAX_RETRIES); do
    if trigger_restart $attempt; then
        success=true
        break
    fi
    
    if [ $attempt -lt $MAX_RETRIES ]; then
        echo "   Waiting ${RETRY_DELAY}s before retry..."
        sleep $RETRY_DELAY
    fi
done

if [ "$success" = false ]; then
    echo "❌ Failed to trigger restart after $MAX_RETRIES attempts"
    exit 1
fi

echo ""
echo "⏳ Waiting for application to restart (30 seconds)..."
sleep 30

# Verify the site is responding
echo "🔍 Verifying site is online..."
if curl -f -s --max-time 10 "$SITE_URL" > /dev/null; then
    echo "✅ Site is responding"
    exit 0
else
    echo "⚠️  Site is not responding yet (may need more time)"
    exit 1
fi
