#!/usr/bin/env node
"use strict";

/**
 * Monthly SOGC statistics for Geneva and French-speaking Switzerland: updates
 * two evergreen pages in place (créations, faillites) from the SOGC
 * (FOSC/SHAB) public API.
 *
 *   node scripts/sogc-monthly-report.js [--month=YYYY-MM] [--apply] [--from-snapshot] [--backfill]
 *
 * --month          data month (default: previous calendar month, UTC)
 * --apply          write the snapshot, the CSVs and the pages (fr, en, de)
 * --from-snapshot  re-render from data/sogc-reports/<month>.json (no network)
 * --backfill       month older than the published one: write snapshot and CSVs only
 *
 * Deterministic: every number comes from the snapshot, prose is template text.
 * No LLM is involved. See docs/sogc-monthly-report.md.
 */

const fs = require("fs");
const path = require("path");
const { collectSnapshot, assertMonth, shiftMonth, checksum } = require("./lib/sogcReport");
const {
  LOCALES,
  CSV_DIR,
  PAGES,
  LEGACY_MONTHLY_SLUG_RE,
  renderCreations,
  renderFaillites,
  renderHighlights,
  renderCsv,
  renderFaillitesCsv,
  renderHistoryCsvs,
} = require("./lib/sogcReportRender");
const { writeJsonFilesAtomically, countWords } = require("./lib/articleRefresh");
const { DATA_REPORT_SERIES } = require("./lib/articleTopicGuardrails");

const ROOT = process.cwd();
const SNAPSHOT_DIR = path.join(ROOT, "data", "sogc-reports");
const TRANSLATIONS = path.join(ROOT, "src", "translations");
const PUBLIC_CSV_DIR = path.join(ROOT, "public", CSV_DIR);
const MIN_WORDS = 700;
const SCHEMA_VERSION = 2;
const ALL_LOCALES = ["fr", "en", "de", "es", "pt"];
const RENDERERS = { creations: renderCreations, faillites: renderFaillites };

function parseArgs(argv) {
  const args = { apply: false, fromSnapshot: false, backfill: false, month: null };
  for (const a of argv) {
    if (a === "--apply") args.apply = true;
    else if (a === "--from-snapshot") args.fromSnapshot = true;
    else if (a === "--backfill") args.backfill = true;
    else if (a.startsWith("--month=")) args.month = a.slice("--month=".length).trim();
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

function previousMonth(now = new Date()) {
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return shiftMonth(ym, -1);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeFileAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, "utf8");
  fs.renameSync(tmp, file);
}

/**
 * Per-month CSVs are published files that journalists may cite: rewrite one
 * only when its figures change, not when only the retrieval timestamp differs.
 */
function writeCsvIfDataChanged(file, text) {
  const strip = (t) => t.replace(/,\d{4}-\d{2}-\d{2}T[^,\n]*$/gm, "");
  if (fs.existsSync(file) && strip(fs.readFileSync(file, "utf8")) === strip(text)) return false;
  writeFileAtomic(file, text);
  return true;
}

/** Checks that make a rendered page unpublishable. Returns error strings. */
function checkRendered(locale, article) {
  const errors = [];
  const id = `${locale}/${article.slug}`;
  const text = `${article.title}\n${article.description}\n${article.content}`;
  if (/\b(undefined|NaN|null|Infinity)\b|\[object /.test(text)) errors.push(`${id}: rendering artefact in text`);
  if (!article.category || !Array.isArray(article.tags) || article.tags.length < 3) errors.push(`${id}: taxonomy missing`);
  if (!Array.isArray(article.references) || article.references.length < 3) errors.push(`${id}: fewer than 3 references`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(article.date))) errors.push(`${id}: missing publication date`);
  if (locale === "fr" && countWords(article.content) < MIN_WORDS) {
    errors.push(`${id}: ${countWords(article.content)} words (< ${MIN_WORDS})`);
  }
  return errors;
}

/** Inserts or replaces a page, preserving its first publication date. */
function upsertArticle(data, article, today) {
  const list = Array.isArray(data.Articles) ? data.Articles : (data.Articles = []);
  const idx = list.findIndex((a) => a && a.slug === article.slug);
  if (idx === -1) {
    list.push(article);
    return "added";
  }
  const existing = list[idx];
  if (existing.series !== article.series) {
    throw new Error(`Slug ${article.slug} is already used by an article outside the ${article.series} series`);
  }
  const next = { ...article, date: existing.date || article.date };
  const same = ["title", "description", "content", "reportMonth"].every((k) => existing[k] === next[k]) &&
    JSON.stringify(existing.references) === JSON.stringify(next.references);
  if (same) {
    list[idx] = { ...next, ...(existing.updated ? { updated: existing.updated } : {}) };
    return "unchanged";
  }
  if (today > next.date) next.updated = today;
  else if (existing.updated) next.updated = existing.updated;
  list[idx] = next;
  return "updated";
}

/** Removes legacy monthly créations articles; returns the removed slugs. */
function removeLegacyMonthly(data) {
  const list = Array.isArray(data.Articles) ? data.Articles : [];
  const removed = [];
  data.Articles = list.filter((a) => {
    const legacy = a && a.series === PAGES.creations.series && LEGACY_MONTHLY_SLUG_RE.test(String(a.slug)) &&
      a.slug !== PAGES.creations.slug;
    if (legacy) removed.push(a.slug);
    return !legacy;
  });
  return removed;
}

/** Removes evergreen pages from a locale that does not publish them. */
function removeFromUnpublishedLocale(data) {
  const list = Array.isArray(data.Articles) ? data.Articles : [];
  const slugs = new Set(Object.values(PAGES).map((p) => p.slug));
  const kept = list.filter((a) => !(a && slugs.has(a.slug) && DATA_REPORT_SERIES.includes(a.series)));
  const removed = list.length - kept.length;
  data.Articles = kept;
  return removed;
}

/** A stored snapshot is trusted only if its aggregates still match its checksum. */
function verifySnapshot(snapshot, label) {
  if (checksum(snapshot) !== snapshot.checksum) {
    throw new Error(`Snapshot ${label} does not match its checksum (edited by hand?); re-fetch it`);
  }
  return snapshot;
}

function loadSnapshots() {
  if (!fs.existsSync(SNAPSHOT_DIR)) return [];
  return fs
    .readdirSync(SNAPSHOT_DIR)
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .map((f) => readJson(path.join(SNAPSHOT_DIR, f)))
    .filter((s) => s.schemaVersion === SCHEMA_VERSION)
    .map((s) => verifySnapshot(s, s.reportMonth));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const month = assertMonth(args.month || previousMonth(now));
  const snapshotFile = path.join(SNAPSHOT_DIR, `${month}.json`);
  const previous = fs.existsSync(snapshotFile) ? readJson(snapshotFile) : null;

  let snapshot;
  if (args.fromSnapshot) {
    if (!previous) throw new Error(`No snapshot at ${path.relative(ROOT, snapshotFile)}`);
    if (previous.schemaVersion !== SCHEMA_VERSION) {
      throw new Error(`Snapshot ${month} has schema ${previous.schemaVersion}; re-fetch it (schema ${SCHEMA_VERSION} required)`);
    }
    snapshot = verifySnapshot(previous, month);
  } else {
    snapshot = await collectSnapshot({ targetMonth: month, now, log: (m) => console.log(`  ${m}`) });
    if (
      previous && previous.schemaVersion === SCHEMA_VERSION &&
      previous.checksum === snapshot.checksum && checksum(previous) === snapshot.checksum
    ) {
      console.log("Aggregates unchanged since the stored snapshot; keeping it.");
      snapshot = previous;
    }
  }
  // Derived text is always regenerated from the aggregates, never trusted from disk.
  snapshot = { ...snapshot, highlights: renderHighlights(snapshot) };

  const data = Object.fromEntries(
    ALL_LOCALES.map((l) => [l, readJson(path.join(TRANSLATIONS, l, "ressources.json"))]),
  );
  const frArticles = data.fr.Articles || [];
  const pageSlugs = new Set(Object.values(PAGES).map((p) => p.slug));
  const publishedMonth = LOCALES.flatMap((l) => data[l].Articles || [])
    .filter((a) => a && pageSlugs.has(a.slug) && a.reportMonth)
    .map((a) => a.reportMonth)
    .sort()
    .pop();
  const updatePages = !args.backfill;
  if (updatePages && publishedMonth && month < publishedMonth) {
    throw new Error(`Month ${month} is older than the published ${publishedMonth}; use --backfill (snapshot and CSVs only)`);
  }

  const rendered = {};
  if (updatePages) {
    const legacy = frArticles
      .filter((a) => a && a.series === PAGES.creations.series && LEGACY_MONTHLY_SLUG_RE.test(String(a.slug)))
      .map((a) => a.date)
      .filter(Boolean)
      .sort();
    for (const [key, page] of Object.entries(PAGES)) {
      const existing = frArticles.find((a) => a && a.slug === page.slug);
      const date = existing?.date || (key === "creations" && legacy[0]) || today;
      rendered[key] = Object.fromEntries(LOCALES.map((l) => [l, RENDERERS[key](l, snapshot, { date })]));
    }
    const errors = Object.values(rendered).flatMap((byLocale) =>
      LOCALES.flatMap((l) => checkRendered(l, byLocale[l])),
    );
    if (errors.length) throw new Error(`Rendered pages failed checks:\n  - ${errors.join("\n  - ")}`);
    for (const byLocale of Object.values(rendered)) {
      const fr = byLocale.fr;
      console.log(`\n${fr.title} (${fr.title.length} chars)\n${fr.description}`);
      console.log(`slug: ${fr.slug} | words (fr): ${countWords(fr.content)}`);
    }
  }
  console.log(`\nchecksum: ${snapshot.checksum}\nquality: ${JSON.stringify(snapshot.quality)}`);
  console.log(`highlights (fr):\n  ${Object.values(snapshot.highlights.fr).join("\n  ")}`);

  if (!args.apply) {
    console.log("\nDry run (use --apply to write).");
    return;
  }

  const files = [];
  if (updatePages) {
    for (const l of ALL_LOCALES) {
      const d = data[l];
      const removed = removeLegacyMonthly(d);
      if (removed.length) console.log(`${l}: removed legacy ${removed.join(", ")}`);
      if (LOCALES.includes(l)) {
        for (const byLocale of Object.values(rendered)) {
          console.log(`${l}: ${byLocale[l].slug} ${upsertArticle(d, byLocale[l], today)}`);
        }
      } else if (removeFromUnpublishedLocale(d)) {
        console.log(`${l}: removed evergreen pages (not a published locale)`);
      }
      files.push({ path: path.join(TRANSLATIONS, l, "ressources.json"), data: d });
    }
  }
  writeFileAtomic(snapshotFile, JSON.stringify(snapshot, null, 2) + "\n");
  writeCsvIfDataChanged(path.join(ROOT, "public", PAGES.creations.csvMonth(month).slice(1)), renderCsv(snapshot));
  writeCsvIfDataChanged(path.join(ROOT, "public", PAGES.faillites.csvMonth(month).slice(1)), renderFaillitesCsv(snapshot));
  const history = renderHistoryCsvs(loadSnapshots());
  writeFileAtomic(path.join(ROOT, "public", PAGES.creations.csvHistory.slice(1)), history.creations);
  writeFileAtomic(path.join(ROOT, "public", PAGES.faillites.csvHistory.slice(1)), history.faillites);
  if (files.length) writeJsonFilesAtomically(files);
  console.log(`Wrote ${path.relative(ROOT, snapshotFile)}, CSVs in ${path.relative(ROOT, PUBLIC_CSV_DIR)} and ${files.length} locale files.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ ${error.message || error}`);
    process.exit(1);
  });
}

module.exports = {
  verifySnapshot,
  writeCsvIfDataChanged,
  parseArgs,
  previousMonth,
  upsertArticle,
  removeLegacyMonthly,
  removeFromUnpublishedLocale,
  checkRendered,
};
