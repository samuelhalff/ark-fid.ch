Ark Fiduciaire Website 2025

## IndexNow Automation

This repo includes an automated IndexNow reindex step via GitHub Actions.

- API route: `POST /api/indexnow/reindex` – submits core localized pages to IndexNow
- Auth: Provide `x-indexnow-secret` header matching `INDEXNOW_SECRET`

### Setup

1. Configure environment variables in your hosting platform:

   - `NEXT_PUBLIC_SITE_URL` – e.g. `https://ark-fid.ch`
   - `INDEXNOW_KEY` – a random key string; the key file will be served at `/<INDEXNOW_KEY>.txt`
   - `INDEXNOW_SECRET` – a separate secret to protect the reindex endpoint

2. In GitHub repository settings → Secrets and variables → Actions, create:

   - `INDEXNOW_SECRET` – same value as in hosting
   - (Optional) `SITE_URL` – override if not using `https://ark-fid.ch`

3. The workflow lives at `.github/workflows/indexnow-reindex.yml` and runs on:
   - push to `main`
   - manual dispatch

The job retries up to 3 times on non-200 responses.
