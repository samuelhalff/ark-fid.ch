#!/usr/bin/env node
'use strict';
/**
 * Check ressources.json file entries for:
 *  - Local file presence (public/assets/downloads/<filename>)
 *  - Optional remote source_url HTTP status (HEAD/GET)
 *
 * Usage:
 *   node scripts/check-ressources-links.js [--locale fr] [--all-locales] [--remote] [--json]
 *
 * Exit codes:
 *   0: All good
 *   1: At least one missing local file
 *   2: Remote check enabled and at least one remote 404/failed
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const value = (f, d) => { const i = args.indexOf(f); return i !== -1 && i+1 < args.length ? args[i+1] : d; };

const ROOT = process.cwd();
const TRANSLATIONS_DIR = path.join(ROOT, 'src', 'translations');
const DOWNLOAD_DIR = path.join(ROOT, 'public', 'assets', 'downloads');

const oneLocale = value('--locale', 'fr');
const allLocales = flag('--all-locales');
const remote = flag('--remote');
const asJson = flag('--json');

if (remote && typeof fetch !== 'function') {
  console.error('Remote check requires Node 18+ (global fetch)');
  process.exit(1);
}

function listLocales() {
  return fs.readdirSync(TRANSLATIONS_DIR).filter(d => {
    const full = path.join(TRANSLATIONS_DIR, d);
    return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'ressources.json'));
  });
}

async function checkLocale(locale) {
  const filePath = path.join(TRANSLATIONS_DIR, locale, 'ressources.json');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return { locale, error: 'parse_error', details: e.message };
  }
  const files = Array.isArray(data.Files) ? data.Files : [];
  const results = [];
  for (const item of files) {
    const filename = item && item.filename;
    if (!filename) continue;
    const localPath = path.join(DOWNLOAD_DIR, filename);
    const exists = fs.existsSync(localPath);
    let remoteStatus = null;
    let remoteOk = null;
    if (remote && item.source_url) {
      try {
        const res = await fetch(item.source_url, { method: 'HEAD', redirect: 'follow' });
        remoteStatus = res.status;
        if (res.status === 405 || res.status === 403) { // some servers block HEAD
          const getRes = await fetch(item.source_url, { method: 'GET', redirect: 'follow' });
          remoteStatus = getRes.status;
        }
        remoteOk = remoteStatus >= 200 && remoteStatus < 300;
      } catch (e) {
        remoteStatus = 'ERR';
        remoteOk = false;
      }
    }
    results.push({
      filename,
      exists,
      source_url: item.source_url || null,
      remoteStatus,
      remoteOk
    });
  }
  return { locale, results };
}

async function main() {
  const locales = allLocales ? listLocales() : [oneLocale];
  const out = [];
  for (const loc of locales) {
    out.push(await checkLocale(loc));
  }
  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    for (const loc of out) {
      if (loc.error) {
        console.log(`Locale ${loc.locale}: ERROR ${loc.error} (${loc.details})`);
        continue;
      }
      console.log(`\nLocale ${loc.locale}:`);
      for (const r of loc.results) {
        const status = [r.exists ? 'OK' : 'MISSING'];
        if (remote) status.push(r.remoteOk ? `REMOTE:${r.remoteStatus}` : `REMOTE_FAIL:${r.remoteStatus}`);
        console.log(`  - ${r.filename} => ${status.join(' | ')}`);
      }
    }
  }
  const anyMissing = out.some(l => (l.results||[]).some(r => !r.exists));
  const anyRemoteFail = remote && out.some(l => (l.results||[]).some(r => r.remoteOk === false));
  if (anyRemoteFail) process.exit(2);
  if (anyMissing) process.exit(1);
}

main();
