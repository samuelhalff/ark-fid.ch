"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { validateRefreshedArticle, listAppRoutes, routeExists } = require("./refreshedArticleValidator");

const TODAY = "2026-10-24";
const words = (n, w = "mot") => Array.from({ length: n }, (_, i) => `${w}${i}`).join(" ");
const REFS = [
  { labelKey: "a", url: "https://www.admin.ch/a" },
  { labelKey: "b", url: "https://www.estv.admin.ch/b" },
  { labelKey: "c", url: "https://www.ge.ch/c" },
  { labelKey: "d", url: "https://www.fedlex.admin.ch/d" },
];
const routes = new Set(["", "contact", "team", "services", "services/accounting", "ressources"]);

function art(loc, over = {}) {
  return {
    slug: "s",
    title: loc === "fr" ? "Titre fr" : `Title ${loc}`,
    description: loc === "fr" ? "Description en francais de larticle" : `Description in ${loc} of the article`,
    content: `${words(1300, loc)} [x](/services/accounting) [y](/contact)`,
    date: "2025-01-01",
    updated: TODAY,
    category: "tax",
    tags: ["t"],
    references: REFS,
    ...over,
  };
}
function data(overByLoc = {}) {
  const d = {};
  for (const loc of ["fr", "en", "de", "es", "pt"]) d[loc] = { Articles: [art(loc, overByLoc[loc])] };
  return d;
}
const limits = { minWords: 1200, maxWords: 2800, minRefs: 4, minTrusted: 1 };
const run = (current, head = data({ fr: { updated: undefined } })) =>
  validateRefreshedArticle({ slug: "s", today: TODAY, current, head, routes, limits });

test("valid refreshed article passes", () => {
  assert.deepEqual(run(data()), []);
});

test("rejects too-short FR content", () => {
  const errs = run(data({ fr: { content: words(500) } }));
  assert.ok(errs.some((e) => /^fr: 500 words < min 1200/.test(e)));
});

test("rejects too-long content", () => {
  assert.ok(run(data({ fr: { content: words(3000) } })).some((e) => /> max 2800/.test(e)));
});

test("rejects missing / identical translation", () => {
  const d = data();
  d.de.Articles[0].content = d.fr.Articles[0].content;
  d.en.Articles[0].title = "";
  const errs = run(d);
  assert.ok(errs.some((e) => /de: content identical to FR/.test(e)));
  assert.ok(errs.some((e) => /en: title empty/.test(e)));
});

test("short proper-noun title identical to FR is allowed", () => {
  const d = data();
  d.es.Articles[0].title = d.fr.Articles[0].title;
  assert.deepEqual(run(d), []);
});

test("rejects bad internal links (unknown route, unknown article, other locale)", () => {
  const bad = `${words(1300)} [a](/services/nope) [b](/ressources/articles/ghost) [c](/en/contact)`;
  const errs = run(data({ fr: { content: bad } }));
  assert.ok(errs.some((e) => /unknown internal route \/services\/nope/.test(e)));
  assert.ok(errs.some((e) => /unknown article/.test(e)));
  assert.ok(errs.some((e) => /other locale/.test(e)));
});

test("rejects changed date/category vs HEAD and stale updated", () => {
  const head = data();
  const cur = data({ fr: { date: "2026-01-01", category: "other", updated: "2026-10-01" } });
  const errs = run(cur, head);
  assert.ok(errs.some((e) => /fr: date changed/.test(e)));
  assert.ok(errs.some((e) => /fr: category changed/.test(e)));
  assert.ok(errs.some((e) => /fr: updated 2026-10-01 != 2026-10-24/.test(e)));
});

test("rejects too few / duplicate / non-https / missing tags", () => {
  const errs = run(data({ fr: { references: [REFS[0], REFS[0], { url: "http://www.admin.ch/x" }], tags: [] } }));
  assert.ok(errs.some((e) => /3 references < 4/.test(e)));
  assert.ok(errs.some((e) => /duplicate reference/.test(e)));
  assert.ok(errs.some((e) => /not https/.test(e)));
  assert.ok(errs.some((e) => /tags missing/.test(e)));
});

test("rejects outdated VAT rates", () => {
  const c = `${words(1300)} la TVA est de 7.7% aujourd'hui`;
  assert.ok(run(data({ fr: { content: c } })).some((e) => /outdated VAT/.test(e)));
});

test("listAppRoutes derives static and dynamic routes from the real app tree", () => {
  const routes = listAppRoutes(path.resolve(__dirname, "..", ".."));
  for (const r of ["", "agent", "ressources/articles", "team", "services/accounting", "legal/terms", "team/[slug]"]) {
    assert.ok(routes.has(r), `missing ${r}`);
  }
});

test("listAppRoutes handles route groups and ignores folders without a page", () => {
  const fsx = require("fs");
  const root = fsx.mkdtempSync(path.join(require("os").tmpdir(), "routes-"));
  const base = path.join(root, "app", "[locale]");
  for (const [d, file] of [["", "page.tsx"], ["(g)/x", "page.tsx"], ["empty", "layout.tsx"], ["empty/leaf", "page.tsx"]]) {
    fsx.mkdirSync(path.join(base, d), { recursive: true });
    fsx.writeFileSync(path.join(base, d, file), "");
  }
  const routes = listAppRoutes(root);
  assert.deepEqual([...routes].sort(), ["", "empty/leaf", "x"]);
});

test("routeExists resolves dynamic params from data sources, or accepts any", () => {
  const routes = new Set(["", "team", "team/[slug]", "other/[id]"]);
  const resolvers = { "team/[slug]": new Set(["jane"]) };
  assert.ok(routeExists(routes, "team/jane", resolvers));
  assert.ok(!routeExists(routes, "team/ghost", resolvers));
  assert.ok(routeExists(routes, "other/anything", resolvers));
  assert.ok(!routeExists(routes, "other", resolvers));
  assert.ok(!routeExists(routes, "team/jane/extra", resolvers));
});

test("accepts /agent, /ressources/articles and /team/<member>; rejects unknown team member", () => {
  const dyn = new Set([...routes, "agent", "ressources/articles", "team/[slug]"]);
  const content = (extra) => `${words(1300)} ${extra}`;
  const mk = (extra) => data(Object.fromEntries(["fr", "en", "de", "es", "pt"].map((l) => [l, { content: content(extra) }])));
  const call = (extra) =>
    validateRefreshedArticle({
      slug: "s", today: TODAY, current: mk(extra), head: data({ fr: { updated: undefined } }),
      routes: dyn, teamSlugs: new Set(["jane-doe"]), limits,
    });
  const noRoute = (errs) => errs.filter((e) => /internal route/.test(e));
  assert.deepEqual(noRoute(call("[a](/agent) [b](/ressources/articles) [c](/team/jane-doe)")), []);
  assert.ok(noRoute(call("[c](/team/ghost)")).length > 0);
});
