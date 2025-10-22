#!/usr/bin/env node
/**
 * Validate article references in ressources.json across locales.
 * - Flags 4xx/5xx responses, network errors, and pages with near-empty bodies.
 * - Prints a concise report; exits non-zero when failures found unless --no-fail.
 *
 * Usage:
 *   node scripts/validate-article-refs.js [--no-fail] [--min-bytes 600]
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TRANSLATIONS_DIR = path.join(ROOT, 'src', 'translations');
const args = new Set(process.argv.slice(2));
const NO_FAIL = args.has('--no-fail');
const minBytesArg = (() => {
  const i = process.argv.indexOf('--min-bytes');
  if (i !== -1 && process.argv[i + 1]) return parseInt(process.argv[i + 1], 10) || 600;
  return 600;
})();

async function headOrGet(url) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    if (!res.ok || Number(res.headers.get('content-length') || 0) === 0) {
      // fallback to GET
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
    }
    const ct = String(res.headers.get('content-type') || '').toLowerCase();
    const isTextual = /(text|html|json|xml)/.test(ct);
    let bodySize = 0;
    if (isTextual) {
      const buf = Buffer.from(await res.arrayBuffer());
      bodySize = buf.byteLength;
    } else {
      // For binary (PDF etc.), try to read a small chunk to estimate size
      bodySize = Number(res.headers.get('content-length') || 0);
      if (!bodySize) {
        const buf = Buffer.from(await res.arrayBuffer());
        bodySize = buf.byteLength;
      }
    }
    return { ok: res.ok, status: res.status, url: res.url, bodySize, contentType: ct };
  } catch (e) {
    return { ok: false, status: 0, error: e.message, url };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  const locales = fs.readdirSync(TRANSLATIONS_DIR).filter((d) => fs.statSync(path.join(TRANSLATIONS_DIR, d)).isDirectory());
  const results = [];
  const tasks = [];
  for (const loc of locales) {
    const p = path.join(TRANSLATIONS_DIR, loc, 'ressources.json');
    if (!fs.existsSync(p)) continue;
    let json; try { json = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
    const arts = Array.isArray(json.Articles) ? json.Articles : [];
    for (const a of arts) {
      const refs = Array.isArray(a.references) ? a.references : [];
      for (const ref of refs) {
        tasks.push(async () => {
          if (!ref || typeof ref.url !== 'string' || !/^https?:\/\//.test(ref.url)) {
            results.push({ locale: loc, slug: a.slug, labelKey: ref && ref.labelKey, url: ref && ref.url, ok: false, reason: 'invalid-url' });
            return;
          }
          const r = await headOrGet(ref.url);
          const ok = r.ok && r.status >= 200 && r.status < 400 && r.bodySize >= minBytesArg;
          results.push({ locale: loc, slug: a.slug, labelKey: ref.labelKey, url: ref.url, ok, status: r.status, bodySize: r.bodySize, contentType: r.contentType, error: r.error });
        });
      }
    }
  }
  // Run with limited concurrency
  const limit = 6;
  const queue = tasks.slice();
  const runners = Array.from({ length: limit }, async () => {
    while (queue.length) {
      const fn = queue.shift();
      try { await fn(); } catch (_) {}
    }
  });
  await Promise.all(runners);
  const bad = results.filter((r) => !r.ok);
  const fatals = bad.filter((r) => r.reason === 'invalid-url' || r.status === 404 || r.status === 410);
  const warnings = bad.filter((r) => !fatals.includes(r));
  const summary = {
    checked: results.length,
    failures: fatals.length,
    warnings: warnings.length,
  };
  if (bad.length) {
    console.log('✗ Invalid/weak references found (status/body too small/invalid URL):');
    for (const r of bad) {
      console.log(`- [${r.locale}] ${r.slug} :: ${r.labelKey || ''} -> ${r.url} (status: ${r.status || 'n/a'}, size: ${r.bodySize || 0}, reason: ${r.error || 'weak-content'})`);
    }
  } else {
    console.log('✓ All references look valid and have content.');
  }
  console.log(`Ref check summary: ${JSON.stringify(summary)}`);
  if (!NO_FAIL && fatals.length) process.exit(1);
}

main();
