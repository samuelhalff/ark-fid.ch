# Production Fix: Unlock Chat Feature (Turnstile Integration)

## Issue Summary
The unlock chat feature was working in staging but failing in production. Root cause: Missing Turnstile environment configuration.

## Root Cause Analysis

### What Happened
The production environment had `TURNSTILE_SECRET_KEY` configured (backend) but was missing `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (frontend). This created a mismatch:

1. **Frontend**: No Turnstile site key → No widget rendered → No token generated
2. **Backend**: Requires Turnstile token → Rejects requests without token
3. **Result**: Users couldn't unlock chat, saw "Please complete the verification" error

### Why It Happened
- Turnstile environment variables were not documented in `.env.example`
- Deployment documentation didn't mention Turnstile configuration
- No validation warnings to catch misconfiguration

## Immediate Fix (For Production Team)

### Step 1: Get Turnstile Keys
1. Go to https://dash.cloudflare.com/
2. Navigate to **Turnstile** in the left sidebar
3. Select your existing widget (or create new if needed)
4. Copy both keys:
   - **Site Key** (public)
   - **Secret Key** (private)

### Step 2: Configure Server Environment
```bash
# SSH to production server
ssh K83cyp5GeC2_samhalff@57-101943.ssh.hosting-ik.com

# Edit environment file
cd /srv/customer/sites/ark-fid.ch/shared
nano .env

# Add these lines (replace with your actual keys):
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

Save and exit (Ctrl+X, Y, Enter).

### Step 3: Configure GitHub Secrets (For Build)
Since `NEXT_PUBLIC_*` variables are embedded during build:

1. Go to: https://github.com/samuelhalff/ark-fid.ch/settings/secrets/actions
2. Click "New repository secret"
3. Add:
   - **Name**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - **Value**: `<your-site-key>`
4. Click "Add secret"

### Step 4: Rebuild and Deploy
The frontend needs to be rebuilt to include the public environment variable:

**Option A: Trigger GitHub Actions Deployment**
1. Go to: https://github.com/samuelhalff/ark-fid.ch/actions
2. Select "Build and Deploy" workflow
3. Click "Run workflow" → "Run workflow"
4. Wait for deployment to complete (~5-10 minutes)

**Option B: Manual Deployment (Faster)**
```bash
# From your local machine
git pull origin main
./manual-deploy.sh
```

### Step 5: Verify Fix
1. Open https://ark-fid.ch/agent in private browsing
2. Click to unlock chat
3. Fill in name and email
4. **Verify Turnstile widget appears** (should see Cloudflare checkbox or invisible verification)
5. Submit form
6. **Chat should unlock successfully**

### Step 6: Check Logs
After deployment, verify no warnings:
```bash
ssh K83cyp5GeC2_samhalff@57-101943.ssh.hosting-ik.com
tail -f /srv/customer/sites/ark-fid.ch/server.out | grep -i turnstile
```

**Expected**: No warnings about missing keys  
**If you see warnings**: Re-check that both keys are in `/srv/customer/sites/ark-fid.ch/shared/.env`

## Changes Made in This PR

### 1. Documentation Updates
- **`.env.example`**: Added Turnstile environment variables with descriptions
- **`DEPLOYMENT.md`**: Added Turnstile configuration to server setup guide
- **`DEPLOYMENT-CHECKLIST.md`**: Added step-by-step Turnstile setup instructions
- **`docs/turnstile-troubleshooting.md`**: Created comprehensive troubleshooting guide

### 2. Code Improvements
- **`app/api/agent/chat/route.ts`**: Added configuration validation warnings
  - Logs warning if only backend key is set
  - Logs warning if only frontend key is set
  - Helps diagnose issues quickly in production

### 3. Security
- No secrets exposed in code changes
- All documentation clearly marks public vs secret keys
- CodeQL scan: 0 security issues found

## Testing Completed
- ✅ Code review: 2 issues found and fixed
- ✅ CodeQL security scan: No vulnerabilities
- ✅ Documentation accuracy verified
- ✅ Configuration validation logic reviewed

## Long-term Prevention

### For Future Deployments
1. Always check `.env.example` for new variables before deploying
2. Compare server `.env` with `.env.example` regularly
3. Monitor server logs for configuration warnings
4. Use the new troubleshooting guide when issues arise

### Monitoring
The backend now logs warnings for misconfiguration. Set up alerts for:
```
[agent] WARNING: TURNSTILE_SECRET_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing
```

## Reference Documentation
- **Troubleshooting Guide**: `docs/turnstile-troubleshooting.md`
- **Deployment Guide**: `DEPLOYMENT.md` (lines 137-145)
- **Deployment Checklist**: `DEPLOYMENT-CHECKLIST.md` (lines 148-166)
- **Environment Variables**: `.env.example` (lines 115-122)

## Support
If the issue persists after following this guide:
1. Check the troubleshooting guide: `docs/turnstile-troubleshooting.md`
2. Enable debug mode: Add `DEBUG_AGENT=1` to `.env` and restart
3. Review server logs for detailed error messages
4. Verify Cloudflare Turnstile widget is active in dashboard

## Rollback Plan
If this causes any issues:
1. Remove Turnstile keys from `.env`:
   ```bash
   # On server
   nano /srv/customer/sites/ark-fid.ch/shared/.env
   # Comment out or remove:
   # NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
   # TURNSTILE_SECRET_KEY=...
   ```
2. Rebuild and redeploy
3. Chat will work without verification (less secure but functional)

---

**Status**: Ready for production deployment  
**Priority**: High (core feature broken in production)  
**Estimated Fix Time**: 15-30 minutes (including rebuild)
