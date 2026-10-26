"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const lib = require("./lib/sogcReport");
const render = require("./lib/sogcReportRender");
const {
  upsertArticle,
  removeLegacyMonthly,
  removeFromUnpublishedLocale,
  checkRendered,
  writeCsvIfDataChanged,
  verifySnapshot,
} = require("./sogc-monthly-report");
const { isDataReportArticle, withoutDataReports, DATA_REPORT_SERIES } = require("./lib/articleTopicGuardrails");
const { pickStaleSlug } = require("./refresh-next-article");
const { extractDomain, isBlockedDomain, ALLOWED_REFERENCE_DOMAINS } = require("./lib/referenceValidator");
const { countWords } = require("./lib/articleRefresh");

const { PAGES } = render;
const LEGACY_SLUG = "creations-entreprises-geneve-suisse-romande-septembre-2026";

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

function kkXml({ sub = "KK03", type, addition, or731b, custom }) {
  const debtor = type === "company"
    ? `<selectType>company</selectType><companies><company><name>Fixture Name SA</name><uid>CHE-111.222.333</uid></company></companies>`
    : `<selectType>${type}</selectType><person><prename>Jean</prename><name>Dupont</name></person>`;
  return `<KK:publication><meta><id>x</id><subRubric>${sub}</subRubric></meta><content>
  <debtor>${debtor}</debtor>
  ${or731b ? `<or731b>${or731b}</or731b>` : ""}
  ${addition ? `<addition>${addition}</addition>` : ""}
  ${custom ? `<additionCustom>${custom}</additionCustom>` : ""}
  </content></KK:publication>`;
}

const FAKE_NAMES = ["Fixture Name SA", "Dupont", "CHE-111.222.333"];

/** Synthetic snapshot: deterministic counts for every report month. */
function syntheticSnapshot(month = "2026-09") {
  const months = lib.reportMonths(month);
  const lists = {};
  let n = 0;
  for (const [kind] of lib.LIST_KINDS) lists[kind] = {};
  for (const [ci, canton] of lib.CANTONS.entries()) {
    for (const [kind] of lib.LIST_KINDS) lists[kind][canton] = [];
    for (const ym of months) {
      const mi = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)); // depends on the month only
      const counts = {
        hr01: 10 + ci * 3 + (mi % 4),
        hr03: 4 + ci + (mi % 3),
        kk02: 2 + (ci % 2) + (mi % 2),
        kk03: 3 + (mi % 5),
      };
      for (const [kind] of lib.LIST_KINDS) {
        for (let i = 0; i < counts[kind]; i++) lists[kind][canton].push({ id: `${kind}${n++}`, day: `${ym}-15`, cantons: [canton] });
      }
    }
  }
  const codes = ["0106", "0107", "0107", "0101", "0151", "0109"];
  const sectors = ["realestate", "it", "consulting", "unclassified"];
  const debtors = [
    { debtor: "company", or731b: false },
    { debtor: "company", or731b: true },
    { debtor: "person", or731b: false },
    { debtor: "estate", or731b: false },
  ];
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
    for (const kind of ["kk02", "kk03"]) {
      for (const item of lists[kind][canton]) {
        if (item.day.slice(0, 7) !== month) continue;
        details.set(item.id, { subRubric: kind.toUpperCase(), uid: null, custom: false, ...debtors[k++ % debtors.length] });
      }
    }
  }
  return lib.buildSnapshot({ targetMonth: month, lists, details, fetchedAt: "2026-10-26T08:00:00.000Z" });
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
  assert.equal(d.sector, "hospitality");
  assert.equal(Object.keys(d).includes("name"), false, "no company name is kept");
});

test("sole proprietorship purpose is taken from the publication text (FR and DE)", () => {
  const fr = lib.parseHr01Xml(hr01Xml({ legalForm: "0101", text: "Exo - Dupont, à Carouge. Nouvelle entreprise individuelle. Titulaire: Dupont Jean. But: développement de logiciels sur mesure." }));
  assert.equal(fr.sector, "it");
  const de = lib.parseHr01Xml(hr01Xml({ legalForm: "0101", text: "Muster, in Brig. Neues Einzelunternehmen. Zweck: Betrieb eines Restaurants." }));
  assert.equal(de.sector, "hospitality");
});

test("sector: earliest keyword wins and boilerplate is ignored", () => {
  assert.equal(lib.classifySector("Prestations de conseil; travaux de construction."), "consulting");
  assert.equal(lib.classifySector("Construction et rénovation; conseil."), "realestate");
  assert.equal(lib.classifySector("L'exploitation d'un salon de coiffure. La société peut acquérir des immeubles et participer à des entreprises."), "health");
  assert.equal(lib.classifySector("La détention et la gestion de participations dans toutes sociétés."), "holding");
  assert.equal(lib.classifySector(""), "unclassified");
});

test("parseKkXml classifies debtors without keeping names", () => {
  assert.deepEqual(
    { ...lib.parseKkXml(kkXml({ type: "company", or731b: "Yes" })), uid: null },
    { subRubric: "KK03", debtor: "company", or731b: true, uid: null, custom: false },
  );
  assert.equal(lib.parseKkXml(kkXml({ type: "company", or731b: "No" })).or731b, false);
  assert.equal(lib.parseKkXml(kkXml({ type: "person", addition: "none" })).debtor, "person");
  assert.equal(lib.parseKkXml(kkXml({ type: "person", addition: "refusedLegacy" })).debtor, "estate");
  assert.equal(lib.parseKkXml(kkXml({ type: "person", addition: "legacy" })).debtor, "estate");
  const custom = lib.parseKkXml(kkXml({ type: "person", addition: "custom", custom: "Succession insolvable" }));
  assert.equal(custom.debtor, "estate");
  assert.equal(custom.custom, true);
  assert.equal(lib.parseKkXml(kkXml({ type: "person", addition: "custom" })).debtor, "person");
  const parsed = JSON.stringify(lib.parseKkXml(kkXml({ type: "person", addition: "none" })));
  for (const needle of ["Dupont", "Jean"]) assert.equal(parsed.includes(needle), false);
});

test("parseKkXml fails closed on unknown values", () => {
  assert.throws(() => lib.parseKkXml(kkXml({ type: "trust" })), /Unexpected debtor type/);
  assert.throws(() => lib.parseKkXml(kkXml({ type: "person", addition: "other" })), /Unexpected addition/);
  assert.throws(() => lib.parseKkXml(kkXml({ type: "company" })), /Unexpected or731b/);
});

test("month helpers", () => {
  assert.equal(lib.shiftMonth("2026-01", -1), "2025-12");
  assert.deepEqual(lib.monthRange("2024-02"), { start: "2024-02-01", end: "2024-02-29" });
  assert.equal(lib.reportMonths("2026-09")[0], "2024-10");
  assert.equal(lib.reportMonths("2026-09").length, 24);
  assert.throws(() => lib.assertMonth("2026-13"));
});

test("percent formatting keeps the direction of small changes", () => {
  assert.equal(render.fmtPct("en", 0.04), "+0.0%");
  assert.equal(render.fmtPct("en", -0.04), "−0.0%");
  assert.equal(render.fmtPct("en", 0), "±0.0%");
  assert.equal(render.fmtPct("en", null), "n/a");
});

// ---------- API fail-closed behaviour ----------

function fakeFetch(body) {
  return async () => ({ ok: true, status: 200, json: async () => body, text: async () => "" });
}

test("listPublications rejects items outside the requested filter (HR)", async () => {
  const base = { id: "a", cantons: ["GE"], publicationState: "PUBLISHED", publicationDate: "2026-09-10T00:00:00.000Z" };
  const { publicationState: _omit, ...noState } = base;
  const args = { subRubric: "HR01", canton: "GE", start: "2026-09-01", end: "2026-09-30" };
  const one = (meta) => fakeFetch({ total: 1, content: [{ meta }] });
  await assert.rejects(lib.listPublications({ ...args, fetchImpl: one({ ...base, subRubric: "HR02" }) }), /Filter leak/);
  await assert.rejects(lib.listPublications({ ...args, fetchImpl: one({ ...base, subRubric: "HR01", cantons: ["VD"] }) }), /Filter leak/);
  await assert.rejects(lib.listPublications({ ...args, fetchImpl: one({ ...noState, subRubric: "HR01" }) }), /Filter leak/);
  await assert.rejects(lib.listPublications({ ...args, fetchImpl: one({ ...base, subRubric: "HR01", publicationDate: "2026-08-31T00:00:00.000Z" }) }), /Filter leak/);
  await assert.rejects(
    lib.listPublications({ ...args, fetchImpl: fakeFetch({ total: 2, content: [{ meta: { ...base, subRubric: "HR01" } }] }) }),
    /Fetched 1 of 2/,
  );
  const ok = await lib.listPublications({ ...args, fetchImpl: one({ ...base, subRubric: "HR01" }) });
  assert.deepEqual([...ok], [{ id: "a", day: "2026-09-10", cantons: ["GE"] }]);
});

test("KK listing keeps cross-canton items and skips other months, still fail-closed", async () => {
  const base = { cantons: ["GE"], publicationState: "PUBLISHED", subRubric: "KK02" };
  const args = { subRubric: "KK02", canton: "GE", start: "2026-09-01", end: "2026-09-30" };
  const items = await lib.listPublications({
    ...args,
    fetchImpl: fakeFetch({
      total: 3,
      content: [
        { meta: { ...base, id: "a", publicationDate: "2026-09-10T00:00:00.000Z" } },
        { meta: { ...base, id: "b", cantons: ["FR"], publicationDate: "2026-09-11T00:00:00.000Z" } },
        { meta: { ...base, id: "c", publicationDate: "2026-08-29T00:00:00.000Z" } },
      ],
    }),
  });
  assert.deepEqual(items.map((x) => x.id), ["a", "b"]);
  assert.equal(items.skippedOutOfRange, 1);
  await assert.rejects(
    lib.listPublications({ ...args, fetchImpl: fakeFetch({ total: 1, content: [{ meta: { ...base, id: "x", subRubric: "KK03", publicationDate: "2026-09-10T00:00:00.000Z" } }] }) }),
    /Filter leak/,
  );
});

test("a cross-canton item must also be listed by its own canton", () => {
  const s = () => syntheticSnapshot();
  assert.doesNotThrow(s);
  const lists = { hr01: {}, hr03: {}, kk02: { GE: [{ id: "z", day: "2026-09-02", cantons: ["FR"] }], FR: [] }, kk03: {} };
  assert.throws(
    () => lib.buildSnapshot({ targetMonth: "2026-09", lists, details: new Map(), fetchedAt: "x" }),
    /missing from the FR list/,
  );
});

test("buildSnapshot fails when a detail is missing", () => {
  const lists = { hr01: { GE: [{ id: "a", day: "2026-09-02", cantons: ["GE"] }] }, hr03: {}, kk02: {}, kk03: {} };
  assert.throws(() => lib.buildSnapshot({ targetMonth: "2026-09", lists, details: new Map(), fetchedAt: "x" }), /Missing HR01 detail/);
  const kk = { hr01: {}, hr03: {}, kk02: { GE: [{ id: "b", day: "2026-09-02", cantons: ["GE"] }] }, kk03: {} };
  assert.throws(() => lib.buildSnapshot({ targetMonth: "2026-09", lists: kk, details: new Map(), fetchedAt: "x" }), /Missing KK02 detail/);
  const wrong = new Map([["b", { subRubric: "KK03", debtor: "person", or731b: false }]]);
  assert.throws(() => lib.buildSnapshot({ targetMonth: "2026-09", lists: kk, details: wrong, fetchedAt: "x" }), /expected KK02/);
});

test("multi-canton publications are counted once", () => {
  const lists = {
    hr01: { GE: [{ id: "a", day: "2026-09-02", cantons: ["GE", "VD"] }], VD: [{ id: "a", day: "2026-09-02", cantons: ["GE", "VD"] }] },
    hr03: {}, kk02: {}, kk03: {},
  };
  const details = new Map([["a", { subRubric: "HR01", legalForm: "0107", uid: "u", hasPurpose: true, sector: "it", seatTransferMention: false }]]);
  const s = lib.buildSnapshot({ targetMonth: "2026-09", lists, details, fetchedAt: "x" });
  assert.equal(s.monthly["2026-09"].hr01.GE, 1);
  assert.equal(s.monthly["2026-09"].hr01.VD, 0);
  assert.equal(s.quality.multiCantonPublications, 1);
});

// ---------- figures and rendering ----------

test("créations figures match the snapshot counts", () => {
  const s = syntheticSnapshot();
  const f = render.computeFigures(s);
  const ge = f.rows.find((r) => r.canton === "GE");
  assert.equal(ge.creations, s.monthly["2026-09"].hr01.GE);
  assert.equal(ge.prevCreations, s.monthly["2026-08"].hr01.GE);
  assert.equal(ge.yoyCreations, s.monthly["2025-09"].hr01.GE);
  assert.equal(ge.net, ge.creations - s.monthly["2026-09"].hr03.GE);
  assert.equal(ge.ytd, lib.monthsBetween("2026-01", "2026-09").reduce((a, m) => a + s.monthly[m].hr01.GE, 0));
  assert.equal(Object.values(f.total.legal).reduce((a, b) => a + b, 0), f.total.creations);
  assert.equal(f.trend.length, 13);
});

test("bankruptcy figures match the snapshot counts", () => {
  const s = syntheticSnapshot();
  const b = render.computeBankruptcyFigures(s);
  const ge = b.rows.find((r) => r.canton === "GE");
  const kk = (m) => s.monthly[m].kk02.GE + s.monthly[m].kk03.GE;
  assert.equal(ge.count, kk("2026-09"));
  assert.equal(ge.yoyCount, kk("2025-09"));
  assert.equal(ge.r12, lib.monthsBetween("2025-10", "2026-09").reduce((a, m) => a + kk(m), 0));
  assert.equal(ge.r12Prev, lib.monthsBetween("2024-10", "2025-09").reduce((a, m) => a + kk(m), 0));
  const d = ge.debtors;
  assert.equal(d.company + d.person + d.estate, ge.count);
  assert.ok(d.or731b <= d.company);
});

test("table rows carry the exact computed values", () => {
  const s = syntheticSnapshot();
  const f = render.computeFigures(s);
  const ge = f.rows.find((r) => r.canton === "GE");
  const cre = render.renderCreations("fr", s, { date: "2026-10-26" });
  const expected = `| Genève | ${ge.creations} | ${ge.prevCreations} | ${render.fmtPct("fr", ge.mom)} | ${ge.yoyCreations} | ${render.fmtPct("fr", ge.yoy)} | ${ge.deletions} | +${ge.net} |`;
  assert.ok(cre.content.includes(expected), `missing row: ${expected}`);
  const b = render.computeBankruptcyFigures(s).rows.find((r) => r.canton === "GE");
  const fal = render.renderFaillites("fr", s, { date: "2026-10-26" });
  const row = `| Genève | ${b.count} | ${b.prevCount} | ${b.yoyCount} | ${b.kk03} | ${b.r12} | ${b.r12Prev} | ${render.fmtPct("fr", b.r12Change)} |`;
  assert.ok(fal.content.includes(row), `missing row: ${row}`);
});

test("pages are deterministic, complete, evergreen and free of personal data", () => {
  const s = syntheticSnapshot();
  for (const [key, fn] of [["creations", render.renderCreations], ["faillites", render.renderFaillites]]) {
    for (const locale of render.LOCALES) {
      const a = fn(locale, s, { date: "2026-10-26" });
      assert.deepEqual(a, fn(locale, s, { date: "2026-10-26" }));
      assert.deepEqual(checkRendered(locale, a), []);
      assert.equal(a.slug, PAGES[key].slug);
      assert.equal(a.series, PAGES[key].series);
      assert.ok(DATA_REPORT_SERIES.includes(a.series));
      assert.equal(a.reportMonth, "2026-09");
      assert.equal(a.date, "2026-10-26");
      assert.ok(a.title.length <= 60, `${locale} ${key} title ${a.title.length} chars`);
      for (const needle of FAKE_NAMES) assert.equal(a.content.includes(needle), false);
      assert.ok(a.content.includes(PAGES[key].csvHistory));
      assert.ok(a.content.includes(PAGES[key].csvMonth("2026-09")));
      assert.ok(a.content.includes(`https://ark-fid.ch/${locale}/ressources/articles/${PAGES[key].slug}/`));
      const other = key === "creations" ? "faillites" : "creations";
      assert.ok(a.content.includes(`/ressources/articles/${PAGES[other].slug}`), "cross-link");
      assert.equal(a.content.includes(LEGACY_SLUG), false);
      for (const ref of a.references) {
        const domain = extractDomain(ref.url);
        assert.ok(ALLOWED_REFERENCE_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`)), domain);
        assert.equal(isBlockedDomain(ref.url), false, ref.url);
      }
    }
    assert.ok(countWords(fn("fr", s, { date: "2026-10-26" }).content) >= 700);
  }
  assert.deepEqual(render.LOCALES, ["fr", "en", "de"]);
  assert.throws(() => render.renderCreations("es", s, { date: "2026-10-26" }), /Unsupported locale/);
  assert.throws(() => render.renderFaillites("pt", s, { date: "2026-10-26" }), /Unsupported locale/);
});

test("highlights: one sentence per canton and locale, numbers from the aggregates", () => {
  const s = syntheticSnapshot();
  const h = render.renderHighlights(s);
  assert.deepEqual(Object.keys(h), ["fr", "en", "de"]);
  const b = render.computeBankruptcyFigures(s).rows.find((r) => r.canton === "GE");
  for (const locale of render.LOCALES) {
    assert.deepEqual(Object.keys(h[locale]), lib.CANTONS);
    assert.ok(h[locale].GE.includes(String(s.monthly["2026-09"].hr01.GE)));
    assert.ok(h[locale].GE.includes(render.fmtInt(locale, b.r12)));
  }
  assert.deepEqual(render.renderHighlights(s), h);
  assert.equal(lib.checksum({ ...s, highlights: h }), s.checksum);
});

test("CSVs hold aggregates only and the history keeps every month", () => {
  const s = syntheticSnapshot();
  for (const csv of [render.renderCsv(s), render.renderFaillitesCsv(s)]) {
    assert.equal(csv.trim().split("\n").length, 1 + lib.CANTONS.length + 1);
    for (const needle of FAKE_NAMES) assert.equal(csv.includes(needle), false);
  }
  const older = syntheticSnapshot("2026-08");
  const h = render.renderHistoryCsvs([s, older]);
  const lines = h.faillites.trim().split("\n");
  assert.equal(lines.length, 1 + 25 * lib.CANTONS.length); // 2024-09 .. 2026-09
  assert.ok(lines.some((l) => l.startsWith("2026-09,GE,") && !l.endsWith(",,,")), "breakdown for the report month");
  assert.ok(lines.some((l) => l.startsWith("2026-08,GE,") && !l.endsWith(",,,")), "breakdown kept from the older snapshot");
});

test("history drops a breakdown that no longer matches revised totals", () => {
  const older = syntheticSnapshot("2026-08");
  const newer = JSON.parse(JSON.stringify(syntheticSnapshot("2026-09")));
  newer.monthly["2026-08"].hr01.GE += 1; // later correction of August
  newer.monthly["2026-08"].kk03.VD += 1;
  const h = render.renderHistoryCsvs([newer, older]);
  const row = (csv, prefix) => csv.split("\n").find((l) => l.startsWith(prefix));
  assert.ok(row(h.creations, "2026-08,GE,").endsWith(",,,,,"), "GE legal forms blanked");
  assert.ok(!row(h.creations, "2026-08,VD,").endsWith(",,,,,"), "VD legal forms kept");
  assert.ok(row(h.faillites, "2026-08,VD,").endsWith(",,,,"), "VD debtors blanked");
  assert.ok(!row(h.faillites, "2026-08,GE,").endsWith(",,,,"), "GE debtors kept");
});

test("a snapshot edited by hand is rejected", () => {
  const s = syntheticSnapshot();
  assert.equal(verifySnapshot(s, "2026-09"), s);
  const edited = JSON.parse(JSON.stringify(s));
  edited.monthly["2026-09"].hr01.GE += 1;
  assert.throws(() => verifySnapshot(edited, "2026-09"), /checksum/);
});

test("per-month CSV is not rewritten when only the retrieval time changes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sogc-csv-"));
  const file = path.join(dir, "x.csv");
  const s = syntheticSnapshot();
  assert.equal(writeCsvIfDataChanged(file, render.renderCsv(s)), true);
  assert.equal(writeCsvIfDataChanged(file, render.renderCsv({ ...s, fetchedAt: "2030-01-01T00:00:00.000Z" })), false);
  const changed = JSON.parse(JSON.stringify(s));
  changed.monthly["2026-09"].hr01.GE += 1;
  assert.equal(writeCsvIfDataChanged(file, render.renderCsv(changed)), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("snapshot checksum ignores retrieval metadata only", () => {
  const a = syntheticSnapshot();
  assert.equal(lib.checksum({ ...a, fetchedAt: "2030-01-01T00:00:00.000Z" }), lib.checksum(a));
  const c = JSON.parse(JSON.stringify(a));
  c.monthly["2026-09"].kk03.GE += 1;
  assert.notEqual(lib.checksum(a), lib.checksum(c));
});

// ---------- article store integration ----------

test("upsertArticle keeps the first publication date and marks updates", () => {
  const s = syntheticSnapshot();
  const article = render.renderCreations("fr", s, { date: "2026-10-26" });
  const data = { Articles: [] };
  assert.equal(upsertArticle(data, article, "2026-10-26"), "added");
  assert.equal(upsertArticle(data, { ...article, date: "2026-11-03" }, "2026-11-03"), "unchanged");
  assert.equal(data.Articles[0].date, "2026-10-26");
  assert.equal(upsertArticle(data, { ...article, content: `${article.content}\n` }, "2026-11-03"), "updated");
  assert.equal(data.Articles[0].date, "2026-10-26");
  assert.equal(data.Articles[0].updated, "2026-11-03");
  assert.throws(() => upsertArticle({ Articles: [{ slug: article.slug, series: "other" }] }, article, "2026-11-03"), /outside the/);
  assert.throws(() => upsertArticle({ Articles: [{ slug: article.slug, title: "Editorial" }] }, article, "2026-11-03"), /outside the/);
});

test("migration removes only legacy monthly créations articles", () => {
  const data = {
    Articles: [
      { slug: LEGACY_SLUG, series: PAGES.creations.series },
      { slug: PAGES.creations.slug, series: PAGES.creations.series },
      { slug: "creations-entreprises-geneve-suisse-romande-octobre-2026", title: "editorial, no series" },
      { slug: "faillites-geneve-suisse-romande-septembre-2026", series: PAGES.faillites.series },
    ],
  };
  assert.deepEqual(removeLegacyMonthly(data), [LEGACY_SLUG]);
  assert.equal(data.Articles.length, 3);
  const es = { Articles: [{ slug: PAGES.faillites.slug, series: PAGES.faillites.series }, { slug: "x" }] };
  assert.equal(removeFromUnpublishedLocale(es), 1);
  assert.deepEqual(es.Articles.map((a) => a.slug), ["x"]);
});

test("only the reserved series are exempt from editorial guardrails and LLM refresh", () => {
  for (const series of DATA_REPORT_SERIES) assert.equal(isDataReportArticle({ series }), true);
  assert.equal(isDataReportArticle({ series: "anything-else" }), false);
  assert.equal(isDataReportArticle({}), false);
  assert.deepEqual(withoutDataReports([{ slug: "a" }, { slug: "b", series: PAGES.faillites.series }]).map((a) => a.slug), ["a"]);
  const now = new Date("2028-01-01T00:00:00Z");
  const state = { queue: [], failed: [] };
  assert.equal(pickStaleSlug([{ slug: "r", date: "2026-10-26", series: PAGES.creations.series }], state, now), null);
  assert.equal(pickStaleSlug([{ slug: "x", date: "2026-10-26", series: "other" }], state, now), "x");
});

test("legacy monthly URL redirects (301, fr/en/de only) to the evergreen page", async () => {
  const config = require(path.join(__dirname, "..", "next.config.js"));
  const rules = await config.redirects();
  for (const form of ["/", ""]) {
    const source = `/:locale(fr|en|de)/ressources/articles/${LEGACY_SLUG}${form}`;
    const matches = rules.filter((r) => r.source === source);
    assert.equal(matches.length, 1, source);
    assert.equal(matches[0].statusCode, 301);
    assert.equal(matches[0].destination, `/:locale/ressources/articles/${PAGES.creations.slug}/`);
  }
  const chained = rules.filter((r) => r.source.includes(`/ressources/articles/${PAGES.creations.slug}`));
  assert.equal(chained.length, 0, "evergreen page is not itself redirected");
  for (const locale of ["fr", "en", "de", "es", "pt"]) {
    const raw = fs.readFileSync(path.join(__dirname, "..", "src", "translations", locale, "ressources.json"), "utf8");
    assert.equal(raw.includes(LEGACY_SLUG), false, `${locale} still references the legacy slug`);
  }
});
