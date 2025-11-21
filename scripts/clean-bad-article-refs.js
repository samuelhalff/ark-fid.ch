#!/usr/bin/env node
/**
 * Clean bad article references (404/410/unreachable URLs) from ressources.json files.
 * This script removes references that return errors or missing content.
 *
 * Usage:
 *   node scripts/clean-bad-article-refs.js [--locale fr] [--all-locales] [--dry-run]
 */
const fs = require("fs");
const path = require("path");
const { listLocales } = require("./lib/ressources");

const ROOT = process.cwd();
const TRANSLATIONS_DIR = path.join(ROOT, "src", "translations");
const args = process.argv.slice(2);

const flag = (f) => args.includes(f);
const value = (f, d) => {
  const i = args.indexOf(f);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : d;
};

const oneLocale = value("--locale", "fr");
const allLocales = flag("--all-locales");
const dryRun = flag("--dry-run");
const timeoutMs = parseInt(value("--timeout-ms", "8000"), 10);
const minBytes = parseInt(value("--min-bytes", "600"), 10);

if (typeof fetch !== "function") {
  console.error("❌ This script requires Node 18+ (global fetch)");
  process.exit(1);
}

function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

async function checkUrl(url) {
  try {
    // Try HEAD first
    let res = await fetchWithTimeout(
      url,
      { method: "HEAD", redirect: "follow" },
      timeoutMs
    );
    let status = res.status;

    // Some servers block HEAD, try GET
    if (status === 405 || status === 403 || !res.ok) {
      res = await fetchWithTimeout(
        url,
        { method: "GET", redirect: "follow" },
        timeoutMs
      );
      status = res.status;
    }

    // Hard failures
    if (status === 404 || status === 410 || status >= 500) {
      return { ok: false, status, reason: "http-error" };
    }

    if (!res.ok) {
      return { ok: false, status, reason: "not-ok" };
    }

    // Check body size for soft 404s
    const ct = String(res.headers.get("content-type") || "").toLowerCase();
    const isTextual = /(text|html|json|xml)/.test(ct);
    let bodySize = 0;

    if (isTextual) {
      const buf = Buffer.from(await res.arrayBuffer());
      bodySize = buf.byteLength;
    } else {
      bodySize = Number(res.headers.get("content-length") || 0);
      if (!bodySize) {
        const buf = Buffer.from(await res.arrayBuffer());
        bodySize = buf.byteLength;
      }
    }

    if (bodySize < minBytes) {
      return { ok: false, status, bodySize, reason: "too-small" };
    }

    return { ok: true, status, bodySize };
  } catch (e) {
    return { ok: false, error: e.message, reason: "network-error" };
  }
}

async function cleanLocale(locale) {
  const filePath = path.join(TRANSLATIONS_DIR, locale, "ressources.json");

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  No ressources.json found for locale: ${locale}`);
    return { locale, skipped: true };
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error(`❌ Failed to parse ${locale}/ressources.json: ${e.message}`);
    return { locale, error: "parse_error" };
  }

  const articles = Array.isArray(data.Articles) ? data.Articles : [];
  let totalRemoved = 0;
  let totalChecked = 0;

  console.log(`\n🔍 Checking locale: ${locale}`);

  for (const article of articles) {
    if (!article || !Array.isArray(article.references)) continue;

    const originalCount = article.references.length;
    const cleanRefs = [];

    for (const ref of article.references) {
      if (
        !ref ||
        typeof ref.url !== "string" ||
        !/^https?:\/\//.test(ref.url)
      ) {
        console.log(
          `  ⚠️  [${article.slug}] Invalid URL format, removing: ${
            ref?.url || "undefined"
          }`
        );
        totalRemoved++;
        totalChecked++;
        continue;
      }

      totalChecked++;
      const result = await checkUrl(ref.url);

      if (result.ok) {
        cleanRefs.push(ref);
      } else {
        console.log(
          `  🗑️  [${article.slug}] Removing bad reference: ${ref.url}`
        );
        console.log(
          `      Reason: ${result.reason}, Status: ${
            result.status || "N/A"
          }, Error: ${result.error || "N/A"}`
        );
        totalRemoved++;
      }
    }

    article.references = cleanRefs;

    if (cleanRefs.length < originalCount) {
      console.log(
        `  ✂️  [${article.slug}] Removed ${
          originalCount - cleanRefs.length
        } bad reference(s)`
      );
    }
  }

  if (totalRemoved > 0) {
    if (dryRun) {
      console.log(
        `\n🔸 [DRY RUN] Would remove ${totalRemoved} bad reference(s) from ${locale}`
      );
    } else {
      // Write back to file with proper formatting
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
      console.log(
        `\n✅ Removed ${totalRemoved} bad reference(s) from ${locale}`
      );
    }
  } else {
    console.log(`\n✅ No bad references found in ${locale}`);
  }

  return { locale, checked: totalChecked, removed: totalRemoved };
}

async function main() {
  const locales = allLocales
    ? listLocales(TRANSLATIONS_DIR, { requireRessources: true })
    : [oneLocale];

  console.log(`🧹 Cleaning bad article references...`);
  if (dryRun) console.log("🔸 DRY RUN MODE - No files will be modified\n");

  const results = [];
  for (const locale of locales) {
    results.push(await cleanLocale(locale));
  }

  const totalChecked = results.reduce((sum, r) => sum + (r.checked || 0), 0);
  const totalRemoved = results.reduce((sum, r) => sum + (r.removed || 0), 0);

  console.log("\n" + "=".repeat(60));
  console.log(
    `📊 Summary: Checked ${totalChecked} references, removed ${totalRemoved} bad ones`
  );
  console.log("=".repeat(60));

  if (totalRemoved > 0 && !dryRun) {
    console.log("✅ Files updated. Remember to commit the changes.");
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
