"use strict";

const fs = require("fs");
const path = require("path");
const {
  describeTopic,
  findAllTimeNearDuplicate,
  findRecentTitleConflict,
  findRecentTopicConflict,
  withoutDataReports,
} = require("./lib/articleTopicGuardrails");

const {
  readTeamSlugs,
  validateArticleMetadata,
} = require("./lib/articleRefresh");

const ROOT = process.cwd();
const FR_PATH = path.join(ROOT, "src", "translations", "fr", "ressources.json");
// --slug=<slug> validates that article instead of the latest editorial one
// (used by the deterministic data-report workflow).
const SLUG_ARG = (process.argv.find((a) => a.startsWith("--slug=")) || "")
  .slice("--slug=".length)
  .trim();
const TOPIC_ROTATION_WINDOW = Math.max(
  1,
  parseInt(process.env.TOPIC_ROTATION_WINDOW || "10", 10) || 10,
);

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!fs.existsSync(FR_PATH)) {
  fail(`Canonical FR ressources file not found: ${FR_PATH}`);
}

const frData = loadJSON(FR_PATH);
const articles = Array.isArray(frData.Articles) ? frData.Articles : [];

// Review/update metadata (all articles: a refreshed article is rarely the latest by date).
{
  const teamPath = path.join(ROOT, "src", "lib", "team.ts");
  const teamSlugs = fs.existsSync(teamPath)
    ? readTeamSlugs(fs.readFileSync(teamPath, "utf8"))
    : new Set();
  const metadataErrors = validateArticleMetadata(articles, teamSlugs);
  if (metadataErrors.length) {
    fail(`Article metadata invalid:\n  - ${metadataErrors.join("\n  - ")}`);
  }
}
if (articles.length < 2) {
  console.log("ℹ️ Not enough FR articles to validate latest-article guardrails");
  process.exit(0);
}

// Data reports (reserved series) are intentionally similar month to month:
// they are never the "latest editorial article" and never act as comparators.
// Filtering happens before the rotation window is taken, so reports do not
// consume window slots either.
const editorial = withoutDataReports(articles).sort((a, b) =>
  (b.date || "").localeCompare(a.date || ""),
);
let latest;
if (SLUG_ARG) {
  latest = articles.find((a) => a && a.slug === SLUG_ARG);
  if (!latest) fail(`--slug article not found in FR ressources: ${SLUG_ARG}`);
} else {
  latest = editorial[0];
  if (!latest) {
    console.log("ℹ️ No editorial FR article to validate");
    process.exit(0);
  }
}
const comparators = editorial.filter((a) => a.slug !== latest.slug);
const sorted = [latest, ...comparators];
const recent = comparators.slice(0, TOPIC_ROTATION_WINDOW);

function countWords(text) {
  if (typeof text !== "string") return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

if (
  !latest.category ||
  typeof latest.category !== "string" ||
  !Array.isArray(latest.tags) ||
  latest.tags.length < 3
) {
  fail(
    `Latest article lacks required taxonomy: category must be a non-empty STRING (an object shipped once and 500'd the article) and at least 3 tags are required (${latest.slug})`,
  );
}

const latestWords = countWords(latest.content || "");
if (latestWords < 700) {
  fail(
    `Latest article is too short: ${latestWords} words (minimum: 700) (${latest.slug})`,
  );
}

const titleConflict = findRecentTitleConflict(recent, latest, {
  windowSize: TOPIC_ROTATION_WINDOW,
});
if (titleConflict) {
  fail(
    titleConflict.code === "DUPLICATE_TITLE"
      ? `Latest article title duplicates recent content: "${latest.title}" matches "${titleConflict.previousTitle}"`
      : `Latest article title is too close to recent content: "${latest.title}" vs "${titleConflict.previousTitle}"`,
  );
}

const topicConflict = findRecentTopicConflict(recent, latest, {
  windowSize: TOPIC_ROTATION_WINDOW,
});
if (topicConflict) {
  if (topicConflict.code === "TOPIC_DUPLICATE") {
    fail(
      `Latest article repeats recent topic "${describeTopic(topicConflict.topic)}": "${latest.title}" vs "${topicConflict.previousTitle}"`,
    );
  }
  fail(
    `Latest article is too similar to recent content: "${latest.title}" vs "${topicConflict.previousTitle}"`,
  );
}

// The windowed checks above miss duplicates published months apart (the
// rotation window rolls past them). Compare against the whole corpus too.
const allTimeDuplicate = findAllTimeNearDuplicate(sorted.slice(1), latest);
if (allTimeDuplicate) {
  fail(
    `Latest article near-duplicates existing content (all-time check, ${allTimeDuplicate.code}): "${latest.title}" vs "${allTimeDuplicate.previousTitle}" (${allTimeDuplicate.previousSlug})`,
  );
}

console.log(
  `✅ Latest FR article passes taxonomy, length, duplicate-title, recent-topic and all-time near-duplicate guardrails (${TOPIC_ROTATION_WINDOW}-article window + full corpus)`,
);
