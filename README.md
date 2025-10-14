Ark Fiduciaire SA Website 2025

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

## SEO & Internationalization

### Locale-specific Open Graph / Twitter Images

Place per-locale images in `public/assets/og/` named:

- `og-fr.webp`
- `og-de.webp`
- `og-en.webp`
- `og-es.webp`
- `og-pt.webp`

Guidelines:

- 1200x630 px (or 1200x628), ≤300 KB, WebP preferred.
- Provide PNG only if a platform rejects WebP.
- Missing locale falls back to `/assets/main-bg.webp`.
- Logic: `src/lib/metadata.ts` (selectOgImageForLocale).

Verification:

1. View page source for `og:image` / `twitter:image`.
2. Use Sharing Debugger / Card Validator.
3. Keep filenames stable or append `?v=2` for cache bust.

### Google Search Console Checklist

1. Verify domain property via DNS (preferred) or URL-prefix via HTML tag.
2. Submit sitemap: `https://ark-fid.ch/sitemap.xml`.
3. Live test sample localized URLs to confirm hreflang cluster.
4. Monitor Breadcrumbs, FAQ, Articles enhancement reports.
5. Coverage anomalies: spikes in soft 404 or crawled-currently-not-indexed.
6. International targeting relies on hreflang + sitemap; ensure no locale 404s.

### Structured Data Summary

- FAQPage: Home.
- BreadcrumbList: Services index + each service page + articles.
- Article: Resource articles.
- (Optional future) Organization / Website for logo.

### Security / SRI

- CSP nonce in `middleware.ts`.
- HSTS active (prod).
- Expect-CT (deprecated) retained; removable later.
- Add SRI hashes for any future external scripts.

### Core Web Vitals

- LCP images prioritized + fetchPriority.
- Dynamic imports for non-critical sections (FAQ, Testimonials) reduce main thread.
- Internal link checker (`npm run links:check`).

### Accessibility

- Global `:focus-visible` outline.
- `aria-current="page"` on active primary nav links.
- Alt text verified on key images.

## Ressources Synchronization

Canonical content lives in `src/translations/fr/ressources.json`.

Scripts:

- `npm run ressources:check` – dry-run parity check (exit code 1 if divergence)
- `npm run ressources:sync` – overwrite `en,de,es,pt` with canonical FR JSON

Direct usage:

```
node scripts/sync-ressources.js --check
node scripts/sync-ressources.js --apply
node scripts/sync-ressources.js --locales=en,pt --apply
```

Notes:

- Filenames, slugs, URLs are copied verbatim; translate only textual fields after sync.
- Run a check before committing to ensure parity.
- Add new files/articles only in FR, then sync and translate other locales as needed.

## AI-driven Ressources Update (every 4 days)

Script: `scripts/ai-ressources-update.js`

Providers:

- Azure Agent with Bing grounding (requires `AZURE_AGENT_*` envs)

Environment (DefaultAzureCredential):

```
# Required
AZURE_AGENT_ENDPOINT=...
AZURE_AGENT_ID=...

# Optional
AZURE_TRANSLATE_AGENT_ID=...
AZURE_AGENT_RUN_TIMEOUT_MS=180000
```

Authentication is handled through the Azure Identity DefaultAzureCredential chain. Supported options:

- Local dev: run `az login` first.
- GitHub Actions / CI: configure a federated service principal and call `azure/login@v2` with `allow-no-subscriptions: true` plus `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` secrets.
- Service principal secrets: set `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` in the environment.
- Managed identity when running inside Azure hosting.

Usage examples:

```
# Dry run / apply
node scripts/ai-ressources-update.js --dry-run
node scripts/ai-ressources-update.js --apply
```

Notes:

- The script expects JSON responses matching the specified schema. If the agent returns non-JSON content, adjust the agent instructions to produce `application/json` payloads.
- GitHub workflow `.github/workflows/ai-ressources-every-2-days.yml` automates the run every two days using OIDC-based Azure login.

## Ressources Link Integrity

To detect broken (404) document links or missing locally cached PDFs for the ressources section:

Scripts:

- `node scripts/check-ressources-links.js --locale fr` – check only French locale for missing local files.
- `node scripts/check-ressources-links.js --all-locales` – scan every locale folder.
- `node scripts/check-ressources-links.js --all-locales --remote` – also perform remote HTTP HEAD/GET to validate `source_url` (slower).
- `node scripts/check-ressources-links.js --all-locales --json` – output machine-readable JSON summary.

Exit codes:

- `0` all links OK
- `1` at least one missing local file (not present in `public/assets/downloads/`)
- `2` remote check enabled and at least one remote resource failed (non 2xx or network error)

Workflow recommendation:

1. Add/update entries in canonical `fr`.
2. Run `node scripts/download-missing-pdfs.js --locale fr` to fetch available PDFs.
3. Run link integrity check across all locales: `node scripts/check-ressources-links.js --all-locales`.
4. Fix or remove any persistent 404 sources (sometimes official sources rename or retract documents).
5. Sync other locales if structure changed: `npm run ressources:sync`.

If an official PDF returns 404, prefer temporarily removing its entry across locales (preserving commit history) rather than leaving a broken download link in production.

```
# IndexNow setup complete
# Deployment trigger - Wed Oct  1 13:31:16 UTC 2025
```

# Test deployment
