"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  buildEditorialRules,
  buildRefreshPrompt,
  markUpdated,
  mergeRefreshedArticle,
  readTeamSlugs,
  refreshArticles,
  validateArticleMetadata,
} = require("./articleRefresh");
const {
  buildSystemPrompt,
  buildDraftPromptFromResearch,
  buildDraftRepairPromptFromExistingArticle,
  buildDraftAppendPromptFromExistingArticle,
  buildRetryPrompt,
  buildResearchPrompt,
} = require("../ai-ressources-update");

const BANNED = [
  /10\+\s*sections/i,
  /\b6 questions\b/i,
  /FAQ de 6/i,
  /2 tableaux/i,
  /2 checklists/i,
  /(ajoute|inclure|obligatoire)[^.\n]*(anecdote|étude de cas|cas pratique)/i,
  /cas pratique chiffré/i,
  /chiffres réalistes/i,
  /1 à 2 anecdotes/i,
  /exemples? (concrets )?chiffrés/i,
];

function assertClean(prompt, label) {
  for (const re of BANNED) assert.doesNotMatch(prompt, re, `${label} matches ${re}`);
}

test("no prompt path demands template sections or invented cases", () => {
  const frJson = { Articles: [{ slug: "x", title: "X", date: "2026-01-01", content: "a" }] };
  assertClean(buildSystemPrompt(frJson), "system");
  assertClean(
    buildDraftPromptFromResearch({ slug: "s", title: "t", description: "d", outline: [] }, []),
    "draft",
  );
  const art = { slug: "s", title: "t", description: "d", content: "mot ".repeat(50), references: [] };
  assertClean(buildDraftRepairPromptFromExistingArticle(art, { mode: "expand", minWords: 1200, maxWords: 2800 }), "repair");
  assertClean(buildDraftAppendPromptFromExistingArticle(art, { minWords: 1200 }), "append");
  for (const code of ["TOO_SHORT", "TOO_LONG"]) {
    assertClean(buildRetryPrompt("base", { code, words: 10, minWords: 1200, maxWords: 2800 }, frJson), `retry ${code}`);
  }
  assertClean(buildRefreshPrompt(art, { today: "2026-10-24", servicePath: "/services/payroll" }), "refresh");
});

test("editorial rules forbid invention and require Geneva anchor + Ark paragraph link", () => {
  const rules = buildEditorialRules({ servicePath: "/services/payroll" }).join("\n");
  assert.match(rules, /AUCUNE INVENTION/);
  assert.match(rules, /Exemple fictif/);
  assert.match(rules, /au plus 3 questions/);
  assert.match(rules, /AFC-GE/);
  assert.match(rules, /Ce que nous faisons chez Ark/);
  assert.match(rules, /\/services\/payroll/);
});

test("markUpdated sets updated and never touches date", () => {
  const a = { slug: "a", date: "2026-01-01" };
  markUpdated(a, "2026-10-24");
  assert.equal(a.updated, "2026-10-24");
  assert.equal(a.date, "2026-01-01");
});

test("mergeRefreshedArticle only takes generated fields and keeps the rest", () => {
  const existing = {
    slug: "a", date: "2026-01-01", category: "general", image: "i.png", author: "Ark Fiduciaire",
    authorUrl: "/x", reviewedBy: "samuel-halff", reviewedAt: "2026-02-01", custom: { k: 1 },
    title: "old", description: "d", content: "c", tags: ["a", "b", "c"], references: [{ labelKey: "L", url: "https://admin.ch" }],
  };
  const merged = mergeRefreshedArticle(existing, {
    slug: "HACK", date: "2000-01-01", category: "tax", image: "no.png", reviewedBy: "evil",
    title: "new", content: "new content", tags: [],
  });
  assert.equal(merged.title, "new");
  assert.equal(merged.content, "new content");
  assert.equal(merged.description, "d");
  assert.deepEqual(merged.tags, ["a", "b", "c"]);
  for (const k of ["slug", "date", "category", "image", "author", "authorUrl", "reviewedBy", "reviewedAt", "custom"]) {
    assert.deepEqual(merged[k], existing[k], k);
  }
});

// ---- transactional refresh -------------------------------------------------
const LOCALES = ["en", "de", "es", "pt"];
const words = (n, w = "mot") => Array.from({ length: n }, () => w).join(" ");

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "refresh-"));
  const fr = { Articles: [
    { slug: "one", date: "2026-01-01", category: "payroll", image: "one.png", author: "Ark Fiduciaire", authorUrl: "/team/x/",
      reviewedBy: "samuel-halff", reviewedAt: "2026-01-02", extra: 42, title: "Un 2025", description: "d1", content: words(800),
      tags: ["a", "b", "c"], references: [{ labelKey: "Ref", url: "https://www.admin.ch/x" }] },
    { slug: "two", date: "2026-02-01", category: "corporate", author: "Ark Fiduciaire", title: "Deux", description: "d2", content: words(800), tags: ["a", "b", "c"], references: [] },
  ] };
  fs.mkdirSync(path.join(dir, "fr"));
  fs.writeFileSync(path.join(dir, "fr", "ressources.json"), JSON.stringify(fr, null, 2));
  for (const l of LOCALES) {
    fs.mkdirSync(path.join(dir, l));
    const articles = fr.Articles.map((a) => ({ ...a, title: `${l} ${a.title}`, content: `${l} ${a.content}`, legacyLocalField: l }));
    fs.writeFileSync(path.join(dir, l, "ressources.json"), JSON.stringify({ Articles: articles, Other: { k: "v" } }, null, 2));
  }
  return dir;
}

function snapshot(dir) {
  const out = {};
  for (const l of ["fr", ...LOCALES]) out[l] = fs.readFileSync(path.join(dir, l, "ressources.json"), "utf8");
  return out;
}

function makeDeps({ failTranslateOn } = {}) {
  return {
    research: async () => [{ labelKey: "Ref2", url: "https://www.fedlex.admin.ch/y" }],
    draft: async (prompt, art) => {
      assert.match(prompt, /Tu mets à jour un article existant/);
      return { article: { title: `${art.title} MAJ 2026`, description: "nd", content: words(900, "neuf"), tags: ["x", "y", "z"] }, changeSummary: [`maj ${art.slug}`] };
    },
    postProcess: async () => {},
    translate: async (article) => {
      if (failTranslateOn === article.slug) throw new Error("boom");
      const out = {};
      for (const l of LOCALES) out[l] = { Article: { title: `${l} ${article.title}`, description: `${l} d`, content: `${l} ${article.content}` }, labels: { Ref2: `${l} Ref2` } };
      return out;
    },
  };
}

test("refresh --apply merges generated fields, preserves the rest, mirrors metadata", async () => {
  const dir = makeFixture();
  const results = await refreshArticles({
    slugs: ["one"], today: "2026-10-24", translationsDir: dir, apply: true, deps: makeDeps(), log: () => {},
    servicePaths: { one: "/services/payroll" },
  });
  assert.equal(results[0].wordsAfter, 900);
  const fr = JSON.parse(fs.readFileSync(path.join(dir, "fr", "ressources.json"), "utf8"));
  const one = fr.Articles[0];
  assert.equal(one.title, "Un 2025 MAJ 2026");
  assert.equal(one.updated, "2026-10-24");
  assert.equal(one.date, "2026-01-01");
  for (const [k, v] of Object.entries({ category: "payroll", image: "one.png", author: "Ark Fiduciaire", authorUrl: "/team/x/", reviewedBy: "samuel-halff", reviewedAt: "2026-01-02", extra: 42 })) {
    assert.equal(one[k], v, k);
  }
  assert.deepEqual(one.references, [{ labelKey: "Ref2", url: "https://www.fedlex.admin.ch/y" }]);
  assert.equal(fr.Articles[1].title, "Deux"); // untouched
  for (const l of LOCALES) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, l, "ressources.json"), "utf8"));
    assert.deepEqual(data.Other, { k: "v" });
    const a = data.Articles[0];
    assert.equal(a.title, `${l} Un 2025 MAJ 2026`);
    assert.equal(a.updated, "2026-10-24");
    assert.equal(a.reviewedBy, "samuel-halff");
    assert.equal(a.image, "one.png");
    assert.equal(a.legacyLocalField, l); // unknown local field preserved
    assert.equal(a.references[0].labelKey, `${l} Ref2`);
    assert.equal(data.Articles[1].title, `${l} Deux`);
  }
  assert.deepEqual(fs.readdirSync(path.join(dir, "fr")), ["ressources.json"]); // no temp leftovers
});

test("refresh without --apply writes nothing", async () => {
  const dir = makeFixture();
  const before = snapshot(dir);
  await refreshArticles({ slugs: ["one"], today: "2026-10-24", translationsDir: dir, apply: false, deps: makeDeps(), log: () => {} });
  assert.deepEqual(snapshot(dir), before);
});

test("any failure (second slug translation) writes nothing at all", async () => {
  const dir = makeFixture();
  const before = snapshot(dir);
  await assert.rejects(
    refreshArticles({ slugs: ["one", "two"], today: "2026-10-24", translationsDir: dir, apply: true, deps: makeDeps({ failTranslateOn: "two" }), log: () => {} }),
    /boom/,
  );
  assert.deepEqual(snapshot(dir), before);
});

test("incomplete or untranslated locale payload aborts without writing", async () => {
  for (const mutate of [
    (t) => { delete t.pt; },
    (t, art) => { t.de.Article.content = art.content; },
    (t) => { t.es.Article.title = ""; },
  ]) {
    const dir = makeFixture();
    const before = snapshot(dir);
    const deps = makeDeps();
    const base = deps.translate;
    deps.translate = async (art, labels) => { const t = await base(art, labels); mutate(t, art); return t; };
    await assert.rejects(refreshArticles({ slugs: ["one"], today: "2026-10-24", translationsDir: dir, apply: true, deps, log: () => {} }));
    assert.deepEqual(snapshot(dir), before);
  }
});

test("too-short refreshed article and postProcess errors abort without writing", async () => {
  let dir = makeFixture();
  let before = snapshot(dir);
  const short = makeDeps();
  short.draft = async () => ({ article: { content: words(50) }, changeSummary: [] });
  await assert.rejects(refreshArticles({ slugs: ["one"], today: "2026-10-24", translationsDir: dir, apply: true, deps: short, log: () => {} }), /too short/);
  assert.deepEqual(snapshot(dir), before);

  dir = makeFixture();
  before = snapshot(dir);
  const bad = makeDeps();
  bad.postProcess = async () => { throw new Error("TVA obsolète"); };
  await assert.rejects(refreshArticles({ slugs: ["one"], today: "2026-10-24", translationsDir: dir, apply: true, deps: bad, log: () => {} }), /TVA/);
  assert.deepEqual(snapshot(dir), before);
});

test("unknown slug fails before any model call", async () => {
  const dir = makeFixture();
  const deps = makeDeps();
  let called = false;
  deps.research = async () => { called = true; return []; };
  await assert.rejects(refreshArticles({ slugs: ["nope"], today: "2026-10-24", translationsDir: dir, apply: true, deps, log: () => {} }), /not found/);
  assert.equal(called, false);
});

// ---- metadata validator ----------------------------------------------------
test("validateArticleMetadata enforces updated/reviewedBy/reviewedAt rules", () => {
  const slugs = readTeamSlugs('  name: "Sébastien Gallié",\n  name: "Samuel Halff",\n');
  assert.ok(slugs.has("sebastien-gallie") && slugs.has("samuel-halff"));
  assert.deepEqual(validateArticleMetadata([{ slug: "ok", date: "2026-01-01" }], slugs), []);
  assert.deepEqual(validateArticleMetadata([{ slug: "ok", date: "2026-01-01", updated: "2026-02-01", reviewedBy: "samuel-halff", reviewedAt: "2026-02-01" }], slugs), []);
  const bad = (a) => validateArticleMetadata([{ slug: "x", date: "2026-03-01", ...a }], slugs).length;
  assert.ok(bad({ updated: "2026-02-01" }));
  assert.ok(bad({ reviewedBy: "nobody", reviewedAt: "2026-03-02" }));
  assert.ok(bad({ reviewedBy: "samuel-halff" }));
  assert.ok(bad({ reviewedBy: "samuel-halff", reviewedAt: "2026-02-01" }));
  assert.ok(bad({ reviewedBy: "samuel-halff", updated: "2026-04-01", reviewedAt: "2026-03-15" }));
  assert.ok(bad({ reviewedAt: "2026-03-15" }));
});

test("research prompt does not steer outlines toward a FAQ", () => {
  const fr = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../src/translations/fr/ressources.json"),
      "utf8",
    ),
  );
  const prompt = buildResearchPrompt(fr, null, null);
  assert.doesNotMatch(prompt, /"FAQ \.\.\."/);
  assert.doesNotMatch(prompt, /10\+ sections/);
});
