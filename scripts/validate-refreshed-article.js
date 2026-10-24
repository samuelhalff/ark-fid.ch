#!/usr/bin/env node
"use strict";
/** Usage: node scripts/validate-refreshed-article.js --slug=<slug> [--today=YYYY-MM-DD] */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { validateRefreshedArticle, listAppRoutes, LOCALES } = require("./lib/refreshedArticleValidator");
const { readTeamSlugs } = require("./lib/articleRefresh");

const ROOT = path.resolve(__dirname, "..");
const arg = (n) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  if (a) return a.slice(n.length + 3);
  const i = process.argv.indexOf(`--${n}`);
  return i !== -1 ? process.argv[i + 1] : null;
};
const int = (v, d) => parseInt(v || "", 10) || d;

function main() {
  const slug = arg("slug");
  if (!slug) {
    console.error("--slug is required");
    process.exit(2);
  }
  const today = arg("today") || new Date().toISOString().slice(0, 10);
  const current = {};
  const head = {};
  for (const loc of LOCALES) {
    const rel = `src/translations/${loc}/ressources.json`;
    current[loc] = JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
    try {
      head[loc] = JSON.parse(
        execFileSync("git", ["show", `HEAD:${rel}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }),
      );
    } catch {
      head[loc] = { Articles: [] };
    }
  }
  const teamPath = path.join(ROOT, "src", "lib", "team.ts");
  const teamSlugs = fs.existsSync(teamPath) ? readTeamSlugs(fs.readFileSync(teamPath, "utf8")) : new Set();
  const errors = validateRefreshedArticle({
    slug,
    today,
    current,
    head,
    routes: listAppRoutes(ROOT),
    teamSlugs,
    limits: {
      minWords: int(process.env.SEO_MIN_WORDS, 0),
      maxWords: int(process.env.SEO_MAX_WORDS, 0),
      minRefs: int(process.env.REFERENCE_MIN_COUNT, 3),
      minTrusted: int(process.env.REFERENCE_MIN_TRUSTED_DOMAINS, 0),
    },
  });
  if (errors.length) {
    console.error(`Refreshed article ${slug} failed validation:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`Refreshed article ${slug}: OK`);
}

if (require.main === module) main();
