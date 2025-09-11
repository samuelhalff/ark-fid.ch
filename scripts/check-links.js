#!/usr/bin/env node
/*
  Simple internal link checker.
  - Scans project files for static href="/..." occurrences (in <Link> and <a> tags).
  - Optionally, when run with --http and NEXT_BASE_URL set (e.g., http://localhost:5000),
    performs HTTP HEAD/GET requests to verify that the links resolve.

  Usage:
    node scripts/check-links.js              # list discovered links
    NEXT_BASE_URL=http://localhost:5000 node scripts/check-links.js --http
*/

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SRC_DIRS = ['app', 'src'];
const EXTS = new Set(['.tsx', '.ts', '.jsx', '.js']);

function* walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // skip heavy dirs
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'public') continue;
      yield* walk(full);
    } else if (EXTS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

function extractHrefs(content) {
  const hrefs = new Set();
  // Basic patterns: href="/..." and href='/...'
  const regex = /href\s*=\s*["'](\/[a-zA-Z0-9_\-\/.#?=&%:+]*)["']/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const href = m[1];
    // exclude mailto, anchor-only, and external http(s)
    if (href.startsWith('/')) {
      hrefs.add(href);
    }
  }
  return hrefs;
}

async function httpCheck(urls) {
  const base = process.env.NEXT_BASE_URL || '';
  if (!base) {
    console.error('Missing NEXT_BASE_URL env var. Example: http://localhost:5000');
    process.exitCode = 1;
    return;
  }

  const results = [];
  for (const href of urls) {
    const url = base.replace(/\/$/, '') + href;
    try {
      let res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
      if (res.status >= 400 || res.status === 405) {
        // Some endpoints might not accept HEAD; try GET
        res = await fetch(url, { method: 'GET', redirect: 'manual' });
      }
      results.push({ href, status: res.status, ok: res.ok });
    } catch (err) {
      results.push({ href, status: 0, ok: false, error: String(err.message || err) });
    }
  }

  // Print summary
  const broken = results.filter(r => !r.ok);
  if (broken.length) {
    console.log(`Broken links (${broken.length}/${results.length}):`);
    for (const r of broken) console.log(`  ${r.href} -> ${r.status} ${r.error ? '(' + r.error + ')' : ''}`);
  } else {
    console.log(`All ${results.length} links responded OK`);
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const discovered = new Set();

  for (const base of SRC_DIRS) {
    const abs = path.join(ROOT, base);
    if (!fs.existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const content = fs.readFileSync(file, 'utf8');
      for (const href of extractHrefs(content)) discovered.add(href);
    }
  }

  const sorted = Array.from(discovered).sort();
  console.log('Discovered internal hrefs:');
  for (const h of sorted) console.log('  ' + h);
  console.log(`Total: ${sorted.length}`);

  if (args.has('--http')) {
    await httpCheck(sorted);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
