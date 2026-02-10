# Turnstile Integration Troubleshooting Guide

## Overview

Cloudflare Turnstile is used to protect the agent chat unlock feature from bot abuse. This guide helps diagnose and fix common Turnstile configuration issues.

## How It Works

### Frontend (AgentChat.tsx)
1. Loads Turnstile script from Cloudflare CDN
2. Renders invisible/visible widget in the lead capture modal
3. Captures token when user completes verification
4. Sends token with lead registration request

### Backend (app/api/agent/chat/route.ts)
1. Receives lead registration request with turnstile token
2. Verifies token with Cloudflare's siteverify API
3. Creates lead in SharePoint if verification passes
4. Returns leadId and leadToken for subsequent chat messages

## Required Configuration

Both environment variables must be configured together:

### Frontend Key (Public)
```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<your-site-key>
```
- Visible in browser/client code
- Used to render the Turnstile widget
- Get from: https://dash.cloudflare.com/ → Turnstile → Your Widget → Settings

### Backend Key (Secret)
```bash
TURNSTILE_SECRET_KEY=<your-secret-key>
```
- Server-side only (never exposed to browser)
- Used to verify tokens with Cloudflare API
- Get from: https://dash.cloudflare.com/ → Turnstile → Your Widget → Settings

## Common Issues

### Issue 1: Chat Unlock Fails with "Please complete the verification"

**Symptoms:**
- User doesn't see Turnstile widget
- Submit button is disabled even with valid email
- Error message: "Please complete the verification"

**Root Cause:**
Backend has `TURNSTILE_SECRET_KEY` configured but frontend is missing `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.

**Fix:**
1. Check server logs for warning:
   ```
   [agent] WARNING: TURNSTILE_SECRET_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing.
   ```

2. Add the missing key to your `.env` file or hosting environment:
   ```bash
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=<your-site-key>
   ```

3. Rebuild and redeploy the application (Next.js requires rebuild for `NEXT_PUBLIC_*` vars)

4. Verify in browser DevTools that `process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY` is defined

### Issue 2: Turnstile Widget Shows but Verification Fails

**Symptoms:**
- Turnstile widget renders and user completes it
- Token is captured but request fails
- Error message: "Please complete the verification"
- Backend returns `turnstile_failed` error

**Root Cause:**
1. `TURNSTILE_SECRET_KEY` is missing or incorrect
2. Token verification fails with Cloudflare API
3. Site key and secret key don't match (from different widgets)

**Fix:**
1. Check server logs for:
   ```
   [agent] Turnstile verify failed <status-code>
   ```

2. Verify both keys are from the same Turnstile widget in Cloudflare dashboard

3. Test token verification manually:
   ```bash
   curl -X POST https://challenges.cloudflare.com/turnstile/v0/siteverify \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "secret=<your-secret-key>&response=<test-token>"
   ```

4. Check response for error details

### Issue 3: No Verification Required (Insecure)

**Symptoms:**
- Turnstile widget renders
- User can submit without completing verification
- No security validation on backend

**Root Cause:**
Frontend has `NEXT_PUBLIC_TURNSTILE_SITE_KEY` but backend is missing `TURNSTILE_SECRET_KEY`.

**Fix:**
1. Check server logs for warning:
   ```
   [agent] WARNING: NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing.
   ```

2. Add the secret key to server environment:
   ```bash
   TURNSTILE_SECRET_KEY=<your-secret-key>
   ```

3. Restart the application (no rebuild needed for server-only env vars)

### Issue 4: Turnstile Widget Not Loading

**Symptoms:**
- Modal opens but no Turnstile widget appears
- Console error about Turnstile script
- Widget container is empty

**Root Cause:**
1. Cloudflare Turnstile script blocked by ad blocker
2. CSP (Content Security Policy) blocking external scripts
3. Network connectivity issues

**Fix:**
1. Check browser console for errors:
   - CSP violations
   - Failed script loads
   - Network errors

2. Verify script loads:
   ```javascript
   // In browser DevTools console:
   window.turnstile !== undefined
   ```

3. Check CSP headers allow Cloudflare:
   ```
   script-src 'self' https://challenges.cloudflare.com;
   frame-src 'self' https://challenges.cloudflare.com;
   ```

4. Test with ad blockers disabled

## Deployment Checklist

### Local Development
```bash
# .env.local
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<dev-site-key>
TURNSTILE_SECRET_KEY=<dev-secret-key>
```

### Staging/Production
1. **Add to server `.env` file:**
   ```bash
   ssh user@server
   cd /srv/customer/sites/ark-fid.ch/shared
   nano .env
   # Add both keys
   ```

2. **Add to GitHub Secrets (for build process):**
   ```
   Settings → Secrets → Actions → New repository secret
   Name: NEXT_PUBLIC_TURNSTILE_SITE_KEY
   Value: <prod-site-key>
   ```

3. **Verify configuration:**
   ```bash
   # On server after deployment
   cd /srv/customer/sites/ark-fid.ch/current
   node -e "console.log(process.env.TURNSTILE_SECRET_KEY ? 'BACKEND: OK' : 'BACKEND: MISSING')"
   ```

4. **Test in browser:**
   - Open https://ark-fid.ch/agent
   - Open DevTools → Console
   - Run: `console.log(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)`
   - Should show the site key (not undefined)

## Monitoring

### Server Logs
Watch for configuration warnings:
```bash
tail -f /srv/customer/sites/ark-fid.ch/server.out | grep -i turnstile
```

### Expected Logs (Healthy)
- No warnings about missing keys
- No "Turnstile verify failed" messages

### Error Logs (Issues)
```
[agent] WARNING: TURNSTILE_SECRET_KEY is set but NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing.
[agent] WARNING: NEXT_PUBLIC_TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET_KEY is missing.
[agent] Turnstile verify failed 401
```

### Browser DevTools
1. **Network tab:**
   - Look for `siteverify` requests to Cloudflare
   - Check request/response for errors

2. **Console tab:**
   - Turnstile script load errors
   - Widget render errors

## Testing

### Manual Test
1. Navigate to `/agent` page
2. Click "Unlock chat" or similar button
3. Fill in name and email
4. Verify Turnstile widget appears
5. Complete verification (if visible)
6. Submit form
7. Chat should unlock successfully

### Expected Behavior
- Widget renders (or invisible verification completes automatically)
- Submit button enabled after verification
- No error messages
- Lead created in SharePoint
- Chat unlocked and ready to use

### Debug Mode
Enable detailed logging:
```bash
DEBUG_AGENT=1
```

This will log:
- Email domain validation
- Turnstile verification results
- Lead creation process

## Getting Turnstile Keys

1. **Sign in to Cloudflare:** https://dash.cloudflare.com/
2. **Navigate to Turnstile:** Left sidebar → Turnstile
3. **Create or select widget:**
   - Click "Add Widget" if creating new
   - Select existing widget if already created
4. **Copy keys:**
   - **Site Key** → Use for `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
   - **Secret Key** → Use for `TURNSTILE_SECRET_KEY`
5. **Configure widget settings:**
   - Mode: Managed (recommended)
   - Domain: ark-fid.ch (and any staging domains)

## Security Notes

- **Never commit** `TURNSTILE_SECRET_KEY` to version control
- Use different keys for development/staging/production
- Rotate keys if compromised
- Monitor Cloudflare dashboard for suspicious activity
- Consider rate limiting in addition to Turnstile

## Support

If issues persist after following this guide:

1. Check Cloudflare Turnstile status: https://www.cloudflarestatus.com/
2. Review Cloudflare Turnstile documentation: https://developers.cloudflare.com/turnstile/
3. Check application logs for detailed error messages
4. Test with `DEBUG_AGENT=1` environment variable enabled
