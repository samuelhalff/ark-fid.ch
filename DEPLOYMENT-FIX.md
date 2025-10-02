# Deployment Fix - Minimal Change

## Problem

CI succeeds but new version not deployed.

## Root Cause

Next.js `.next/cache` directory persists between deployments, causing old content to be served even after successful builds.

## Solution

Added cache clearing in `scripts/start-server.sh` before starting the server.

## Change Made

```bash
# --- Clear Next.js cache to ensure fresh deployment ---
echo "[start-server] Clearing Next.js cache..."
if [ -d "$BASE/current/.next/cache" ]; then
  rm -rf "$BASE/current/.next/cache"
  echo "[start-server] Cache cleared"
fi
```

## Why This Fix

- **Minimal**: Only 6 lines added
- **Safe**: Doesn't change working process management
- **Targeted**: Fixes the exact issue (stale cache)
- **Non-breaking**: Cache directory may not exist (first deploy), check handles this

## Testing

1. Commit and push:

   ```bash
   git add scripts/start-server.sh
   git commit -m "Fix: Clear Next.js cache on deployment"
   git push origin main
   ```

2. Check version after deploy:

   ```bash
   ssh user@server 'bash /srv/customer/sites/ark-fid.ch/scripts/check-version.sh'
   ```

3. Look for in logs:
   ```
   [start-server] Clearing Next.js cache...
   [start-server] Cache cleared
   ```

## Rollback (if needed)

```bash
git revert HEAD
git push origin main
```

## Note

This preserves all existing logic:

- ✅ Process killing unchanged
- ✅ Symlink management unchanged
- ✅ .env loading unchanged
- ✅ Release cleanup unchanged

Only adds cache clearing before server start.
