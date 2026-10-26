"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const lib = require("./lib/sogcReport");
const render = require("./lib/sogcReportRender");
const { upsertArticle, checkRendered } = require("./sogc-monthly-report");
const { isDataReportArticle, withoutDataReports } = require("./lib/articleTopicGuardrails");
const { pickStaleSlug } = require("./refresh-next-article");
const { extractDomain, isBlockedDomain, ALLOWED_REFERENCE_DOMAINS } = require("./lib/referenceValidator");
const { countWords } = require("./lib/articleRefresh");

// ---------- fixtures ----------

function hr01Xml({ legalForm, purpose, text, uid = "CHE-111.222.333", name = "Fixture Name SA" }) {
  return `<?xml version='1.0' encoding='UTF-8'?>
<HR01:publication xmlns:HR01="https://shab.ch/shab/HR01-export">
<meta><id>x</id><rubric>HR</rubric><subRubric>HR01</subRubric></meta>
<content>
  <publicationText>${text}</publicationText>
  <commonsNew><company><name>${name}</name><uid>${uid}</uid><legalForm>${legalForm}</legalForm></company>
  ${purpose ? `<purpose>${purpose}</purpose>` : ""}
  </commonsNew>
</content>
</HR01:publication>`;
}

const FAKE_NAMES = ["Fixture Name SA", "Dupont Jean", "CHE-111.222.333"];

/** Synthetic snapshot: deterministic counts for every report month. */
function syntheticSnapshot(month = "2026-09") {
  const months = lib.reportMonths(month);
  const lists = { hr01: {}, hr03: {} };
  let n = 0;
  for (const [ci, canton] of lib.CANTONS.entries()) {
    lists.hr01[canton] = [];
    lists.hr03[canton] = [];
    for (const [mi, ym] of months.entries()) {
      const creations = 10 + ci * 3 + (mi % 4);
      const deletions = 4 + ci + (mi % 3);
      for (let i = 0; i < creations; i++) lists.hr01[canton].push({ id: `c${n++}`, day: `${ym}-15`, cantons: [canton] });
      for (let i = 0; i < deletions; i++) lists.hr03[canton].push({ id: `d${n++}`, day: `${ym}-15`, cantons: [canton] });
    }
  }
  const codes = ["0106", "0107", "0107", "0101", "0151", "0109"];
  const sectors = ["realestate", "it", "consulting", "unclassified"];
  const details = new Map();
  let k = 0;
  for (const canton of lib.CANTONS) {
    for (const item of lists.hr01[canton]) {
      if (item.day.slice(0, 7) !== month) continue;
      details.set(item.id, {
        subRubric: "HR01",
        legalForm: codes[k % codes.length],
        uid: `CHE-000.000.${String(k).padStart(3, "0")}`,
        hasPurpose: true,
        sector: sectors[k % sectors.length],
        seatTransferMention: false,
      });
      k++;
    }
  }
  return lib.buildSnapshot({ targetMonth: month, lists, details, fetchedAt: "2026-10-26T08:00:00.000Z", publishedOn: "2026-10-26" });
}

// ---------- parsing and classification ----------

test("legal form codes map to report buckets", () => {
  assert.equal(lib.legalFormBucket("0106"), "sa");
  assert.equal(lib.legalFormBucket("0107"), "sarl");
  assert.equal(lib.legalFormBucket("0101"), "ei");
  assert.equal(lib.legalFormBucket("0151"), "branch");
  assert.equal(lib.legalFormBucket("0111"), "branch");
  assert.equal(lib.legalFormBucket("0109"), "other");
  assert.equal(lib.legalFormBucket("9999"), "other");
});

test("parseHr01Xml reads legal form, purpose and decodes entities", () => {
  const d = lib.parseHr01Xml(hr01Xml({ legalForm: "0106", purpose: "l&apos;exploitation d&apos;un restaurant &amp; bar.", text: "X SA, à Genève. Nouvelle société anonyme." }));
  assert.equal(d.subRubric, "HR01");
  assert.equal(d.legalForm, "0106");
  assert.equal(d.hasPurpose, true);
  assert.equal(d.sector, "hospitality");
  assert.equal(d.seatTransferMention, false);
  assert.equal(Object.keys(d).includes("name"), false, "no company name is kept");
});

test("sole proprietorship purpose is taken from the publication text (FR and DE)", () => {
  const fr = lib.parseHr01Xml(hr01Xml({ legalForm: "0101", text: "Exo - Dupont, à Carouge. Nouvelle entreprise individuelle. Titulaire: Dupont Jean. But: développement de logiciels sur mesure." }));
  assert.equal(fr.sector, "it");
  assert.equal(fr.hasPurpose, true);
  const de = lib.parseHr01Xml(hr01Xml({ legalForm: "0101", text: "Muster, in Brig. Neues Einzelunternehmen. Zweck: Betrieb eines Restaurants." }));
  assert.equal(de.sector, "hospitality");
});

test("sector: earliest keyword wins and boilerplate is ignored", () => {
  assert.equal(lib.classifySector("Prestations de conseil; travaux de construction."), "consulting");
  assert.equal(lib.classifySector("Construction et rénovation; conseil."), "realestate");
  assert.equal(
    lib.classifySector("L'exploitation d'un salon de coiffure. La société peut acquérir des immeubles et participer à des entreprises."),
    "health",
  );
  assert.equal(lib.classifySector("La détention et la gestion de participations dans toutes sociétés."), "holding");
  assert.equal(lib.classifySector(""), "unclassified");
  assert.equal(lib.classifySector("Tatouage et piercing."), "unclassified");
});

test("seat transfer mentions are flagged", () => {
  const d = lib.parseHr01Xml(hr01Xml({ legalForm: "0107", purpose: "conseil", text: "Y Sàrl, précédemment à Lausanne, transfert de son siège à Genève." }));
  assert.equal(d.seatTransferMention, true);
});

test("month helpers", () => {
  assert.equal(lib.shiftMonth("2026-01", -1), "2025-12");
  assert.equal(lib.shiftMonth("2026-09", -12), "2025-09");
  assert.deepEqual(lib.monthRange("2024-02"), { start: "2024-02-01", end: "2024-02-29" });
  assert.equal(lib.reportMonths("2026-09")[0], "2025-01");
  assert.equal(lib.reportMonths("2026-09").length, 21);
  assert.throws(() => lib.assertMonth("2026-13"));
});

// ---------- API fail-closed behaviour ----------

function fakeFetch(body) {
  return async () => ({ ok: true, status: 200, json: async () => body, text: async () => "" });
}

test("listPublications rejects items outside the requested filter", async () => {
  const base = { id: "a", cantons: ["GE"], publicationState: "PUBLISHED", publicationDate: "2026-09-10T00:00:00.000Z" };
  const args = { subRubric: "HR01", canton: "GE", start: "2026-09-01", end: "2026-09-30" };
  await assert.rejects(
    lib.listPublications({ ...args, fetchImpl: fakeFetch({ total: 1, content: [{ meta: { ...base, subRubric: "HR02" } }] }) }),
    /Filter leak/,
  );
  await assert.rejects(
    lib.listPublications({ ...args, fetchImpl: fakeFetch({ total: 1, content: [{ meta: { ...base, subRubric: "HR01", cantons: ["VD"] } }] }) }),
    /Filter leak/,
  );
  await assert.rejects(
    lib.listPublications({ ...args, fetchImpl: fakeFetch({ total: 2, content: [{ meta: { ...base, subRubric: "HR01" } }] }) }),
    /Fetched 1 of 2/,
  );
  const ok = await lib.listPublications({ ...args, fetchImpl: fakeFetch({ total: 1, content: [{ meta: { ...base, subRubric: "HR01" } }] }) });
  assert.deepEqual(ok, [{ id: "a", day: "2026-09-10", cantons: ["GE"] }]);
});

test("buildSnapshot fails when a detail is missing", () => {
  const lists = { hr01: { GE: [{ id: "a", day: "2026-09-02", cantons: ["GE"] }] }, hr03: {} };
  assert.throws(
    () => lib.buildSnapshot({ targetMonth: "2026-09", lists, details: new Map(), fetchedAt: "x", publishedOn: "2026-10-26" }),
    /Missing HR01 detail/,
  );
});

test("multi-canton publications are counted once", () => {
  const lists = {
    hr01: { GE: [{ id: "a", day: "2026-09-02", cantons: ["GE", "VD"] }], VD: [{ id: "a", day: "2026-09-02", cantons: ["GE", "VD"] }] },
    hr03: {},
  };
  const details = new Map([["a", { subRubric: "HR01", legalForm: "0107", uid: "u", hasPurpose: true, sector: "it", seatTransferMention: false }]]);
  const s = lib.buildSnapshot({ targetMonth: "2026-09", lists, details, fetchedAt: "x", publishedOn: "2026-10-26" });
  assert.equal(s.monthly["2026-09"].hr01.GE, 1);
  assert.equal(s.monthly["2026-09"].hr01.VD, 0);
  assert.equal(s.quality.multiCantonPublications, 1);
});

// ---------- figures and rendering ----------

test("computed figures match the snapshot counts", () => {
  const s = syntheticSnapshot();
  const f = render.computeFigures(s);
  const ge = f.rows.find((r) => r.canton === "GE");
  assert.equal(ge.creations, s.monthly["2026-09"].hr01.GE);
  assert.equal(ge.prevCreations, s.monthly["2026-08"].hr01.GE);
  assert.equal(ge.yoyCreations, s.monthly["2025-09"].hr01.GE);
  assert.equal(ge.net, ge.creations - s.monthly["2026-09"].hr03.GE);
  const ytd = lib.monthsBetween("2026-01", "2026-09").reduce((a, m) => a + s.monthly[m].hr01.GE, 0);
  assert.equal(ge.ytd, ytd);
  assert.equal(f.total.creations, lib.CANTONS.reduce((a, c) => a + s.monthly["2026-09"].hr01[c], 0));
  assert.equal(
    render.LOCALES.length && Object.values(f.total.legal).reduce((a, b) => a + b, 0),
    f.total.creations,
  );
  assert.equal(f.trend.length, 13);
  assert.equal(f.sectorTotal, f.total.creations);
});

test("FR table rows carry the exact computed values", () => {
  const s = syntheticSnapshot();
  const f = render.computeFigures(s);
  const a = render.renderArticle("fr", s);
  const ge = f.rows.find((r) => r.canton === "GE");
  const expected = `| Genève | ${ge.creations} | ${ge.prevCreations} | ${render.fmtPct("fr", ge.mom)} | ${ge.yoyCreations} | ${render.fmtPct("fr", ge.yoy)} | ${ge.deletions} | +${ge.net} |`;
  assert.ok(a.content.includes(expected), `missing row: ${expected}`);
  const legalRow = `| Genève | ${["sa", "sarl", "ei", "branch", "other"].map((k) => ge.legal[k]).join(" | ")} | ${ge.creations} |`;
  assert.ok(a.content.includes(legalRow), `missing row: ${legalRow}`);
});

test("rendering is deterministic, complete and free of personal data in every locale", () => {
  const s = syntheticSnapshot();
  for (const locale of render.LOCALES) {
    const a = render.renderArticle(locale, s);
    assert.deepEqual(a, render.renderArticle(locale, s));
    assert.deepEqual(checkRendered(locale, a), []);
    assert.equal(a.slug, "creations-entreprises-geneve-suisse-romande-septembre-2026");
    assert.equal(a.series, lib.SERIES);
    assert.equal(a.reportMonth, "2026-09");
    assert.equal(a.date, "2026-10-26");
    for (const needle of FAKE_NAMES) assert.equal(a.content.includes(needle), false);
    assert.ok(a.content.includes(render.csvPath("2026-09")));
    assert.ok(a.content.includes(`https://ark-fid.ch/${locale}/ressources/articles/${a.slug}/`));
    for (const ref of a.references) {
      const domain = extractDomain(ref.url);
      assert.ok(ALLOWED_REFERENCE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`)), domain);
      assert.equal(isBlockedDomain(ref.url), false, ref.url);
    }
  }
  assert.ok(countWords(render.renderArticle("fr", s).content) >= 700);
});

test("CSV holds aggregates only", () => {
  const s = syntheticSnapshot();
  const csv = render.renderCsv(s);
  const lines = csv.trim().split("\n");
  assert.equal(lines.length, 1 + lib.CANTONS.length + 1);
  assert.ok(lines[0].startsWith("report_month,canton,new_entries"));
  for (const needle of FAKE_NAMES) assert.equal(csv.includes(needle), false);
  assert.equal(render.renderCsv(s), csv);
});

test("snapshot checksum ignores retrieval metadata only", () => {
  const a = syntheticSnapshot();
  const b = { ...a, fetchedAt: "2030-01-01T00:00:00.000Z" };
  assert.equal(lib.checksum(a), lib.checksum(b));
  const c = JSON.parse(JSON.stringify(a));
  c.monthly["2026-09"].hr01.GE += 1;
  assert.notEqual(lib.checksum(a), lib.checksum(c));
});

// ---------- article store integration ----------

test("upsertArticle keeps the first publication date and marks updates", () => {
  const s = syntheticSnapshot();
  const article = render.renderArticle("fr", s);
  const data = { Articles: [] };
  assert.equal(upsertArticle(data, article, "2026-10-26"), "added");
  assert.equal(upsertArticle(data, { ...article, date: "2026-11-03" }, "2026-11-03"), "unchanged");
  assert.equal(data.Articles[0].date, "2026-10-26");
  assert.equal(upsertArticle(data, { ...article, content: `${article.content}\n` }, "2026-11-03"), "updated");
  assert.equal(data.Articles[0].date, "2026-10-26");
  assert.equal(data.Articles[0].updated, "2026-11-03");
  assert.throws(() => upsertArticle({ Articles: [{ slug: article.slug, series: "other" }] }, article, "2026-11-03"), /another series/);
});

test("only the reserved series is exempt from editorial guardrails and LLM refresh", () => {
  assert.equal(isDataReportArticle({ series: lib.SERIES }), true);
  assert.equal(isDataReportArticle({ series: "anything-else" }), false);
  assert.equal(isDataReportArticle({}), false);
  assert.deepEqual(withoutDataReports([{ slug: "a" }, { slug: "b", series: lib.SERIES }]).map((a) => a.slug), ["a"]);
  const now = new Date("2028-01-01T00:00:00Z");
  const state = { queue: [], failed: [] };
  assert.equal(pickStaleSlug([{ slug: "r", date: "2026-10-26", series: lib.SERIES }], state, now), null);
  assert.equal(pickStaleSlug([{ slug: "x", date: "2026-10-26", series: "other" }], state, now), "x");
});
