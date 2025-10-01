# Deployment Architecture

## Overview

Next.js standalone app with automated CI/CD deploying to a single VPS server via SSH.

**Server Base:** `/srv/customer/sites/ark-fid.ch/`

```
/srv/customer/sites/ark-fid.ch/
├── artifact/              # Upload target for release tarballs
├── releases/              # Timestamped release directories (YYYYMMDDHHMMSS)
├── current/               # Symlink → active release
├── shared/                # Persistent config & scripts
│   ├── .env               # Environment variables
│   └── start-server.sh    # Server restart script (prevents SSH crash w/ nohup)
├── server.out             # Server stdout/stderr logs
├── .pid                   # Process ID file
└── last_release_ts        # Latest release timestamp
```

---

## CI/CD Pipeline

**Workflow:** `.github/workflows/build-and-deploy.yml`

**Triggers:**

- Push to `main` (app/src/public/config changes)
- Manual dispatch
- AI content updates (`repository_dispatch`)

**Jobs:**

### 1. Build

- `npm ci` → `npm run build` (Next.js standalone)
- `scripts/prepare-artifact.sh` → bundles `.next/standalone` + static assets
- Archives to `next-standalone.tar.gz`
- Uploads artifact to GitHub

### 2. Deploy

- Downloads artifact
- **rsync** uploads `.tar.gz.part` → renames to `.tar.gz` (atomic)
- **Extract & Symlink:** Extracts to `/releases/<timestamp>`, updates `current` symlink
- **Restart:** Calls `/shared/start-server.sh` (prevents SSH hang from `nohup`)
- **Health Check:** Polls `http://127.0.0.1:<PORT>/` (60 retries × 3s), warms routes

---

## Server Setup Requirements

### 1. Directory Structure

```bash
mkdir -p /srv/customer/sites/ark-fid.ch/{artifact,releases,shared}
```

### 2. Environment File

`/srv/customer/sites/ark-fid.ch/shared/.env`

```bash
PORT=3000
NODE_ENV=production

# IndexNow Configuration (required for /api/indexnow/reindex)
INDEXNOW_KEY=ebd95385d7154f45ba37d076b4efd008
INDEXNOW_SECRET=<match-github-actions-secret>
NEXT_PUBLIC_SITE_URL=https://ark-fid.ch

# Other secrets (GA, Azure, etc.)
# ...
```

⚠️ **Critical:** `.env` files are **not deployed** by CI. Must be manually created on server and symlinked during deployment.

**Permissions:**

```bash
chmod 600 /srv/customer/sites/ark-fid.ch/shared/.env
```

### 3. Start Script

`/srv/customer/sites/ark-fid.ch/shared/start-server.sh`

**Purpose:** Detaches server restart from SSH session (prevents `nohup` hang)

**Must:**

- Kill existing process (via `.pid` file + `pkill`)
- Start `node server.js` in background via `nohup`
- Write PID to `../.pid`
- Exit cleanly (avoids blocking SSH)

**Example:**

```bash
#!/bin/bash
set -euo pipefail
BASE="/srv/customer/sites/ark-fid.ch"
PID_FILE="$BASE/.pid"

# Kill old process
[ -f "$PID_FILE" ] && kill -9 $(cat "$PID_FILE") 2>/dev/null || true
pkill -9 -f 'next-server' 2>/dev/null || true

# Start new process
cd "$BASE/current"
PORT=3000 nohup node server.js > "$BASE/server.out" 2>&1 &
echo $! > "$PID_FILE"

# Critical: Exit immediately (don't wait for nohup)
exit 0
```

### 4. Permissions

```bash
chown -R <deploy_user>:<deploy_user> /srv/customer/sites/ark-fid.ch
chmod +x /srv/customer/sites/ark-fid.ch/shared/start-server.sh
```

---

## Local Deploy Scripts

### `quick-deploy.sh`

Fast deploy from existing `npm run build` output (no rebuild)

```bash
./quick-deploy.sh
```

**Requires:** `.env` with `DEPLOY_SSH_*` credentials

### `manual-deploy.sh`

Full rebuild + deploy from local machine

```bash
./manual-deploy.sh
```

### `check-server.sh`

SSH diagnostic: release info, directory structure, logs

```bash
./check-server.sh
```

---

## Key Scripts

### `scripts/prepare-artifact.sh`

Assembles deployable bundle:

- `.next/standalone` → `dist/`
- `.next/static` → `dist/.next/static`
- `public/` → `dist/public`
- Required manifests (build/routes/prerender)

### `scripts/ping-sitemaps.js`

Notifies search engines of sitemap updates (IndexNow, Google, Bing)

---

## Secrets (GitHub Actions)

| Secret                | Description                       |
| --------------------- | --------------------------------- |
| `DEPLOY_SSH_HOST`     | Server IP/domain                  |
| `DEPLOY_SSH_USER`     | SSH username                      |
| `DEPLOY_SSH_PASSWORD` | SSH password                      |
| `DEPLOY_SSH_PORT`     | SSH port (default: 22)            |
| `DEPLOY_PORT`         | Node.js HTTP port (default: 3000) |

---

## Rollback

```bash
ssh user@server
cd /srv/customer/sites/ark-fid.ch
ln -sfn releases/<previous_timestamp> current
shared/start-server.sh
```

---

## Monitoring

- **Logs:** `tail -f /srv/customer/sites/ark-fid.ch/server.out`
- **Process:** `cat /srv/customer/sites/ark-fid.ch/.pid` → `ps aux | grep <pid>`
- **Health:** `curl http://127.0.0.1:3000/`

---

## Troubleshooting

**"SSH hangs during deploy"**  
→ Ensure `start-server.sh` exits immediately after `nohup` (don't wait for process)

**"Server won't start"**  
→ Check `server.out` for errors  
→ Verify `.env` symlink exists in `current/`  
→ Confirm Node.js 20.x installed

**"404 for static assets"**  
→ Verify `prepare-artifact.sh` copies `.next/static` and `public/`  
→ Check `current/.next/static/` exists

**"Build cache miss"**  
→ GitHub Actions cache key tied to `package-lock.json` hash

**"IndexNow 403: User is unauthorized to access the site"**  
→ `INDEXNOW_KEY` not set in `/shared/.env` on production server  
→ See detailed guide: `docs/indexnow-troubleshooting.md`  
→ Verify key file accessible: `curl https://ark-fid.ch/<INDEXNOW_KEY>.txt`
