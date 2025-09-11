(Temp) README SEO additions draft:

## SEO & Internationalization

### Locale-specific Open Graph / Twitter Images

Place per-locale images in `public/assets/og/` named:

- `og-fr.webp|png`
- `og-de.webp|png`
- `og-en.webp|png`
- `og-es.webp|png`
- `og-pt.webp|png`

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
