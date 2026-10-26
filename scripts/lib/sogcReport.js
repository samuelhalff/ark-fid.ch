"use strict";

/**
 * SOGC (FOSC/SHAB) monthly company-registration report: data layer.
 *
 * Fetches publications from the public SOGC API (amtsblattportal.ch, no auth),
 * parses the HR01 XML exports and builds an aggregate-only snapshot. Every
 * number published in the report is derived from this snapshot; no LLM is
 * involved anywhere in this pipeline.
 *
 * API facts verified with curl (2026-10-26):
 * - list: GET /api/v1/publications?publicationStates=PUBLISHED&subRubrics=HR01
 *   &cantons=GE&publicationDate.start=YYYY-MM-DD&publicationDate.end=YYYY-MM-DD
 *   &pageRequest.page=N&pageRequest.size=500 -> { content: [{ meta }], total }
 * - adding `rubrics=HR` next to `subRubrics` silently drops the sub-rubric
 *   filter, so only `subRubrics` is sent and every item is re-checked.
 * - detail: GET /api/v1/publications/{id}/xml -> HR01 export with
 *   <legalForm> (4-digit code), <purpose> (absent for sole proprietorships),
 *   <publicationText>.
 */

const API_BASE = "https://amtsblattportal.ch/api/v1";
const PORTAL_URL = "https://amtsblattportal.ch/";
const SERIES = "sogc-creations-romandie";
const SCHEMA_VERSION = 1;
const CLASSIFIER_VERSION = 1;
const CANTONS = Object.freeze(["GE", "VD", "VS", "NE", "FR", "JU"]);
const PAGE_SIZE = 2000;
const DETAIL_CONCURRENCY = 6;

// SOGC legal form codes (observed in HR01 exports: 0101, 0103, 0106, 0107,
// 0109, 0110, 0151; the others follow the same federal code list).
const LEGAL_FORM_BUCKET = Object.freeze({
  "0106": "sa", // société anonyme
  "0107": "sarl", // société à responsabilité limitée
  "0101": "ei", // entreprise individuelle (raison individuelle)
  "0151": "branch", // succursale d'une entreprise suisse
  "0111": "branch", // succursale d'une entreprise étrangère
  "0103": "other", // société en nom collectif
  "0104": "other", // société en commandite
  "0105": "other", // société en commandite par actions
  "0108": "other", // société coopérative
  "0109": "other", // association
  "0110": "other", // fondation
});
const LEGAL_FORM_KEYS = Object.freeze(["sa", "sarl", "ei", "branch", "other"]);

// Deterministic keyword buckets on the first part of the stated purpose.
// First match wins, in this order. Indicative only (not NOGA).
const SECTOR_RULES = Object.freeze([
  ["holding", /\b(holding|(detention|gestion|acquisition|administration)[^.;]{0,80}\bparticipations|participations dans (toutes|d'autres|des) (societes|entreprises)|beteiligungen an|halten von beteiligungen)\b/],
  ["trade", /\b(matieres premieres|commodities|negoce international|rohstoff\w*)\b/],
  ["finance", /\b(gestion de fortune|gestion d'actifs|gestion de patrimoine|asset management|wealth management|conseil financier|services financiers|fiduciaire|comptab\w*|assurances?|vermogensverwaltung|treuhand\w*|buchhaltung|finanzdienstleistung\w*|versicherung\w*)\b/],
  ["realestate", /\b(immobili\w*|construction|batiment|renovation\w*|genie civil|plomberie|chauffage|sanitaire|electricite|peinture|platrerie|menuiserie|charpente|maconnerie|carrelage|toiture|ferblanterie|etancheite|architecture|immobilien|liegenschaft\w*|bauunternehm\w*|baugewerbe|hochbau|tiefbau|malerei|gipserei|schreinerei|zimmerei|elektroinstallation\w*|sanitar\w*|architektur)\b/],
  ["it", /\b(informatiques?|logiciels?|numeriques?|digital\w*|sites? (web|internet)|applications? (mobiles?|web|digitales?|informatiques?)|intelligence artificielle|cybersecurite|software|informatik|it-dienstleistung\w*|webentwicklung|programmierung)\b/],
  ["transport", /\b(transports?|logistique|demenagements?|livraisons?|taxi|vtc|chauffeur|logistik|umzug\w*|kurier\w*)\b/],
  ["automotive", /\b(garage|automobiles?|vehicules?|carrosserie|fahrzeug\w*|autogarage|autowerkstatt)\b/],
  ["health", /\b(sante|medical\w*|medecine|cabinet (medical|dentaire)|therap\w*|physiotherap\w*|soins|pharma\w*|dentaire|esthetique|beaute|coiffure|coiffeur|bien-etre|massages?|fitness|osteopath\w*|psycholog\w*|optique|gesundheit\w*|arztpraxis|medizin\w*|pflege|kosmetik|massage)\b/],
  ["hospitality", /\b(restaurants?|restauration (rapide|collective|a l'emporter)|etablissements? publics?|cafes?|bar|brasserie|buvette|hotel\w*|hotellerie|traiteur|catering|boulangerie|patisserie|food truck|gastronom\w*|gastro\w*|backerei)\b/],
  ["education", /\b(formation|enseignement|ecole|cours|coaching\w*|evenementiel|evenements|culture|culturel\w*|musique|photographi\w*|audiovisuel\w*|ausbildung|weiterbildung\w*|schule|unterricht|kultur\w*|veranstaltung\w*|musik|foto\w*)\b/],
  ["trade", /\b(commerce|negoce|import|export|import-export|achat et (la )?vente|vente (en ligne|au detail)|distribution|e-commerce|boutique|trading|handel|vertrieb|verkauf|detailhandel|grosshandel)\b/],
  ["consulting", /\b(conseils?|consulting|consultance|services aux entreprises|marketing|communication|gestion de projets?|recrutement|beratung\w*|dienstleistungen im bereich)\b/],
]);
const SECTOR_KEYS = Object.freeze([...new Set(SECTOR_RULES.map(([k]) => k)), "unclassified"]);

// Mentions suggesting the entry follows a seat transfer from another canton.
const SEAT_TRANSFER_RE = /(transfert (de|du) (son )?siege|siege transfere|precedemment (a|au|en)|sitzverlegung|sitz (verlegt|bisher)|bisher in)\b/;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function assertMonth(ym) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(ym))) {
    throw new Error(`Invalid month "${ym}" (expected YYYY-MM)`);
  }
  return String(ym);
}

function shiftMonth(ym, delta) {
  assertMonth(ym);
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
}

function monthRange(ym) {
  assertMonth(ym);
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${ym}-01`, end: `${ym}-${pad2(last)}` };
}

/** Months from `from` to `to` inclusive (YYYY-MM). */
function monthsBetween(from, to) {
  const out = [];
  for (let cur = assertMonth(from); cur <= assertMonth(to); cur = shiftMonth(cur, 1)) {
    out.push(cur);
    if (out.length > 600) throw new Error("month range too large");
  }
  return out;
}

/** Months fetched for a report: January of the previous year up to the target month. */
function reportMonths(targetMonth) {
  const year = Number(assertMonth(targetMonth).slice(0, 4));
  return monthsBetween(`${year - 1}-01`, targetMonth);
}

function normalizeText(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlEntities(s) {
  return String(s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlTag(xml, tag) {
  const m = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return m ? decodeXmlEntities(m[1]).trim() : null;
}

/** Purpose text: <purpose>, else the "But:/Zweck:" part of the publication text. */
function extractPurpose(xml) {
  const purpose = xmlTag(xml, "purpose");
  if (purpose) return purpose;
  const text = xmlTag(xml, "publicationText") || "";
  const m = /\b(?:But|Zweck|Scopo)\s*:\s*([\s\S]*)$/.exec(text);
  return m ? m[1].trim() : "";
}

/** Core of the purpose, before the usual "may also..." boilerplate. */
function purposeCore(purpose) {
  let s = normalizeText(purpose);
  const cut = s.search(/(\. |; )(la societe|l'association|la fondation|la cooperative|elle|die gesellschaft|der verein|die stiftung|sie) (peut|pourra|kann)\b/);
  if (cut > 0) s = s.slice(0, cut);
  return s.slice(0, 400);
}

function classifySector(purpose) {
  const core = purposeCore(purpose);
  if (!core) return "unclassified";
  // The main activity is usually stated first: the earliest keyword wins,
  // ties go to the rule listed first.
  let best = null;
  for (const [key, re] of SECTOR_RULES) {
    const m = re.exec(core);
    if (m && (best === null || m.index < best.index)) best = { key, index: m.index };
  }
  return best ? best.key : "unclassified";
}

function legalFormBucket(code) {
  return LEGAL_FORM_BUCKET[code] || "other";
}

/** Parse one HR01 XML export into the minimal fields the report needs (no names). */
function parseHr01Xml(xml) {
  const subRubric = xmlTag(xml, "subRubric");
  const legalForm = xmlTag(xml, "legalForm");
  const text = xmlTag(xml, "publicationText") || "";
  const purpose = extractPurpose(xml);
  return {
    subRubric,
    legalForm,
    uid: xmlTag(xml, "uid"),
    hasPurpose: Boolean(purpose),
    sector: classifySector(purpose),
    seatTransferMention: SEAT_TRANSFER_RE.test(normalizeText(text)),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, { fetchImpl = globalThis.fetch, retries = 4, as = "json", timeoutMs = 30000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(url, {
        headers: { Accept: as === "json" ? "application/json" : "application/xml" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${url}`);
        err.fatal = true;
        throw err;
      }
      return as === "json" ? await res.json() : await res.text();
    } catch (error) {
      if (error.fatal) throw error;
      lastError = error;
      if (attempt < retries) await sleep(1000 * 2 ** attempt);
    }
  }
  throw new Error(`Request failed after ${retries + 1} attempts: ${url} (${lastError?.message || lastError})`);
}

function listUrl({ subRubric, canton, start, end }) {
  const q = new URLSearchParams({
    publicationStates: "PUBLISHED",
    subRubrics: subRubric,
    cantons: canton,
    "publicationDate.start": start,
    "publicationDate.end": end,
    "pageRequest.page": "0",
    "pageRequest.size": String(PAGE_SIZE),
  });
  return `${API_BASE}/publications?${q.toString()}`;
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * All publication metas of one sub-rubric/canton/date range. The API has no
 * stable sort, so paging can repeat or skip items: each request must fit in a
 * single page, and ranges that do not fit are split in two. Fails closed when
 * the API returns anything outside the requested filter or fewer items than
 * its own `total`.
 */
async function listPublications({ subRubric, canton, start, end, fetchImpl }) {
  const body = await fetchWithRetry(listUrl({ subRubric, canton, start, end }), { fetchImpl });
  if (!body || !Array.isArray(body.content) || typeof body.total !== "number") {
    throw new Error(`Unexpected list response for ${subRubric}/${canton} ${start}..${end}`);
  }
  if (body.total > PAGE_SIZE) {
    if (start === end) throw new Error(`More than ${PAGE_SIZE} items on ${start} for ${subRubric}/${canton}`);
    const span = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
    const mid = addDays(start, Math.floor(span / 2));
    const left = await listPublications({ subRubric, canton, start, end: mid, fetchImpl });
    const right = await listPublications({ subRubric, canton, start: addDays(mid, 1), end, fetchImpl });
    const ids = new Set(left.map((x) => x.id));
    for (const x of right) {
      if (ids.has(x.id)) throw new Error(`Duplicate id ${x.id} across ${subRubric}/${canton} ranges`);
    }
    return [...left, ...right];
  }
  const items = [];
  const seen = new Set();
  for (const entry of body.content) {
    const meta = entry && entry.meta;
    if (!meta || !meta.id) throw new Error("List item without meta.id");
    if (meta.subRubric !== subRubric) throw new Error(`Filter leak: got ${meta.subRubric} for ${subRubric} (${meta.id})`);
    if (!Array.isArray(meta.cantons) || !meta.cantons.includes(canton)) {
      throw new Error(`Filter leak: ${meta.id} not in canton ${canton}`);
    }
    if (meta.publicationState && meta.publicationState !== "PUBLISHED") {
      throw new Error(`Filter leak: ${meta.id} state ${meta.publicationState}`);
    }
    const day = String(meta.publicationDate || "").slice(0, 10);
    if (!(day >= start && day <= end)) throw new Error(`Filter leak: ${meta.id} dated ${day} outside ${start}..${end}`);
    if (seen.has(meta.id)) throw new Error(`Duplicate id ${meta.id} in ${subRubric}/${canton}`);
    seen.add(meta.id);
    items.push({ id: meta.id, day, cantons: meta.cantons.slice() });
  }
  if (items.length !== body.total) {
    throw new Error(`Fetched ${items.length} of ${body.total} items for ${subRubric}/${canton} ${start}..${end}`);
  }
  return items;
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function emptyCounts(keys) {
  return Object.fromEntries(keys.map((k) => [k, 0]));
}

/**
 * Builds the aggregate-only snapshot. Each publication is attributed to the
 * first canton of CANTONS it lists (in practice one canton per publication);
 * the number of multi-canton publications is recorded.
 */
function buildSnapshot({ targetMonth, lists, details, fetchedAt, publishedOn }) {
  const months = reportMonths(targetMonth);
  const monthly = {};
  for (const ym of months) {
    monthly[ym] = { hr01: emptyCounts(CANTONS), hr03: emptyCounts(CANTONS) };
  }
  const quality = {
    hr01Publications: 0,
    hr03Publications: 0,
    multiCantonPublications: 0,
    detailsParsed: 0,
    uidDuplicates: 0,
    seatTransferMentions: 0,
    missingPurpose: 0,
    unmappedLegalFormCodes: 0,
  };
  const assigned = new Map(); // id -> { canton, day, kind }
  for (const kind of ["hr01", "hr03"]) {
    for (const canton of CANTONS) {
      for (const item of lists[kind][canton] || []) {
        const owner = CANTONS.find((c) => item.cantons.includes(c));
        if (owner !== canton) continue; // counted under its first canton
        if (assigned.has(item.id)) continue;
        assigned.set(item.id, { canton, day: item.day, kind });
        if (item.cantons.length > 1) quality.multiCantonPublications++;
        const ym = item.day.slice(0, 7);
        if (!monthly[ym]) throw new Error(`Item ${item.id} outside report months (${item.day})`);
        monthly[ym][kind][canton]++;
        quality[kind === "hr01" ? "hr01Publications" : "hr03Publications"]++;
      }
    }
  }

  const legalForms = Object.fromEntries(CANTONS.map((c) => [c, emptyCounts(LEGAL_FORM_KEYS)]));
  const legalFormCodes = {};
  const sectors = emptyCounts(SECTOR_KEYS);
  const uids = new Set();
  const targetIds = [];
  for (const [id, { canton, day, kind }] of assigned) {
    if (kind === "hr01" && day.slice(0, 7) === targetMonth) targetIds.push([id, canton]);
  }
  for (const [id, canton] of targetIds) {
    const d = details.get(id);
    if (!d) throw new Error(`Missing HR01 detail for ${id}`);
    if (d.subRubric !== "HR01") throw new Error(`Detail ${id} is ${d.subRubric}, expected HR01`);
    quality.detailsParsed++;
    const code = d.legalForm || "none";
    legalFormCodes[code] = (legalFormCodes[code] || 0) + 1;
    if (!LEGAL_FORM_BUCKET[code]) quality.unmappedLegalFormCodes++;
    legalForms[canton][legalFormBucket(code)]++;
    sectors[d.sector]++;
    if (!d.hasPurpose) quality.missingPurpose++;
    if (d.seatTransferMention) quality.seatTransferMentions++;
    if (d.uid) {
      if (uids.has(d.uid)) quality.uidDuplicates++;
      uids.add(d.uid);
    }
  }
  const targetTotal = CANTONS.reduce((s, c) => s + monthly[targetMonth].hr01[c], 0);
  if (quality.detailsParsed !== targetTotal) {
    throw new Error(`Parsed ${quality.detailsParsed} details but counted ${targetTotal} HR01 publications`);
  }

  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    classifierVersion: CLASSIFIER_VERSION,
    series: SERIES,
    reportMonth: targetMonth,
    publishedOn,
    fetchedAt,
    source: {
      name: "Feuille officielle suisse du commerce (FOSC/SOGC/SHAB)",
      api: `${API_BASE}/publications`,
      creations: "subRubrics=HR01 (nouvelles inscriptions)",
      deletions: "subRubrics=HR03 (radiations)",
      dateBasis: "publicationDate (FOSC)",
      cantons: CANTONS,
    },
    monthly,
    target: { legalForms, legalFormCodes: sortKeys(legalFormCodes), sectors },
    sectorOrder: SECTOR_KEYS,
    quality,
  };
  snapshot.checksum = checksum(snapshot);
  return snapshot;
}

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

function checksum(snapshot) {
  const { checksum: _ignored, fetchedAt: _f, publishedOn: _p, ...rest } = snapshot;
  return require("crypto").createHash("sha256").update(JSON.stringify(rest)).digest("hex").slice(0, 16);
}

/** Fetches everything a report needs and returns the snapshot. */
async function collectSnapshot({ targetMonth, fetchImpl, publishedOn, now = new Date(), log = () => {} }) {
  const months = reportMonths(targetMonth);
  const start = monthRange(months[0]).start;
  const end = monthRange(targetMonth).end;
  if (end >= now.toISOString().slice(0, 10)) {
    throw new Error(`Month ${targetMonth} is not complete yet (ends ${end})`);
  }
  const lists = { hr01: {}, hr03: {} };
  for (const [kind, subRubric] of [["hr01", "HR01"], ["hr03", "HR03"]]) {
    for (const canton of CANTONS) {
      lists[kind][canton] = await listPublications({ subRubric, canton, start, end, fetchImpl });
      log(`${subRubric} ${canton} ${start}..${end}: ${lists[kind][canton].length}`);
    }
  }
  const targetIds = new Set();
  for (const canton of CANTONS) {
    for (const item of lists.hr01[canton]) {
      if (item.day.slice(0, 7) === targetMonth) targetIds.add(item.id);
    }
  }
  log(`Fetching ${targetIds.size} HR01 details for ${targetMonth}`);
  const ids = [...targetIds];
  const parsed = await mapPool(ids, DETAIL_CONCURRENCY, async (id) => {
    const xml = await fetchWithRetry(`${API_BASE}/publications/${id}/xml`, { fetchImpl, as: "text" });
    return parseHr01Xml(xml);
  });
  const details = new Map(ids.map((id, i) => [id, parsed[i]]));
  return buildSnapshot({
    targetMonth,
    lists,
    details,
    fetchedAt: now.toISOString(),
    publishedOn,
  });
}

module.exports = {
  API_BASE,
  PORTAL_URL,
  SERIES,
  CANTONS,
  CLASSIFIER_VERSION,
  LEGAL_FORM_KEYS,
  SECTOR_KEYS,
  SECTOR_RULES,
  assertMonth,
  shiftMonth,
  monthRange,
  monthsBetween,
  reportMonths,
  normalizeText,
  decodeXmlEntities,
  extractPurpose,
  purposeCore,
  classifySector,
  legalFormBucket,
  parseHr01Xml,
  listPublications,
  buildSnapshot,
  collectSnapshot,
  checksum,
};
