#!/usr/bin/env node
/*
  Validate that legal translation namespaces have non-empty string values across locales.
  - Namespaces checked: legal
  - Reports missing keys or empty-string values by locale
  - Uses 'en' as canonical baseline for keys
*/
const fs = require('fs');
const path = require('path');

const LOCALES = ['en', 'fr', 'de', 'es', 'pt'];
const NS = 'legal';

function flatten(obj, prefix = '') {
  const out = {};
  for (const key of Object.keys(obj || {})) {
    const val = obj[key];
    const p = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(out, flatten(val, p));
    } else {
      out[p] = val;
    }
  }
  return out;
}

function readNs(locale) {
  const file = path.join(process.cwd(), 'src', 'translations', locale, `${NS}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

const base = readNs('en') || {};
const baseFlat = flatten(base);
const issues = [];

for (const loc of LOCALES) {
  const data = readNs(loc);
  if (!data) {
    issues.push({ locale: loc, key: '*', reason: 'missing file' });
    continue;
  }
  const flat = flatten(data);
  for (const key of Object.keys(baseFlat)) {
    if (!(key in flat)) {
      issues.push({ locale: loc, key, reason: 'missing key' });
      continue;
    }
    const val = flat[key];
    if (typeof val === 'string' && val.trim() === '') {
      issues.push({ locale: loc, key, reason: 'empty string' });
    }
  }
}

if (issues.length) {
  console.error(`\nLegal translation issues (${issues.length}):`);
  for (const it of issues) {
    console.error(` - [${it.locale}] ${NS}: ${it.key} — ${it.reason}`);
  }
  process.exit(1);
} else {
  console.log('Legal translations OK across locales (keys present and non-empty).');
}
