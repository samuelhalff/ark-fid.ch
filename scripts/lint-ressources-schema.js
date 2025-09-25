#!/usr/bin/env node
"use strict";

/**
 * Lints ressources articles across locales to ensure they match the
 * canonical French schema (fields + basic structure).
 *
 * Usage: node scripts/lint-ressources-schema.js
 */

const fs = require("fs");
const path = require("path");
const { listLocales, buildArticleMap } = require("./lib/ressources");

const ROOT = process.cwd();
const TRANSLATIONS_DIR = path.join(ROOT, "src", "translations");
const CANONICAL_LOCALE = "fr";
const REQUIRED_ARTICLE_FIELDS = [
  "slug",
  "title",
  "description",
  "content",
  "author",
  "date",
  "references",
];
const REQUIRED_REFERENCE_FIELDS = ["labelKey", "url"];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read ${filePath}: ${error.message}`);
  }
}

function lintLocale(locale, canonicalMap) {
  const issues = [];
  const warnings = [];
  const filePath = path.join(TRANSLATIONS_DIR, locale, "ressources.json");
  if (!fs.existsSync(filePath)) {
    issues.push(`Missing ressources.json for locale ${locale}`);
    return { issues, warnings };
  }

  const data = readJson(filePath);
  const { map: articleMap, problems } = buildArticleMap(data, locale);
  if (problems.length) {
    issues.push(...problems);
  }

  for (const slug of canonicalMap.keys()) {
    const article = articleMap.get(slug);
    if (!article) {
      issues.push(`Missing article for slug "${slug}"`);
      continue;
    }

    for (const field of REQUIRED_ARTICLE_FIELDS) {
      if (!(field in article)) {
        issues.push(`Article "${slug}" missing field "${field}"`);
        continue;
      }

      const value = article[field];
      if (field === "references") {
        if (!Array.isArray(value)) {
          issues.push(`Article "${slug}" has non-array references`);
          continue;
        }
        value.forEach((ref, idx) => {
          if (!ref || typeof ref !== "object") {
            issues.push(
              `Article "${slug}" reference[${idx}] is not an object`
            );
            return;
          }
          for (const refField of REQUIRED_REFERENCE_FIELDS) {
            const refValue = ref[refField];
            if (typeof refValue !== "string" || refValue.trim() === "") {
              issues.push(
                `Article "${slug}" reference[${idx}] missing "${refField}"`
              );
            }
          }
        });
      } else if (typeof value !== "string" || value.trim() === "") {
        issues.push(
          `Article "${slug}" field "${field}" is empty or not a string`
        );
      }
    }
  }

  // Detect extra slugs (soft warning only – useful for clean-up).
  const canonicalSlugs = new Set(canonicalMap.keys());
  for (const slug of articleMap.keys()) {
    if (!canonicalSlugs.has(slug)) {
      warnings.push(`Extra article slug not in canonical FR: "${slug}"`);
    }
  }

  return { issues, warnings };
}

function main() {
  const locales = listLocales(TRANSLATIONS_DIR);
  if (!locales.includes(CANONICAL_LOCALE)) {
    throw new Error(`Canonical locale "${CANONICAL_LOCALE}" not found.`);
  }

  const canonicalPath = path.join(
    TRANSLATIONS_DIR,
    CANONICAL_LOCALE,
    "ressources.json"
  );
  const canonical = readJson(canonicalPath);
  const { map: canonicalMap } = buildArticleMap(
    canonical,
    CANONICAL_LOCALE,
    { strict: true }
  );

  if (!canonicalMap.size) {
    throw new Error("Canonical ressources.json contains no articles to lint");
  }

  let totalIssues = 0;
  let totalWarnings = 0;

  locales.forEach((locale) => {
    const { issues, warnings } = lintLocale(locale, canonicalMap);
    if (issues.length || warnings.length) {
      console.log(`\nLocale ${locale}:`);
      issues.forEach((issue) => console.log(`  [ERROR] ${issue}`));
      warnings.forEach((warning) => console.log(`  [WARN] ${warning}`));
    }
    totalIssues += issues.length;
    totalWarnings += warnings.length;
  });

  if (totalIssues === 0) {
    console.log(
      `✔ Ressources schema lint passed for ${locales.length} locale(s).`
    );
    if (totalWarnings > 0) {
      console.log(
        `⚠ ${totalWarnings} warning(s) reported (non-blocking).`
      );
    }
    process.exit(0);
  } else {
    console.error(`✖ Ressources schema lint failed with ${totalIssues} issue(s).`);
    console.error(
      "Fix the errors above or run with DEBUG=1 for additional troubleshooting."
    );
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
