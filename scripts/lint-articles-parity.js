#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const LOCALES = ['en', 'fr', 'de', 'es', 'pt'];
const baseDir = path.join(process.cwd(), 'src', 'translations');

function read(locale) {
  const p = path.join(baseDir, locale, 'ressources.json');
  try {
    const txt = fs.readFileSync(p, 'utf8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

// Use FR as canonical
const canonical = read('fr');
if (!canonical) {
  console.error('Missing fr/ressources.json');
  process.exit(1);
}
const canonicalSlugs = new Set((canonical.Articles || []).map((a) => a.slug));
let missing = [];
let extra = [];

for (const loc of LOCALES) {
  const data = read(loc);
  if (!data) {
    missing.push({ locale: loc, slug: '*', reason: 'missing ressources.json' });
    continue;
  }
  const slugs = new Set((data.Articles || []).map((a) => a.slug));
  for (const s of canonicalSlugs) if (!slugs.has(s)) missing.push({ locale: loc, slug: s });
  for (const s of slugs) if (!canonicalSlugs.has(s)) extra.push({ locale: loc, slug: s });
}

const STRICT = process.env.CI_STRICT_ARTICLES === '1';
if (missing.length || extra.length) {
  if (missing.length) {
    console.error(`\nArticles missing relative to FR (${missing.length}):`);
    missing.forEach((m) => console.error(` - [${m.locale}] ${m.slug}`));
  }
  if (extra.length) {
    console.error(`\nArticles extra vs FR (${extra.length}):`);
    extra.forEach((e) => console.error(` - [${e.locale}] ${e.slug}`));
  }
  if (STRICT) process.exit(1);
  else process.exit(0);
} else {
  console.log('Articles parity: All locales match EN slugs.');
}
