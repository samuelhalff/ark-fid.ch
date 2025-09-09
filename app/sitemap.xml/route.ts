import { NextResponse } from 'next/server';
import { locales } from '@/src/lib/i18n'; // adjust exports
import fs from 'fs';
import path from 'path';

const BASE = 'https://ark-fid.ch';
// static routes
const staticPaths = ['/', '/about', '/services', '/ressources', '/contact', '/team', '/legal/terms', '/legal/privacy', '/legal/cookies'];

// dynamic routes
const servicePaths = ['/services/accounting', '/services/taxes', '/services/payroll', '/services/incorporation', '/services/outsourcing', '/services/corporate', '/services/domiciliation'];

const ressourcesArticles = (() => {
  const dir = path.join(process.cwd(), 'app', 'ressources', 'articles');
  const slugs: string[] = [];
  try {
    if (fs.existsSync(dir)) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          // if the subdirectory contains any .json file, treat the directory name as the slug
          const subFiles = fs.readdirSync(path.join(dir, e.name));
          if (subFiles.some((f) => f.endsWith('.json'))) {
            slugs.push(`/ressources/articles/${e.name}`);
          }
        } else if (e.isFile() && e.name.endsWith('.json')) {
          // json files directly under articles/ -> use filename (without ext) as slug
          slugs.push(`/ressources/articles/${e.name.replace(/\.json$/, '')}`);
        }
      }
    }
  } catch (err) {
    // ignore errors and return what we found (useful in dev or if folder missing)
  }
  return slugs;
})();

const paths = [...staticPaths, ...servicePaths, ...ressourcesArticles];

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function GET() {
  // Example lastmod — replace with real content timestamps when available
  const now = new Date().toISOString().slice(0, 10);

  const urlEntries = paths.flatMap((p) => {
    // build per-locale entries and optionally a non-prefixed default locale entry
    return locales.map((locale) => {
      const path = p === '/' ? '' : p;
      const loc = `${BASE}/${locale}${path}`;
      // build alternates block
      const alternates = locales
        .map((alt) => {
          const altPath = p === '/' ? '' : p;
          const href = `${BASE}/${alt}${altPath}`;
          return `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt)}" href="${escapeXml(href)}"/>`;
        })
        .join('\n');
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
${alternates}
  </url>`;
    });
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries.join('\n')}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
