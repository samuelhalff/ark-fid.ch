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
const SCHEMA_VERSION = 2;
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

/**
 * Months fetched for a report: 24 months up to the target month (rolling twelve
 * months and the twelve before; this also covers January of the previous year).
 */
function reportMonths(targetMonth) {
  return monthsBetween(shiftMonth(assertMonth(targetMonth), -23), targetMonth);
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

/**
 * Parse a KK02/KK03 (bankruptcy) XML export: debtor category only, never names.
 * company: <debtor><selectType>company</selectType> (with <or731b>Yes|No</or731b>);
 * person: natural person, or estate when <addition> is legacy/refusedLegacy.
 */
function parseKkXml(xml) {
  const subRubric = xmlTag(xml, "subRubric");
  const m = /<debtor>\s*<selectType>([^<]*)<\/selectType>/.exec(xml);
  const type = m ? m[1].trim() : "";
  // Fail closed: any value outside the verified vocabulary aborts the run.
  if (type === "company") {
    const or731b = xmlTag(xml, "or731b");
    if (or731b !== "Yes" && or731b !== "No") throw new Error(`Unexpected or731b value "${or731b}" in ${subRubric} company debtor`);
    return { subRubric, debtor: "company", or731b: or731b === "Yes", uid: xmlTag(xml, "uid"), custom: false };
  }
  if (type === "person") {
    // Schema enumeration (KK02/KK03 export 1.26): none | legacy | refusedLegacy | custom.
    const addition = xmlTag(xml, "addition");
    if (addition === "none") return { subRubric, debtor: "person", or731b: false, uid: null, custom: false };
    if (addition === "legacy" || addition === "refusedLegacy") {
      return { subRubric, debtor: "estate", or731b: false, uid: null, custom: false };
    }
    if (addition === "custom") {
      // Free text, e.g. "Succession insolvable" (Neuchâtel): an estate when the
      // text says so, otherwise counted as an individual.
      const text = normalizeText(xmlTag(xml, "additionCustom") || "");
      const estate = /\b(succession|hoirie|nachlass|erbschaft|eredita|successione)\b/.test(text);
      return { subRubric, debtor: estate ? "estate" : "person", or731b: false, uid: null, custom: true };
    }
    throw new Error(`Unexpected addition value "${addition}" in ${subRubric} person debtor`);
  }
  throw new Error(`Unexpected debtor type "${type}" in ${subRubric} publication`);
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
 *
 * Bankruptcy rubric (KK*, `lenient`): the API's canton and date filters also
 * match a publication's other cantonal data (observed: a Fribourg KK02 returned
 * for cantons=GE, a KK02 of 29 Aug returned for a range starting 1 Sep). Such
 * items are returned as a superset: the caller queries one calendar month at a
 * time, keeps only items whose own publicationDate is in range (counted in
 * `skippedOutOfRange`) and attributes each item to its own canton.
 */
async function listPublications({ subRubric, canton, start, end, fetchImpl, lenient = subRubric.startsWith("KK") }) {
  const body = await fetchWithRetry(listUrl({ subRubric, canton, start, end }), { fetchImpl });
  if (!body || !Array.isArray(body.content) || typeof body.total !== "number") {
    throw new Error(`Unexpected list response for ${subRubric}/${canton} ${start}..${end}`);
  }
  if (body.total > PAGE_SIZE) {
    if (lenient || start === end) throw new Error(`More than ${PAGE_SIZE} items for ${subRubric}/${canton} ${start}..${end}`);
    const span = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
    const mid = addDays(start, Math.floor(span / 2));
    const left = await listPublications({ subRubric, canton, start, end: mid, fetchImpl });
    const right = await listPublications({ subRubric, canton, start: addDays(mid, 1), end, fetchImpl });
    if (left.length + right.length !== body.total) {
      throw new Error(`Split ranges returned ${left.length + right.length} of ${body.total} items for ${subRubric}/${canton} ${start}..${end}`);
    }
    const ids = new Set(left.map((x) => x.id));
    for (const x of right) {
      if (ids.has(x.id)) throw new Error(`Duplicate id ${x.id} across ${subRubric}/${canton} ranges`);
    }
    return [...left, ...right];
  }
  if (body.content.length !== body.total) {
    throw new Error(`Fetched ${body.content.length} of ${body.total} items for ${subRubric}/${canton} ${start}..${end}`);
  }
  const items = [];
  const seen = new Set();
  let skippedOutOfRange = 0;
  for (const entry of body.content) {
    const meta = entry && entry.meta;
    if (!meta || !meta.id) throw new Error("List item without meta.id");
    if (meta.subRubric !== subRubric) throw new Error(`Filter leak: got ${meta.subRubric} for ${subRubric} (${meta.id})`);
    if (!Array.isArray(meta.cantons) || meta.cantons.length === 0) {
      throw new Error(`Filter leak: ${meta.id} has no canton`);
    }
    if (!lenient && !meta.cantons.includes(canton)) {
      throw new Error(`Filter leak: ${meta.id} not in canton ${canton}`);
    }
    if (meta.publicationState !== "PUBLISHED") {
      throw new Error(`Filter leak: ${meta.id} state ${meta.publicationState}`);
    }
    if (seen.has(meta.id)) throw new Error(`Duplicate id ${meta.id} in ${subRubric}/${canton}`);
    seen.add(meta.id);
    const day = String(meta.publicationDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Publication ${meta.id} has no publication date`);
    if (!(day >= start && day <= end)) {
      if (!lenient) throw new Error(`Filter leak: ${meta.id} dated ${day} outside ${start}..${end}`);
      skippedOutOfRange++;
      continue;
    }
    items.push({ id: meta.id, day, cantons: meta.cantons.slice() });
  }
  items.skippedOutOfRange = skippedOutOfRange;
  return items;
}

/** Lenient (KK) listing over a multi-month range: one query per calendar month. */
async function listPublicationsByMonth({ subRubric, canton, months, fetchImpl }) {
  const out = [];
  const ids = new Set();
  let skipped = 0;
  for (const ym of months) {
    const { start, end } = monthRange(ym);
    const items = await listPublications({ subRubric, canton, start, end, fetchImpl, lenient: true });
    skipped += items.skippedOutOfRange || 0;
    for (const x of items) {
      if (ids.has(x.id)) throw new Error(`Duplicate id ${x.id} across ${subRubric}/${canton} months`);
      ids.add(x.id);
      out.push(x);
    }
  }
  out.skippedOutOfRange = skipped;
  return out;
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

/** Kinds of list counts kept per month. */
const LIST_KINDS = Object.freeze([
  ["hr01", "HR01"],
  ["hr03", "HR03"],
  ["kk02", "KK02"],
  ["kk03", "KK03"],
]);
const DEBTOR_KEYS = Object.freeze(["company", "person", "estate"]);

/**
 * Builds the aggregate-only snapshot. Each publication is attributed to the
 * first canton in CANTONS order (GE, VD, VS, NE, FR, JU) that it lists;
 * the number of multi-canton publications is recorded.
 */
function buildSnapshot({ targetMonth, lists, details, fetchedAt }) {
  const months = reportMonths(targetMonth);
  const monthly = {};
  for (const ym of months) {
    monthly[ym] = Object.fromEntries(LIST_KINDS.map(([kind]) => [kind, emptyCounts(CANTONS)]));
  }
  const quality = {
    hr01Publications: 0,
    hr03Publications: 0,
    kk02Publications: 0,
    kk03Publications: 0,
    multiCantonPublications: 0,
    crossCantonListItems: 0,
    detailsParsed: 0,
    uidDuplicates: 0,
    seatTransferMentions: 0,
    missingPurpose: 0,
    unmappedLegalFormCodes: 0,
    bankruptcyDetailsParsed: 0,
    bankruptcyCompanyUidDuplicates: 0,
    bankruptcyFreeTextQualifications: 0,
  };
  const assigned = new Map(); // id -> { canton, day, kind }
  const listed = Object.fromEntries(
    LIST_KINDS.map(([kind]) => [
      kind,
      Object.fromEntries(CANTONS.map((c) => [c, new Set(((lists[kind] && lists[kind][c]) || []).map((x) => x.id))])),
    ]),
  );
  for (const [kind] of LIST_KINDS) {
    for (const canton of CANTONS) {
      for (const item of (lists[kind] && lists[kind][canton]) || []) {
        const owner = CANTONS.find((c) => item.cantons.includes(c));
        if (!item.cantons.includes(canton)) {
          quality.crossCantonListItems++;
          // Returned for another canton: it must be counted by its own canton's list.
          if (owner && !listed[kind][owner].has(item.id)) {
            throw new Error(`${item.id} (${item.cantons.join("/")}) returned for ${canton} but missing from the ${owner} list`);
          }
          continue;
        }
        if (owner !== canton) continue; // counted under its first canton
        const prior = assigned.get(item.id);
        if (prior) {
          if (prior.kind !== kind) throw new Error(`Publication ${item.id} listed as ${prior.kind} and ${kind}`);
          continue;
        }
        assigned.set(item.id, { canton, day: item.day, kind });
        if (item.cantons.length > 1) quality.multiCantonPublications++;
        const ym = item.day.slice(0, 7);
        if (!monthly[ym]) throw new Error(`Item ${item.id} outside report months (${item.day})`);
        monthly[ym][kind][canton]++;
        quality[`${kind}Publications`]++;
      }
    }
  }

  const legalForms = Object.fromEntries(CANTONS.map((c) => [c, emptyCounts(LEGAL_FORM_KEYS)]));
  const legalFormCodes = {};
  const sectors = emptyCounts(SECTOR_KEYS);
  const debtors = Object.fromEntries(CANTONS.map((c) => [c, { ...emptyCounts(DEBTOR_KEYS), or731b: 0 }]));
  const uids = new Set();
  const kkUids = new Set();
  for (const [id, { canton, day, kind }] of assigned) {
    if (day.slice(0, 7) !== targetMonth) continue;
    if (kind === "hr01") {
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
    } else if (kind === "kk02" || kind === "kk03") {
      const d = details.get(id);
      const expected = kind.toUpperCase();
      if (!d) throw new Error(`Missing ${expected} detail for ${id}`);
      if (d.subRubric !== expected) throw new Error(`Detail ${id} is ${d.subRubric}, expected ${expected}`);
      quality.bankruptcyDetailsParsed++;
      if (d.custom) quality.bankruptcyFreeTextQualifications++;
      if (!DEBTOR_KEYS.includes(d.debtor)) throw new Error(`Unexpected debtor category ${d.debtor} for ${id}`);
      debtors[canton][d.debtor]++;
      if (d.or731b) {
        if (d.debtor !== "company") throw new Error(`art. 731b flag on a non-company debtor (${id})`);
        debtors[canton].or731b++;
      }
      if (d.uid) {
        if (kkUids.has(d.uid)) quality.bankruptcyCompanyUidDuplicates++;
        kkUids.add(d.uid);
      }
    }
  }
  const sumKind = (kind) => CANTONS.reduce((s, c) => s + monthly[targetMonth][kind][c], 0);
  if (quality.detailsParsed !== sumKind("hr01")) {
    throw new Error(`Parsed ${quality.detailsParsed} details but counted ${sumKind("hr01")} HR01 publications`);
  }
  for (const c of CANTONS) {
    const d = debtors[c];
    const expected = monthly[targetMonth].kk02[c] + monthly[targetMonth].kk03[c];
    if (d.company + d.person + d.estate !== expected || d.or731b > d.company) {
      throw new Error(`Bankruptcy debtor split for ${c} does not reconcile with ${expected} KK02/KK03 publications`);
    }
  }
  const kkTotal = sumKind("kk02") + sumKind("kk03");
  if (quality.bankruptcyDetailsParsed !== kkTotal) {
    throw new Error(`Parsed ${quality.bankruptcyDetailsParsed} bankruptcy details but counted ${kkTotal} KK02/KK03 publications`);
  }

  const snapshot = {
    schemaVersion: SCHEMA_VERSION,
    classifierVersion: CLASSIFIER_VERSION,
    reportMonth: targetMonth,
    fetchedAt,
    source: {
      name: "Feuille officielle suisse du commerce (FOSC/SOGC/SHAB)",
      api: `${API_BASE}/publications`,
      creations: "subRubrics=HR01 (nouvelles inscriptions)",
      deletions: "subRubrics=HR03 (radiations)",
      bankruptcies: "subRubrics=KK02 (publication de faillite) + KK03 (suspension faute d'actif)",
      dateBasis: "publicationDate (FOSC)",
      cantons: CANTONS,
    },
    monthly,
    target: { legalForms, legalFormCodes: sortKeys(legalFormCodes), sectors, debtors },
    sectorOrder: SECTOR_KEYS,
    quality,
  };
  snapshot.checksum = checksum(snapshot);
  return snapshot;
}

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

/** Checksum of the aggregates only (retrieval time and derived text excluded). */
function checksum(snapshot) {
  const { checksum: _c, fetchedAt: _f, publishedOn: _p, highlights: _h, ...rest } = snapshot;
  return require("crypto").createHash("sha256").update(JSON.stringify(rest)).digest("hex").slice(0, 16);
}

async function fetchDetails(ids, parse, fetchImpl) {
  const parsed = await mapPool(ids, DETAIL_CONCURRENCY, async (id) => {
    const xml = await fetchWithRetry(`${API_BASE}/publications/${id}/xml`, { fetchImpl, as: "text" });
    return parse(xml);
  });
  return ids.map((id, i) => [id, parsed[i]]);
}

/** Fetches everything a report needs and returns the snapshot. */
async function collectSnapshot({ targetMonth, fetchImpl, now = new Date(), log = () => {} }) {
  const months = reportMonths(targetMonth);
  const start = monthRange(months[0]).start;
  const end = monthRange(targetMonth).end;
  if (end >= now.toISOString().slice(0, 10)) {
    throw new Error(`Month ${targetMonth} is not complete yet (ends ${end})`);
  }
  const lists = {};
  let skippedOutOfRange = 0;
  for (const [kind, subRubric] of LIST_KINDS) {
    lists[kind] = {};
    for (const canton of CANTONS) {
      lists[kind][canton] = subRubric.startsWith("KK")
        ? await listPublicationsByMonth({ subRubric, canton, months, fetchImpl })
        : await listPublications({ subRubric, canton, start, end, fetchImpl });
      skippedOutOfRange += lists[kind][canton].skippedOutOfRange || 0;
      log(`${subRubric} ${canton} ${start}..${end}: ${lists[kind][canton].length}`);
    }
  }
  const targetIds = (kind) => {
    const ids = new Set();
    for (const canton of CANTONS) {
      for (const item of lists[kind][canton]) if (item.day.slice(0, 7) === targetMonth) ids.add(item.id);
    }
    return [...ids];
  };
  const hr01Ids = targetIds("hr01");
  const kkIds = [...new Set([...targetIds("kk02"), ...targetIds("kk03")])];
  log(`Fetching ${hr01Ids.length} HR01 and ${kkIds.length} KK02/KK03 details for ${targetMonth}`);
  const details = new Map([
    ...(await fetchDetails(hr01Ids, parseHr01Xml, fetchImpl)),
    ...(await fetchDetails(kkIds, parseKkXml, fetchImpl)),
  ]);
  const snapshot = buildSnapshot({ targetMonth, lists, details, fetchedAt: now.toISOString() });
  snapshot.quality.kkOutOfRangeListItems = skippedOutOfRange;
  snapshot.checksum = checksum(snapshot);
  return snapshot;
}

module.exports = {
  API_BASE,
  PORTAL_URL,
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
  parseKkXml,
  DEBTOR_KEYS,
  LIST_KINDS,
  listPublications,
  listPublicationsByMonth,
  buildSnapshot,
  collectSnapshot,
  checksum,
};
