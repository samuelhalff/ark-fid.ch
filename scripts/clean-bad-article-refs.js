#!/usr/bin/env node
"use strict";
// Remove unreachable reference links from ressources.json articles.
// Usage: node scripts/clean-bad-article-refs.js [--locale fr|en|de|es|pt] [--all-locales]
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i !== -1 && args[i + 1] ? args[i + 1] : d;
};

const ROOT = process.cwd();
const TX_DIR = path.join(ROOT, "src", "translations");
const LOCALES = flag("--all-locales")
  ? fs.readdirSync(TX_DIR).filter((d) => fs.existsSync(path.join(TX_DIR, d, "ressources.json")))
  : [val("--locale", "fr")];

function looksLikeMissing(html = "") {
  const s = html.toLowerCase();
  return (
    s.includes('content not found') ||
    s.includes('page not found') ||
    s.includes('page non trouvée') ||
    s.includes('page introuvable') ||
    s.includes('seite nicht gefunden') ||
    s.includes('contenu introuvable')
  );
}

async function headOrGet(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let r = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal });
    if ([405, 403].includes(r.status)) {
      r = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
    }
    if (!(r.status >= 200 && r.status < 300)) return false;
    // If we used GET or server returned HTML for HEAD fallback, inspect body for soft-404 text
    try {
      const gr = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal });
      if (gr.ok) {
        const txt = await gr.text();
        if (looksLikeMissing(txt)) return false;
      }
    } catch { /* ignore body read errors */ }
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(id);
  }
}

async function run() {
  if (typeof fetch !== "function") {
    console.error("This script requires Node >=18 (fetch API)");
    process.exit(0);
  }
  let removed = 0;
  for (const loc of LOCALES) {
    const file = path.join(TX_DIR, loc, "ressources.json");
    if (!fs.existsSync(file)) continue;
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const arts = Array.isArray(data.Articles) ? data.Articles : [];
    let touched = false;
    for (const a of arts) {
      if (!Array.isArray(a.references) || !a.references.length) continue;
      const keep = [];
      for (const ref of a.references) {
        if (!ref || !ref.url) continue;
        // Skip mailto and internal anchors
        if (/^mailto:|^#/i.test(ref.url)) { keep.push(ref); continue; }
        const ok = await headOrGet(ref.url);
        if (ok) keep.push(ref); else { removed++; touched = true; }
      }
      a.references = keep;
    }
    if (touched) {
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
      console.log(`Updated ${loc}/ressources.json (removed bad references)`);
    }
  }
  console.log(`Removed ${removed} unreachable reference link(s).`);
  process.exit(0);
}

run();
