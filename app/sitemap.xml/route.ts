import { locales } from '@/src/lib/i18n';
import { NextResponse } from 'next/server';

const BASE = 'https://ark-fid.ch';

// Minimal list of site paths — extend if you add more pages
const paths = [
  '/',
  '/about',
  '/services',
  '/ressources',
  '/contact',
  '/team',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
];

export async function GET() {
  const urls: string[] = [];

  for (const locale of locales) {
    for (const p of paths) {
      const path = `${p === '/' ? '' : p}`;
      urls.push(`${BASE}/${locale}${path}`);
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((url) => `  <url>\n    <loc>${url}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`)
    .join('\n')}\n</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
