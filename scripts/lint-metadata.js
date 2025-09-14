#!/usr/bin/env node
/**
 * Lint metadata content across locales:
 * - titles present and <= 65 chars (soft)
 * - descriptions present and <= 160 chars (soft)
 * - keywords present and non-trivial
 * - pages coverage consistent across locales
 * Exits with code 1 only if run with CI_STRICT_METADATA=1 and errors found; otherwise prints warnings.
 */
const fs = require('fs');
const path = require('path');

const LOCALES = ['fr','en','de','es','pt'];
const MAX_TITLE = 65;
const MAX_DESC = 160;

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function pad(n) { return String(n).padStart(2, '0'); }

function report() {
  const base = path.join(process.cwd(), 'src', 'translations');
  const localeFiles = Object.fromEntries(
    LOCALES.map(l => [l, path.join(base, l, 'metadata.json')])
  );
  const present = Object.entries(localeFiles).filter(([_, p]) => fs.existsSync(p));
  if (!present.length) {
    console.log('No metadata.json files found');
    return 0;
  }

  const data = Object.fromEntries(present.map(([l, p]) => [l, loadJson(p)]));
  const frPages = new Set(Object.keys((data['fr']||{}).pages||{}));
  const allPages = new Set(frPages);
  for (const l of Object.keys(data)) {
    const pages = Object.keys((data[l]||{}).pages||{});
    pages.forEach(p => allPages.add(p));
  }

  let errors = 0;
  let warnings = 0;

  function checkText(kind, value, max, locale, page) {
    if (!value || typeof value !== 'string' || !value.trim()) {
      console.log(`[${locale}] ${page} missing ${kind}`);
      errors++;
      return;
    }
    if (value.length > max) {
      console.log(`[${locale}] ${page} ${kind} too long (${value.length}>${max}): "${value.slice(0, max+20)}…"`);
      warnings++;
    }
    const bad = /lorem ipsum|placeholder|your (?:title|description)/i.test(value);
    if (bad) {
      console.log(`[${locale}] ${page} ${kind} looks placeholder-ish: "${value}"`);
      warnings++;
    }
  }

  // Check per-locale coverage and content
  for (const [locale, conf] of Object.entries(data)) {
    if (!conf.default) {
      console.log(`[${locale}] missing default block`);
      errors++;
      continue;
    }
    checkText('default.title', conf.default.title, MAX_TITLE+15, locale, '<default>');
    checkText('default.description', conf.default.description, MAX_DESC+40, locale, '<default>');
    if (!conf.default.keywords || conf.default.keywords.split(',').length < 3) {
      console.log(`[${locale}] default.keywords too short or missing`);
      warnings++;
    }

    const pages = conf.pages || {};
    for (const page of allPages) {
      const p = pages[page];
      if (!p) {
        console.log(`[${locale}] missing page: ${page}`);
        warnings++;
        continue;
      }
      checkText('title', p.title, MAX_TITLE, locale, page);
      checkText('description', p.description, MAX_DESC, locale, page);
      if (!p.keywords || p.keywords.length < 10) {
        console.log(`[${locale}] ${page} keywords missing/short`);
        warnings++;
      }
    }
  }

  // Cross-locale page set parity
  for (const [locale, conf] of Object.entries(data)) {
    const set = new Set(Object.keys((conf.pages)||{}));
    for (const p of allPages) {
      if (!set.has(p)) {
        console.log(`[${locale}] parity: page ${p} missing vs union`);
        warnings++;
      }
    }
  }

  const strict = process.env.CI_STRICT_METADATA === '1';
  const code = strict && errors > 0 ? 1 : 0;
  const summary = `Metadata lint: ${errors} errors, ${warnings} warnings${strict? ' (STRICT)': ''}`;
  if (code) {
    console.error(summary);
  } else {
    console.log(summary);
  }
  return code;
}

process.exitCode = report();
