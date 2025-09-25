#!/usr/bin/env node
"use strict";

/**
 * Removes article entries from non-canonical locales that do not exist in the
 * canonical French ressources file. Helps keep locales aligned before running
 * translation updates.
 *
 * Usage:
 *   node scripts/prune-ressources-extras.js           # dry-run (default)
 *   node scripts/prune-ressources-extras.js --apply   # write changes
 */

const fs = require("fs");
const path = require("path");
const { listLocales, buildArticleMap } = require("./lib/ressources");

const ROOT = process.cwd();
const TRANSLATIONS_DIR = path.join(ROOT, "src", "translations");
const CANONICAL_LOCALE = "fr";
const APPLY = new Set(process.argv.slice(2)).has("--apply");

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function main() {
  const locales = listLocales(TRANSLATIONS_DIR);
  if (!locales.includes(CANONICAL_LOCALE)) {
    throw new Error(`Canonical locale \"${CANONICAL_LOCALE}\" not found.`);
  }

  const canonicalPath = path.join(
    TRANSLATIONS_DIR,
    CANONICAL_LOCALE,
    "ressources.json"
  );
  const canonical = readJson(canonicalPath);
  const { order: canonicalSlugs } = buildArticleMap(
    canonical,
    CANONICAL_LOCALE,
    { strict: true }
  );
  if (!canonicalSlugs.length) {
    throw new Error("Canonical ressources.json has no articles to compare.");
  }
  const canonicalSet = new Set(canonicalSlugs);

  locales
    .filter((locale) => locale !== CANONICAL_LOCALE)
    .forEach((locale) => {
      const filePath = path.join(TRANSLATIONS_DIR, locale, "ressources.json");
      if (!fs.existsSync(filePath)) {
        console.warn(`[WARN] Missing ressources.json for locale ${locale}`);
        return;
      }

      const data = readJson(filePath);
      const { map: bySlug, problems } = buildArticleMap(data, locale);
      if (problems.length) {
        problems.forEach((message) => console.warn(`[WARN] ${message}`));
      }
      if (!bySlug.size) {
        return;
      }

      const extras = [];
      const missing = [];

      for (const slug of bySlug.keys()) {
        if (!canonicalSet.has(slug)) {
          extras.push(slug);
        }
      }

      canonicalSlugs.forEach((slug) => {
        if (!bySlug.has(slug)) {
          missing.push(slug);
        }
      });

      if (!extras.length) {
        if (missing.length) {
          console.log(
            `Locale ${locale}: no extras, but still missing ${missing.length} slug(s).`
          );
        }
        return;
      }

      const filteredArticles = canonicalSlugs
        .map((slug) => bySlug.get(slug))
        .filter(Boolean);

      console.log(
        `Locale ${locale}: removing ${extras.length} extra slug(s). Missing ${missing.length}.`
      );
      extras.forEach((slug) => console.log(`  - removing ${slug}`));
      if (!APPLY) {
        return;
      }

      const nextData = { ...data, Articles: filteredArticles };
      writeJson(filePath, nextData);
    });

  if (!APPLY) {
    console.log("Dry-run complete. Re-run with --apply to write changes.");
  }
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
