#!/usr/bin/env node
/**
 * List articles and content from ressources.json across all locales.
 *
 * Outputs a summary of articles per locale, including title, slug, date,
 * word count, and reference count. Useful for CI content audits and
 * quick inventory checks before publishing.
 *
 * Usage:
 *   node scripts/list-content.js
 *   node scripts/list-content.js --locale fr
 *   node scripts/list-content.js --json
 */

const fs = require("fs");
const path = require("path");

const TRANSLATIONS_DIR = path.join(__dirname, "..", "src", "translations");
const LOCALES = ["fr", "en", "de", "es", "pt"];

const args = new Set(process.argv.slice(2));
const JSON_OUTPUT = args.has("--json");

const localeArg = (() => {
  const i = process.argv.indexOf("--locale");
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return null;
})();

function loadRessources(locale) {
  const filePath = path.join(TRANSLATIONS_DIR, locale, "ressources.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function wordCount(text) {
  if (!text) return 0;
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function main() {
  const targetLocales = localeArg ? [localeArg] : LOCALES;
  const summary = {};

  for (const locale of targetLocales) {
    const data = loadRessources(locale);
    if (!data) {
      summary[locale] = { error: "ressources.json not found" };
      continue;
    }

    const articles = data.Articles || [];
    summary[locale] = {
      articleCount: articles.length,
      articles: articles.map((a) => ({
        slug: a.slug || "(no slug)",
        title: a.title || "(no title)",
        date: a.date || "(no date)",
        author: a.author || "(no author)",
        words: wordCount(a.content),
        references: (a.references || []).length,
      })),
    };
  }

  if (JSON_OUTPUT) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  // Human-readable output
  console.log("=".repeat(80));
  console.log("CONTENT INVENTORY");
  console.log("=".repeat(80));

  for (const locale of targetLocales) {
    const info = summary[locale];
    console.log();
    console.log(`── ${locale.toUpperCase()} ${"─".repeat(73)}`);

    if (info.error) {
      console.log(`  ⚠️  ${info.error}`);
      continue;
    }

    console.log(`  Articles: ${info.articleCount}`);

    if (info.articleCount === 0) {
      console.log("  (none)");
      continue;
    }

    // Sort by date descending
    const sorted = [...info.articles].sort((a, b) =>
      (b.date || "").localeCompare(a.date || ""),
    );

    for (const a of sorted) {
      const refs = a.references > 0 ? ` | refs: ${a.references}` : "";
      console.log(
        `  ${a.date}  ${a.words.toString().padStart(5)} words${refs}  ${a.title}`,
      );
    }
  }

  // Cross-locale comparison
  console.log();
  console.log("── CROSS-LOCALE SUMMARY " + "─".repeat(56));
  const frArticles = summary.fr?.articles || [];
  const frSlugs = new Set(frArticles.map((a) => a.slug));

  for (const locale of targetLocales) {
    if (locale === "fr") continue;
    const localeArticles = summary[locale]?.articles || [];
    const localeSlugs = new Set(localeArticles.map((a) => a.slug));
    const missing = [...frSlugs].filter((s) => !localeSlugs.has(s));
    const extra = [...localeSlugs].filter((s) => !frSlugs.has(s));

    console.log(`  ${locale.toUpperCase()}: ${localeArticles.length} articles`);
    if (missing.length > 0) {
      console.log(`    Missing from FR: ${missing.length} slugs`);
    }
    if (extra.length > 0) {
      console.log(`    Extra (not in FR): ${extra.length} slugs`);
    }
  }

  console.log();
  console.log("=".repeat(80));
}

main();
