#!/usr/bin/env node
// src/data/article-locale-noindex.json drives noindex/sitemap/hreflang for pruned ES/PT
// article pages; a typo there would silently do nothing (or hide the wrong page).
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { LEGACY_ARTICLE_LOCALES } = require("./lib/articleLocales");

const ROOT = path.resolve(__dirname, "..");
const DATA = path.join(ROOT, "src/data/article-locale-noindex.json");
const ARTICLE_PREFIX = "/:locale/ressources/articles/";

const slugsFor = (locale) => {
  const file = path.join(ROOT, "src/translations", locale, "ressources.json");
  return new Set((JSON.parse(fs.readFileSync(file, "utf8")).Articles || []).map((a) => a.slug));
};

describe("article locale noindex list", () => {
  const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
  let redirectSlugs = new Set();
  let redirectTargets = new Set();

  before(async () => {
    const config = require(path.join(ROOT, "next.config.js"));
    const rules = (await config.redirects()).filter((r) => r.source.startsWith(ARTICLE_PREFIX));
    const slugOf = (p) => p.slice(ARTICLE_PREFIX.length).replace(/\/$/, "");
    redirectSlugs = new Set(rules.map((r) => slugOf(r.source)));
    redirectTargets = new Set(
      rules.filter((r) => r.destination.startsWith(ARTICLE_PREFIX)).map((r) => slugOf(r.destination)),
    );
  });

  it("only lists legacy locales (ES/PT) as arrays of unique strings", () => {
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith("_")) continue;
      assert.ok(LEGACY_ARTICLE_LOCALES.includes(key), `unexpected locale key ${key}`);
      assert.ok(Array.isArray(value), `${key} must be an array`);
      assert.ok(value.every((s) => typeof s === "string" && s.length), `${key} has a non-string entry`);
      assert.equal(new Set(value).size, value.length, `${key} has duplicates`);
    }
  });

  it("every listed slug exists in that locale and is not redirected", () => {
    for (const locale of LEGACY_ARTICLE_LOCALES) {
      const slugs = slugsFor(locale);
      for (const slug of data[locale] || []) {
        assert.ok(slugs.has(slug), `${locale}: ${slug} is not an article in ${locale}`);
        assert.equal(redirectSlugs.has(slug), false, `${locale}: ${slug} is a redirect source`);
      }
    }
  });

  it("never hides a consolidation target (redirects must land on indexable pages)", () => {
    for (const locale of LEGACY_ARTICLE_LOCALES) {
      for (const slug of data[locale] || []) {
        assert.equal(redirectTargets.has(slug), false, `${locale}: ${slug} receives redirects`);
      }
    }
  });

  it("is wired into metadata, sitemap and feed", () => {
    const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
    assert.match(read("src/lib/articles.ts"), /article-locale-noindex\.json/);
    assert.match(read("app/sitemap.xml/route.ts"), /getIndexableLocalesForSlug/);
    assert.match(read("app/[locale]/feed.xml/route.ts"), /isIndexableArticleLocale/);
    const page = read("app/[locale]/ressources/articles/[slug]/page.tsx");
    assert.match(page, /getIndexableLocalesForSlug\(params\.slug\)/);
    assert.match(page, /isIndexableArticleLocale\(locale, params\.slug\)/);
  });
});
