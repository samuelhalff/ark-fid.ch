#!/usr/bin/env node
"use strict";

/**
 * Monthly report on new company registrations in Geneva and French-speaking
 * Switzerland, computed from the SOGC (FOSC/SHAB) public API.
 *
 *   node scripts/sogc-monthly-report.js [--month=YYYY-MM] [--apply] [--from-snapshot]
 *
 * --month          report month (default: previous calendar month, UTC)
 * --apply          write the snapshot, the CSV and the article in all 5 locales
 * --from-snapshot  re-render from data/sogc-reports/<month>.json (no network)
 *
 * Deterministic: every number comes from the snapshot, prose is template text.
 * No LLM is involved. See docs/sogc-monthly-report.md.
 */

const fs = require("fs");
const path = require("path");
const { collectSnapshot, assertMonth, shiftMonth, SERIES } = require("./lib/sogcReport");
const { LOCALES, CSV_DIR, renderArticle, renderCsv, csvFileName, reportSlug } = require("./lib/sogcReportRender");
const { writeJsonFilesAtomically, countWords } = require("./lib/articleRefresh");

const ROOT = process.cwd();
const SNAPSHOT_DIR = path.join(ROOT, "data", "sogc-reports");
const TRANSLATIONS = path.join(ROOT, "src", "translations");
const MIN_WORDS = 700;

function parseArgs(argv) {
  const args = { apply: false, fromSnapshot: false, month: null };
  for (const a of argv) {
    if (a === "--apply") args.apply = true;
    else if (a === "--from-snapshot") args.fromSnapshot = true;
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

/** Checks that make a rendered article unpublishable. Returns error strings. */
function checkRendered(locale, article) {
  const errors = [];
  const text = `${article.title}\n${article.description}\n${article.content}`;
  if (/\b(undefined|NaN|null|Infinity)\b|\[object /.test(text)) errors.push(`${locale}: rendering artefact in text`);
  if (!article.category || !Array.isArray(article.tags) || article.tags.length < 3) errors.push(`${locale}: taxonomy missing`);
  if (!Array.isArray(article.references) || article.references.length < 3) errors.push(`${locale}: fewer than 3 references`);
  if (locale === "fr" && countWords(article.content) < MIN_WORDS) {
    errors.push(`fr: ${countWords(article.content)} words (< ${MIN_WORDS})`);
  }
  return errors;
}

/** Inserts or replaces the article, preserving its first publication date. */
function upsertArticle(data, article, today) {
  const list = Array.isArray(data.Articles) ? data.Articles : (data.Articles = []);
  const idx = list.findIndex((a) => a && a.slug === article.slug);
  if (idx === -1) {
    list.push(article);
    return "added";
  }
  const existing = list[idx];
  if (existing.series !== SERIES) {
    throw new Error(`Slug ${article.slug} is already used by an article outside the ${SERIES} series`);
  }
  const next = { ...article, date: existing.date || article.date };
  const same = ["title", "description", "content"].every((k) => existing[k] === next[k]) &&
    JSON.stringify(existing.references) === JSON.stringify(next.references);
  if (same) {
    list[idx] = { ...next, ...(existing.updated ? { updated: existing.updated } : {}) };
    return "unchanged";
  }
  if (today > next.date) next.updated = today;
  list[idx] = next;
  return "updated";
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
    snapshot = previous;
  } else {
    const frData = readJson(path.join(TRANSLATIONS, "fr", "ressources.json"));
    const existing = (frData.Articles || []).find((a) => a && a.slug === reportSlug(month));
    const publishedOn = previous?.publishedOn || existing?.date || today;
    snapshot = await collectSnapshot({ targetMonth: month, publishedOn, now, log: (m) => console.log(`  ${m}`) });
    if (previous && previous.checksum === snapshot.checksum) {
      console.log("Aggregates unchanged since the stored snapshot; keeping it.");
      snapshot = previous;
    }
  }

  const articles = Object.fromEntries(LOCALES.map((l) => [l, renderArticle(l, snapshot)]));
  const errors = LOCALES.flatMap((l) => checkRendered(l, articles[l]));
  if (errors.length) throw new Error(`Rendered report failed checks:\n  - ${errors.join("\n  - ")}`);
  const csv = renderCsv(snapshot);

  const fr = articles.fr;
  console.log(`\n${fr.title}\n${fr.description}`);
  console.log(`slug: ${fr.slug} | words (fr): ${countWords(fr.content)} | checksum: ${snapshot.checksum}`);
  console.log(`quality: ${JSON.stringify(snapshot.quality)}`);

  if (!args.apply) {
    console.log("\nDry run (use --apply to write).");
    return;
  }

  const files = LOCALES.map((l) => {
    const file = path.join(TRANSLATIONS, l, "ressources.json");
    const data = readJson(file);
    const status = upsertArticle(data, articles[l], today);
    console.log(`${l}: ${status}`);
    return { path: file, data };
  });
  writeFileAtomic(snapshotFile, JSON.stringify(snapshot, null, 2) + "\n");
  writeFileAtomic(path.join(ROOT, "public", CSV_DIR, csvFileName(month)), csv);
  writeJsonFilesAtomically(files);
  console.log(`Wrote ${path.relative(ROOT, snapshotFile)}, public/${CSV_DIR}/${csvFileName(month)} and 5 locale files.`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`❌ ${error.message || error}`);
    process.exit(1);
  });
}

module.exports = { parseArgs, previousMonth, upsertArticle, checkRendered };
