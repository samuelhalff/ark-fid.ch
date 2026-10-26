"use strict";

/**
 * SOGC monthly statistics: deterministic rendering of the evergreen pages
 * (créations, faillites) in fr/en/de, CSVs and per-canton highlights.
 * Pure functions of the snapshot. Every figure is computed here from the
 * snapshot counts; the prose is fixed template text per locale.
 */

const { CANTONS, LEGAL_FORM_KEYS, PORTAL_URL, shiftMonth, monthsBetween } = require("./sogcReport");
const { DATA_REPORT_LOCALES } = require("./articleTopicGuardrails");

const SITE = "https://ark-fid.ch";
// Published locales (owner decision 2026-10-26: fr, en, de only).
const LOCALES = DATA_REPORT_LOCALES;
const INTL_LOCALE = { fr: "fr-CH", en: "en-GB", de: "de-CH" };
const CSV_DIR = "assets/data/sogc";

// Evergreen pages: one stable URL per statistic, updated in place every month.
const PAGES = Object.freeze({
  creations: Object.freeze({
    slug: "creations-entreprises-geneve-suisse-romande-statistiques",
    series: "sogc-creations-romandie",
    csvHistory: `/${CSV_DIR}/creations-entreprises-suisse-romande.csv`,
    csvMonth: (ym) => `/${CSV_DIR}/creations-entreprises-suisse-romande-${ym}.csv`,
  }),
  faillites: Object.freeze({
    slug: "faillites-geneve-suisse-romande-statistiques",
    series: "sogc-faillites-romandie",
    csvHistory: `/${CSV_DIR}/faillites-suisse-romande.csv`,
    csvMonth: (ym) => `/${CSV_DIR}/faillites-suisse-romande-${ym}.csv`,
  }),
});
// Monthly URLs used before the evergreen pages (redirected to PAGES.creations).
const LEGACY_MONTHLY_SLUG_RE = /^creations-entreprises-geneve-suisse-romande-[a-z]+-\d{4}$/;

const CANTON_NAMES = {
  fr: { GE: "Genève", VD: "Vaud", VS: "Valais", NE: "Neuchâtel", FR: "Fribourg", JU: "Jura" },
  en: { GE: "Geneva", VD: "Vaud", VS: "Valais", NE: "Neuchâtel", FR: "Fribourg", JU: "Jura" },
  de: { GE: "Genf", VD: "Waadt", VS: "Wallis", NE: "Neuenburg", FR: "Freiburg", JU: "Jura" },
};

const LEGAL_FORM_LABELS = {
  fr: { sa: "SA", sarl: "Sàrl", ei: "Raison individuelle", branch: "Succursales", other: "Autres formes" },
  en: { sa: "SA (company limited by shares)", sarl: "Sàrl (LLC)", ei: "Sole proprietorship", branch: "Branches", other: "Other forms" },
  de: { sa: "AG", sarl: "GmbH", ei: "Einzelunternehmen", branch: "Zweigniederlassungen", other: "Andere Rechtsformen" },
};

// Legal form as a noun phrase with its article, for running text.
const LEGAL_FORM_NOUNS = {
  fr: { sa: "la SA", sarl: "la Sàrl", ei: "la raison individuelle", branch: "la succursale", other: "une autre forme" },
  en: { sa: "the SA", sarl: "the Sàrl", ei: "the sole proprietorship", branch: "the branch", other: "another form" },
  de: { sa: "die AG", sarl: "die GmbH", ei: "das Einzelunternehmen", branch: "die Zweigniederlassung", other: "eine andere Rechtsform" },
};

const SECTOR_LABELS = {
  fr: {
    holding: "Holdings et participations", trade: "Commerce et négoce", finance: "Finance, fiduciaire et assurance",
    realestate: "Immobilier et construction", it: "Informatique et numérique", transport: "Transport et logistique",
    automotive: "Automobile et garages", health: "Santé, beauté et bien-être", hospitality: "Restauration et hôtellerie",
    education: "Formation, culture et événementiel", consulting: "Conseil et services aux entreprises", unclassified: "Non classé",
  },
  en: {
    holding: "Holdings and participations", trade: "Trade and commodities", finance: "Finance, fiduciary and insurance",
    realestate: "Real estate and construction", it: "IT and digital", transport: "Transport and logistics",
    automotive: "Automotive and garages", health: "Health, beauty and wellbeing", hospitality: "Restaurants and hotels",
    education: "Training, culture and events", consulting: "Consulting and business services", unclassified: "Not classified",
  },
  de: {
    holding: "Holdings und Beteiligungen", trade: "Handel und Rohstoffhandel", finance: "Finanzen, Treuhand und Versicherung",
    realestate: "Immobilien und Bau", it: "Informatik und Digitales", transport: "Transport und Logistik",
    automotive: "Autogewerbe und Garagen", health: "Gesundheit, Schönheit und Wellness", hospitality: "Gastronomie und Hotellerie",
    education: "Bildung, Kultur und Events", consulting: "Beratung und Unternehmensdienstleistungen", unclassified: "Nicht zugeordnet",
  },
};

// ---------- numbers ----------

function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

function cantonTotal(snapshot, ym, kind) {
  const m = snapshot.monthly[ym];
  if (!m) throw new Error(`Snapshot has no data for ${ym}`);
  return sum(CANTONS.map((c) => m[kind][c]));
}

function pctChange(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function share(part, whole) {
  return whole ? (part / whole) * 100 : 0;
}

/** All figures used by the article and the CSV. */
function computeFigures(snapshot) {
  const T = snapshot.reportMonth;
  const prev = shiftMonth(T, -1);
  const yoy = shiftMonth(T, -12);
  const year = Number(T.slice(0, 4));
  const ytdMonths = monthsBetween(`${year}-01`, T);
  const ytdPrevMonths = ytdMonths.map((m) => shiftMonth(m, -12));
  const trendMonths = monthsBetween(shiftMonth(T, -12), T);

  const rows = CANTONS.map((c) => {
    const creations = snapshot.monthly[T].hr01[c];
    const prevCreations = snapshot.monthly[prev].hr01[c];
    const yoyCreations = snapshot.monthly[yoy].hr01[c];
    const deletions = snapshot.monthly[T].hr03[c];
    const ytd = sum(ytdMonths.map((m) => snapshot.monthly[m].hr01[c]));
    const ytdPrev = sum(ytdPrevMonths.map((m) => snapshot.monthly[m].hr01[c]));
    const ytdDeletions = sum(ytdMonths.map((m) => snapshot.monthly[m].hr03[c]));
    return {
      canton: c,
      creations,
      prevCreations,
      yoyCreations,
      mom: pctChange(creations, prevCreations),
      yoy: pctChange(creations, yoyCreations),
      deletions,
      net: creations - deletions,
      ytd,
      ytdPrev,
      ytdChange: pctChange(ytd, ytdPrev),
      ytdDeletions,
      ytdNet: ytd - ytdDeletions,
      legal: snapshot.target.legalForms[c],
    };
  });
  const total = {
    canton: "total",
    creations: sum(rows.map((r) => r.creations)),
    prevCreations: sum(rows.map((r) => r.prevCreations)),
    yoyCreations: sum(rows.map((r) => r.yoyCreations)),
    deletions: sum(rows.map((r) => r.deletions)),
    ytd: sum(rows.map((r) => r.ytd)),
    ytdPrev: sum(rows.map((r) => r.ytdPrev)),
    ytdDeletions: sum(rows.map((r) => r.ytdDeletions)),
    legal: Object.fromEntries(LEGAL_FORM_KEYS.map((k) => [k, sum(rows.map((r) => r.legal[k]))])),
  };
  total.mom = pctChange(total.creations, total.prevCreations);
  total.yoy = pctChange(total.creations, total.yoyCreations);
  total.net = total.creations - total.deletions;
  total.ytdChange = pctChange(total.ytd, total.ytdPrev);
  total.ytdNet = total.ytd - total.ytdDeletions;

  const ge = rows.find((r) => r.canton === "GE");
  const topCanton = [...rows].sort((a, b) => b.creations - a.creations || CANTONS.indexOf(a.canton) - CANTONS.indexOf(b.canton))[0];
  const topLegal = [...LEGAL_FORM_KEYS].sort((a, b) => total.legal[b] - total.legal[a] || LEGAL_FORM_KEYS.indexOf(a) - LEGAL_FORM_KEYS.indexOf(b))[0];
  const geTopLegal = [...LEGAL_FORM_KEYS].sort((a, b) => ge.legal[b] - ge.legal[a] || LEGAL_FORM_KEYS.indexOf(a) - LEGAL_FORM_KEYS.indexOf(b))[0];

  const sectorTotal = sum(Object.values(snapshot.target.sectors));
  const sectors = snapshot.sectorOrder
    .filter((k) => k !== "unclassified")
    .map((k) => ({ key: k, count: snapshot.target.sectors[k] || 0 }))
    .sort((a, b) => b.count - a.count || snapshot.sectorOrder.indexOf(a.key) - snapshot.sectorOrder.indexOf(b.key));
  const unclassified = snapshot.target.sectors.unclassified || 0;

  const trend = trendMonths.map((m) => ({
    month: m,
    ge: snapshot.monthly[m].hr01.GE,
    total: cantonTotal(snapshot, m, "hr01"),
    deletions: cantonTotal(snapshot, m, "hr03"),
  }));

  return {
    T, prev, yoy, year, ytdFirst: ytdMonths[0], rows, total, ge, topCanton, topLegal, geTopLegal,
    geShare: share(ge.creations, total.creations),
    sectors, unclassified, sectorTotal, trend,
  };
}

// ---------- formatting ----------

function fmtInt(locale, n) {
  return new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 0 }).format(n);
}

function fmtPct(locale, value, { signed = true } = {}) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "n/a";
  const rounded = Math.round(value * 10) / 10;
  const abs = new Intl.NumberFormat(INTL_LOCALE[locale], { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.abs(rounded));
  const space = locale === "en" ? "" : "\u00a0";
  const sign = !signed ? "" : value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${abs}${space}%`;
}

function fmtSigned(locale, n) {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${fmtInt(locale, Math.abs(n))}`;
}

function monthName(locale, ym, style = "long") {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: style, year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function monthOnly(locale, ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function fmtDate(locale, iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function articleUrl(locale, slug) {
  return `${SITE}/${locale}/ressources/articles/${slug}/`;
}

function table(header, rows, align) {
  const sep = align.map((a) => (a === "r" ? "---:" : "---"));
  return [header, sep, ...rows].map((cells) => `| ${cells.join(" | ")} |`).join("\n");
}

// ---------- locale texts ----------

const TEXT = {
  fr: {
    title: (f, L) => `Créations d'entreprises Genève et Romandie : ${L.month}`,
    description: (f, L) => `${L.n(f.total.creations)} nouvelles inscriptions au registre du commerce en Suisse romande en ${L.month}, dont ${L.n(f.ge.creations)} à Genève. Chiffres par canton, formes juridiques et radiations, d'après la FOSC.`,
    trend: (v, L) => (v === null ? "sans base de comparaison" : v > 0 ? `en hausse de ${L.p(v, false)}` : v < 0 ? `en baisse de ${L.p(v, false)}` : "stable"),
    intro: (f, L) => `En ${L.month}, la Feuille officielle suisse du commerce (FOSC) a publié **${L.n(f.total.creations)} nouvelles inscriptions** au registre du commerce dans les six cantons romands (Genève, Vaud, Valais, Neuchâtel, Fribourg et Jura), dont **${L.n(f.ge.creations)} à Genève**. Sur la même période, ${L.n(f.total.deletions)} radiations ont été publiées, soit un solde de ${L.s(f.total.net)} entités inscrites.\n\nCe baromètre mensuel d'Ark Fiduciaire est calculé automatiquement à partir des publications officielles de la FOSC. Les chiffres ne sont ni estimés ni extrapolés : ce sont des comptages de publications, détaillés par canton et par forme juridique. Cette page est mise à jour chaque mois avec les derniers chiffres publiés ; la méthode et l'historique complet à télécharger figurent en fin d'article.\n\nUne nouvelle inscription n'est pas toujours une nouvelle entreprise : le total comprend ${L.n(f.total.legal.branch)} succursales, et certaines inscriptions peuvent faire suite à un transfert de siège depuis un autre canton. Hors succursales, ${L.n(f.total.creations - f.total.legal.branch)} nouvelles sociétés, raisons individuelles et autres entités ont été inscrites.`,
    hKey: (f, L) => `## Les chiffres clés de ${L.month}`,
    key: (f, L) => [
      `- **${L.n(f.total.creations)}** nouvelles inscriptions en Suisse romande, ${L.trend(f.total.mom)} par rapport à ${L.prevMonth} (${L.n(f.total.prevCreations)}) et ${L.trend(f.total.yoy)} par rapport à ${L.yoyMonth} (${L.n(f.total.yoyCreations)}).`,
      `- **${L.n(f.ge.creations)}** à Genève, soit ${L.p(f.geShare, false)} du total romand ; ${L.trend(f.ge.mom)} sur un mois et ${L.trend(f.ge.yoy)} sur un an.`,
      `- Le canton le plus actif est ${L.canton(f.topCanton.canton)}, avec ${L.n(f.topCanton.creations)} nouvelles inscriptions.`,
      `- La forme la plus fréquente est ${L.legalNoun(f.topLegal)} (${L.n(f.total.legal[f.topLegal])} inscriptions, ${L.p(L.share(f.total.legal[f.topLegal], f.total.creations), false)}).`,
      `- **${L.n(f.total.deletions)}** radiations publiées dans les six cantons, pour un solde de ${L.s(f.total.net)}.`,
      `- Depuis janvier, ${L.n(f.total.ytd)} nouvelles inscriptions, ${L.trend(f.total.ytdChange)} par rapport à la même période de ${f.year - 1} (${L.n(f.total.ytdPrev)}).`,
    ].join("\n"),
    hCanton: () => "## Nouvelles inscriptions et radiations par canton",
    cantonIntro: (f, L) => `Le tableau compare les nouvelles inscriptions de ${L.month} avec le mois précédent et avec le même mois de l'année passée. Le solde correspond aux nouvelles inscriptions moins les radiations publiées le même mois.`,
    cantonHead: (f, L) => ["Canton", `Inscriptions ${L.monthShort(f.T)}`, L.monthShort(f.prev), "Var. mensuelle", L.monthShort(f.yoy), "Var. annuelle", "Radiations", "Solde"],
    totalLabel: "Suisse romande",
    cantonOutro: (f, L) => `Genève représente ${L.p(f.geShare, false)} des nouvelles inscriptions romandes du mois. Les variations d'un mois à l'autre doivent être lues avec prudence dans les petits cantons, où quelques inscriptions suffisent à faire varier fortement le pourcentage.`,
    hLegal: () => "## Formes juridiques des nouvelles inscriptions",
    legalIntro: (f, L) => `La forme juridique est lue dans le champ structuré de chaque publication. À Genève, la forme la plus fréquente ce mois est ${L.legalNoun(f.geTopLegal)} (${L.n(f.ge.legal[f.geTopLegal])} sur ${L.n(f.ge.creations)}).`,
    legalOutro: () => "La catégorie « Autres formes » regroupe notamment les sociétés en nom collectif, les associations, les fondations et les sociétés coopératives inscrites au registre du commerce. Les succursales comprennent celles d'entreprises suisses et étrangères.",
    hYtd: (f, L) => `## Depuis le début de l'année (${L.monthOnly(f.ytdFirst)} à ${L.month})`,
    ytdHead: (f, L) => ["Canton", `Inscriptions ${f.year}`, `Inscriptions ${f.year - 1}`, "Variation", `Radiations ${f.year}`, `Solde ${f.year}`],
    hTrend: () => "## Évolution sur treize mois",
    trendIntro: () => "Nombre de nouvelles inscriptions publiées chaque mois, pour Genève et pour l'ensemble des six cantons romands, avec les radiations romandes du même mois.",
    trendHead: () => ["Mois", "Genève", "Suisse romande", "Radiations (Suisse romande)"],
    hSector: () => "## Domaines d'activité (indicatif)",
    sectorIntro: (f, L) => `Pour donner un ordre de grandeur, le but social de chaque nouvelle inscription est classé par mots-clés dans un domaine d'activité. Ce classement est **approximatif** : il ne correspond pas à la nomenclature officielle NOGA, un but peut couvrir plusieurs activités et certains buts ne contiennent aucun mot-clé reconnu (${L.n(f.unclassified)} inscriptions non classées sur ${L.n(f.sectorTotal)}).`,
    sectorHead: () => ["Domaine (classement par mots-clés)", "Inscriptions", "Part"],
    hMeaning: () => "## Ce que ces chiffres signifient pour un créateur d'entreprise",
    meaning: () => [
      "Le choix entre Sàrl et SA dépend d'abord du capital et de l'image recherchée. La Sàrl demande un capital minimum de 20 000 francs, la SA un capital-actions minimum de 100 000 francs, dont au moins 20 % de chaque action et au moins 50 000 francs doivent être libérés à la fondation. Les deux formes limitent la responsabilité des associés ou actionnaires au patrimoine de la société.",
      "La raison individuelle est la forme la plus simple, mais l'entrepreneur répond des dettes sur l'ensemble de ses biens. L'inscription au registre du commerce devient obligatoire dès que le chiffre d'affaires annuel atteint 100 000 francs. Beaucoup d'indépendants démarrent ainsi avant de passer à une Sàrl lorsque l'activité grandit.",
      "Une inscription n'est pas une fin en soi : TVA, assurances sociales, comptabilité et fiscalité suivent rapidement. Ark Fiduciaire accompagne les fondateurs à Genève, de la [création de la société](/services/incorporation) à la tenue de la comptabilité. Pour une question précise, [contactez-nous](/contact).",
    ].join("\n\n"),
    hMethod: () => "## Méthodologie",
    method: (f, L, S) => [
      `- **Source** : publications de la [Feuille officielle suisse du commerce (FOSC)](${PORTAL_URL}), extraites via l'interface publique du portail le ${L.date(S.fetchedAt)}.`,
      "- **Nouvelles inscriptions** : publications de la rubrique HR01 (« nouvelles inscriptions ») des registres du commerce de Genève, Vaud, Valais, Neuchâtel, Fribourg et Jura. Elles incluent les succursales.",
      "- **Radiations** : publications de la rubrique HR03. Une radiation peut résulter d'une liquidation, d'une fusion, d'un transfert de siège ou d'une autre cause : le solde est donc un flux de publications, pas l'évolution du nombre d'entreprises actives.",
      "- **Date retenue** : la date de publication dans la FOSC, et non la date d'inscription au registre, qui la précède en général de quelques jours. Une partie des inscriptions de fin de mois apparaît donc dans le mois suivant.",
      "- **Formes juridiques** : lues dans le champ structuré de chaque publication. Le domaine d'activité est un classement par mots-clés du but social, à titre indicatif.",
      `- **Contrôles** : ${L.n(S.quality.hr01Publications)} publications HR01 et ${L.n(S.quality.hr03Publications)} publications HR03 traitées sur la période couverte ; ${L.n(S.quality.detailsParsed)} publications du mois lues en détail ; ${L.n(S.quality.seatTransferMentions)} mentionnent un transfert de siège depuis un autre canton ; ${L.n(S.quality.uidDuplicates)} doublon d'IDE détecté.`,
      "- **Données personnelles** : le rapport ne publie que des agrégats. Aucun nom de personne ni d'entreprise n'est repris.",
      "- **Révisions** : une publication annulée ou corrigée après l'extraction peut modifier légèrement les chiffres. Chaque rapport conserve les chiffres de sa date d'extraction.",
    ].join("\n"),
    hCite: () => "## Citer ces données",
    cite: (f, L, S, slug) => `Les journalistes et chercheurs peuvent reprendre ces chiffres en citant la source :\n\n> Ark Fiduciaire, « Créations d'entreprises à Genève et en Suisse romande, statistiques mensuelles », d'après la Feuille officielle suisse du commerce (FOSC), données de ${L.month}. ${articleUrl("fr", slug)}\n\nDonnées au format CSV : [historique complet](${PAGES.creations.csvHistory}) et [${L.month}](${PAGES.creations.csvMonth(f.T)}).`,
    hSeeAlso: () => "## Voir aussi",
    seeAlso: () => [
      `- [Faillites à Genève et en Suisse romande : statistiques mensuelles](/ressources/articles/${PAGES.faillites.slug})`,
      "- [Créer une Sàrl ou une SA à Genève : critères, capital et fiscalité](/ressources/articles/creer-sarl-sa-geneve-criteres-capital-fiscalite-gouvernance-2026)",
      "- [Création de société avec Ark Fiduciaire](/services/incorporation)",
    ].join("\n"),
    refs: [
      ["Feuille officielle suisse du commerce (FOSC) – portail des publications", PORTAL_URL],
      ["Registre du commerce (Zefix)", "https://www.zefix.ch/fr/search/entity/welcome"],
      ["Ordonnance sur le registre du commerce (ORC, RS 221.411) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/2007/686/fr"],
      ["Code des obligations (CO, RS 220) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr"],
    ],
  },
  en: {
    title: (f, L) => `New companies in Geneva and Romandie: ${L.month}`,
    description: (f, L) => `${L.n(f.total.creations)} new commercial register entries in French-speaking Switzerland in ${L.month}, including ${L.n(f.ge.creations)} in Geneva. Figures by canton, legal form and deletions, based on the SOGC.`,
    trend: (v, L) => (v === null ? "with no basis for comparison" : v > 0 ? `up ${L.p(v, false)}` : v < 0 ? `down ${L.p(v, false)}` : "unchanged"),
    intro: (f, L) => `In ${L.month}, the Swiss Official Gazette of Commerce (SOGC) published **${L.n(f.total.creations)} new entries** in the commercial register across the six French-speaking cantons (Geneva, Vaud, Valais, Neuchâtel, Fribourg and Jura), including **${L.n(f.ge.creations)} in Geneva**. Over the same period, ${L.n(f.total.deletions)} deletions were published, a balance of ${L.s(f.total.net)} registered entities.\n\nThis monthly barometer by Ark Fiduciaire is computed automatically from the official SOGC publications. The figures are neither estimated nor extrapolated: they are counts of publications, broken down by canton and legal form. This page is updated every month with the latest published figures; the method and the full downloadable history are at the end of the article.\n\nA new entry is not always a new business: the total includes ${L.n(f.total.legal.branch)} branches, and some entries may follow a transfer of seat from another canton. Excluding branches, ${L.n(f.total.creations - f.total.legal.branch)} new companies, sole proprietorships and other entities were registered.`,
    hKey: (f, L) => `## Key figures for ${L.month}`,
    key: (f, L) => [
      `- **${L.n(f.total.creations)}** new entries in French-speaking Switzerland, ${L.trend(f.total.mom)} on ${L.prevMonth} (${L.n(f.total.prevCreations)}) and ${L.trend(f.total.yoy)} on ${L.yoyMonth} (${L.n(f.total.yoyCreations)}).`,
      `- **${L.n(f.ge.creations)}** in Geneva, ${L.p(f.geShare, false)} of the regional total; ${L.trend(f.ge.mom)} month on month and ${L.trend(f.ge.yoy)} year on year.`,
      `- The most active canton is ${L.canton(f.topCanton.canton)}, with ${L.n(f.topCanton.creations)} new entries.`,
      `- The most common legal form is ${L.legalNoun(f.topLegal)} (${L.n(f.total.legal[f.topLegal])} entries, ${L.p(L.share(f.total.legal[f.topLegal], f.total.creations), false)}).`,
      `- **${L.n(f.total.deletions)}** deletions published in the six cantons, a balance of ${L.s(f.total.net)}.`,
      `- Since January, ${L.n(f.total.ytd)} new entries, ${L.trend(f.total.ytdChange)} on the same period of ${f.year - 1} (${L.n(f.total.ytdPrev)}).`,
    ].join("\n"),
    hCanton: () => "## New entries and deletions by canton",
    cantonIntro: (f, L) => `The table compares new entries in ${L.month} with the previous month and with the same month last year. The balance is new entries minus deletions published in the same month.`,
    cantonHead: (f, L) => ["Canton", `Entries ${L.monthShort(f.T)}`, L.monthShort(f.prev), "Monthly change", L.monthShort(f.yoy), "Annual change", "Deletions", "Balance"],
    totalLabel: "French-speaking Switzerland",
    cantonOutro: (f, L) => `Geneva accounts for ${L.p(f.geShare, false)} of the month's new entries in the region. Month-to-month changes should be read with care in the smaller cantons, where a handful of entries can move the percentage sharply.`,
    hLegal: () => "## Legal forms of the new entries",
    legalIntro: (f, L) => `The legal form is read from the structured field of each publication. In Geneva, the most common form this month is ${L.legalNoun(f.geTopLegal)} (${L.n(f.ge.legal[f.geTopLegal])} of ${L.n(f.ge.creations)}).`,
    legalOutro: () => "\"Other forms\" mainly covers general partnerships, associations, foundations and cooperatives entered in the commercial register. Branches include those of Swiss and foreign companies.",
    hYtd: (f, L) => `## Year to date (${L.monthOnly(f.ytdFirst)} to ${L.month})`,
    ytdHead: (f, L) => ["Canton", `Entries ${f.year}`, `Entries ${f.year - 1}`, "Change", `Deletions ${f.year}`, `Balance ${f.year}`],
    hTrend: () => "## Thirteen-month trend",
    trendIntro: () => "New entries published each month for Geneva and for the six French-speaking cantons as a whole, with the region's deletions for the same month.",
    trendHead: () => ["Month", "Geneva", "French-speaking Switzerland", "Deletions (French-speaking Switzerland)"],
    hSector: () => "## Fields of activity (indicative)",
    sectorIntro: (f, L) => `To give an order of magnitude, the stated purpose of each new entry is assigned to a field of activity by keywords. This classification is **approximate**: it does not follow the official NOGA nomenclature, a purpose can cover several activities and some purposes contain no recognised keyword (${L.n(f.unclassified)} entries not classified out of ${L.n(f.sectorTotal)}).`,
    sectorHead: () => ["Field (keyword classification)", "Entries", "Share"],
    hMeaning: () => "## What these figures mean for founders",
    meaning: () => [
      "The choice between a Sàrl (GmbH) and an SA (AG) depends first on capital and on the image you want to project. A Sàrl requires minimum capital of CHF 20,000, an SA minimum share capital of CHF 100,000, of which at least 20% of each share and at least CHF 50,000 in total must be paid in at incorporation. Both forms limit the liability of the partners or shareholders to the company's assets.",
      "The sole proprietorship is the simplest form, but the owner is liable for debts with all personal assets. Registration in the commercial register becomes mandatory once annual turnover reaches CHF 100,000. Many self-employed people start this way and move to a Sàrl as the business grows.",
      "Registration is only a first step: VAT, social insurance, accounting and tax follow quickly. Ark Fiduciaire supports founders in Geneva, from [setting up the company](/services/incorporation) to keeping the books. For a specific question, [get in touch](/contact).",
    ].join("\n\n"),
    hMethod: () => "## Methodology",
    method: (f, L, S) => [
      `- **Source**: publications of the [Swiss Official Gazette of Commerce (SOGC)](${PORTAL_URL}), retrieved through the portal's public interface on ${L.date(S.fetchedAt)}.`,
      "- **New entries**: publications under heading HR01 (\"new entries\") of the commercial registers of Geneva, Vaud, Valais, Neuchâtel, Fribourg and Jura. They include branches.",
      "- **Deletions**: publications under heading HR03. A deletion can follow a liquidation, a merger, a transfer of seat or another cause, so the balance is a flow of publications, not the change in the number of active companies.",
      "- **Date used**: the SOGC publication date, not the date of entry in the register, which usually comes a few days earlier. Some entries made at the end of a month therefore appear in the following month.",
      "- **Legal forms**: read from the structured field of each publication. The field of activity is an indicative keyword classification of the stated purpose.",
      `- **Checks**: ${L.n(S.quality.hr01Publications)} HR01 and ${L.n(S.quality.hr03Publications)} HR03 publications processed over the period covered; ${L.n(S.quality.detailsParsed)} publications of the month read in full; ${L.n(S.quality.seatTransferMentions)} mention a transfer of seat from another canton; ${L.n(S.quality.uidDuplicates)} duplicate UID detected.`,
      "- **Personal data**: the report only publishes aggregates. No names of people or companies are included.",
      "- **Revisions**: a publication cancelled or corrected after retrieval may slightly change the figures. Each report keeps the figures as of its retrieval date.",
    ].join("\n"),
    hCite: () => "## Cite this data",
    cite: (f, L, S, slug) => `Journalists and researchers may use these figures with the following attribution:\n\n> Ark Fiduciaire, "New companies in Geneva and French-speaking Switzerland, monthly statistics", based on the Swiss Official Gazette of Commerce (SOGC), data for ${L.month}. ${articleUrl("en", slug)}\n\nData in CSV format: [full history](${PAGES.creations.csvHistory}) and [${L.month}](${PAGES.creations.csvMonth(f.T)}).`,
    hSeeAlso: () => "## See also",
    seeAlso: () => [
      `- [Bankruptcies in Geneva and French-speaking Switzerland: monthly statistics](/ressources/articles/${PAGES.faillites.slug})`,
      "- [Setting up a Sàrl or an SA in Geneva: criteria, capital and tax](/ressources/articles/creer-sarl-sa-geneve-criteres-capital-fiscalite-gouvernance-2026)",
      "- [Company formation with Ark Fiduciaire](/services/incorporation)",
    ].join("\n"),
    refs: [
      ["Swiss Official Gazette of Commerce (SOGC) – publications portal", PORTAL_URL],
      ["Commercial register (Zefix)", "https://www.zefix.ch/en/search/entity/welcome"],
      ["Commercial Register Ordinance (CRO, SR 221.411) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/2007/686/en"],
      ["Code of Obligations (CO, SR 220) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/en"],
    ],
  },
  de: {
    title: (f, L) => `Firmengründungen in Genf und der Romandie: ${L.month}`,
    description: (f, L) => `${L.n(f.total.creations)} Neueintragungen im Handelsregister der Westschweiz im ${L.month}, davon ${L.n(f.ge.creations)} in Genf. Zahlen nach Kanton, Rechtsform und Löschungen, gestützt auf das SHAB.`,
    trend: (v, L) => (v === null ? "ohne Vergleichsbasis" : v > 0 ? `ein Plus von ${L.p(v, false)}` : v < 0 ? `ein Minus von ${L.p(v, false)}` : "unverändert"),
    intro: (f, L) => `Im ${L.month} veröffentlichte das Schweizerische Handelsamtsblatt (SHAB) **${L.n(f.total.creations)} Neueintragungen** im Handelsregister der sechs Westschweizer Kantone (Genf, Waadt, Wallis, Neuenburg, Freiburg und Jura), davon **${L.n(f.ge.creations)} in Genf**. Im gleichen Zeitraum wurden ${L.n(f.total.deletions)} Löschungen publiziert, was einen Saldo von ${L.s(f.total.net)} eingetragenen Einheiten ergibt.\n\nDieses monatliche Barometer von Ark Fiduciaire wird automatisch aus den amtlichen SHAB-Publikationen berechnet. Die Zahlen sind weder geschätzt noch hochgerechnet: Es handelt sich um gezählte Publikationen, aufgeschlüsselt nach Kanton und Rechtsform. Diese Seite wird jeden Monat mit den neuesten Zahlen aktualisiert; Methode und vollständige Zeitreihe zum Herunterladen finden sich am Ende des Artikels.\n\nNicht jede Neueintragung ist ein neues Unternehmen: Das Total umfasst ${L.n(f.total.legal.branch)} Zweigniederlassungen, und einzelne Eintragungen können auf eine Sitzverlegung aus einem anderen Kanton zurückgehen. Ohne Zweigniederlassungen wurden ${L.n(f.total.creations - f.total.legal.branch)} neue Gesellschaften, Einzelunternehmen und andere Einheiten eingetragen.`,
    hKey: (f, L) => `## Die wichtigsten Zahlen für ${L.month}`,
    key: (f, L) => [
      `- **${L.n(f.total.creations)}** Neueintragungen in der Westschweiz, gegenüber ${L.prevMonth} (${L.n(f.total.prevCreations)}) ${L.trend(f.total.mom)} und gegenüber ${L.yoyMonth} (${L.n(f.total.yoyCreations)}) ${L.trend(f.total.yoy)}.`,
      `- **${L.n(f.ge.creations)}** in Genf, das sind ${L.p(f.geShare, false)} des Westschweizer Totals; gegenüber dem Vormonat ${L.trend(f.ge.mom)}, gegenüber dem Vorjahr ${L.trend(f.ge.yoy)}.`,
      `- Der aktivste Kanton ist ${L.canton(f.topCanton.canton)} mit ${L.n(f.topCanton.creations)} Neueintragungen.`,
      `- Die häufigste Rechtsform ist ${L.legalNoun(f.topLegal)} (${L.n(f.total.legal[f.topLegal])} Eintragungen, ${L.p(L.share(f.total.legal[f.topLegal], f.total.creations), false)}).`,
      `- **${L.n(f.total.deletions)}** publizierte Löschungen in den sechs Kantonen, Saldo ${L.s(f.total.net)}.`,
      `- Seit Januar ${L.n(f.total.ytd)} Neueintragungen, gegenüber dem gleichen Zeitraum ${f.year - 1} (${L.n(f.total.ytdPrev)}) ${L.trend(f.total.ytdChange)}.`,
    ].join("\n"),
    hCanton: () => "## Neueintragungen und Löschungen nach Kanton",
    cantonIntro: (f, L) => `Die Tabelle vergleicht die Neueintragungen im ${L.month} mit dem Vormonat und mit dem gleichen Monat des Vorjahres. Der Saldo entspricht den Neueintragungen abzüglich der im gleichen Monat publizierten Löschungen.`,
    cantonHead: (f, L) => ["Kanton", `Eintragungen ${L.monthShort(f.T)}`, L.monthShort(f.prev), "Veränderung zum Vormonat", L.monthShort(f.yoy), "Veränderung zum Vorjahr", "Löschungen", "Saldo"],
    totalLabel: "Westschweiz",
    cantonOutro: (f, L) => `Genf macht ${L.p(f.geShare, false)} der Westschweizer Neueintragungen des Monats aus. Monatliche Veränderungen sind in den kleineren Kantonen mit Vorsicht zu lesen, da dort wenige Eintragungen den Prozentsatz stark bewegen.`,
    hLegal: () => "## Rechtsformen der Neueintragungen",
    legalIntro: (f, L) => `Die Rechtsform wird aus dem strukturierten Feld jeder Publikation gelesen. In Genf ist die häufigste Rechtsform in diesem Monat ${L.legalNoun(f.geTopLegal)} (${L.n(f.ge.legal[f.geTopLegal])} von ${L.n(f.ge.creations)}).`,
    legalOutro: () => "„Andere Rechtsformen“ umfasst vor allem Kollektivgesellschaften, Vereine, Stiftungen und Genossenschaften, die im Handelsregister eingetragen sind. Zweigniederlassungen umfassen solche schweizerischer und ausländischer Unternehmen.",
    hYtd: (f, L) => `## Seit Jahresbeginn (${L.monthOnly(f.ytdFirst)} bis ${L.month})`,
    ytdHead: (f, L) => ["Kanton", `Eintragungen ${f.year}`, `Eintragungen ${f.year - 1}`, "Veränderung", `Löschungen ${f.year}`, `Saldo ${f.year}`],
    hTrend: () => "## Entwicklung über dreizehn Monate",
    trendIntro: () => "Monatlich publizierte Neueintragungen für Genf und für die sechs Westschweizer Kantone insgesamt, mit den Löschungen der Region im gleichen Monat.",
    trendHead: () => ["Monat", "Genf", "Westschweiz", "Löschungen (Westschweiz)"],
    hSector: () => "## Tätigkeitsbereiche (Richtwert)",
    sectorIntro: (f, L) => `Als Grössenordnung wird der Zweck jeder Neueintragung anhand von Stichwörtern einem Tätigkeitsbereich zugeordnet. Diese Zuordnung ist **approximativ**: Sie folgt nicht der amtlichen NOGA-Systematik, ein Zweck kann mehrere Tätigkeiten umfassen und manche Zwecke enthalten kein erkanntes Stichwort (${L.n(f.unclassified)} von ${L.n(f.sectorTotal)} Eintragungen nicht zugeordnet).`,
    sectorHead: () => ["Bereich (Stichwortzuordnung)", "Eintragungen", "Anteil"],
    hMeaning: () => "## Was diese Zahlen für Gründerinnen und Gründer bedeuten",
    meaning: () => [
      "Die Wahl zwischen GmbH und AG hängt zuerst vom Kapital und vom gewünschten Auftritt ab. Die GmbH verlangt ein Mindestkapital von 20 000 Franken, die AG ein Aktienkapital von mindestens 100 000 Franken, von dem bei der Gründung mindestens 20 % jeder Aktie und insgesamt mindestens 50 000 Franken liberiert sein müssen. Beide Formen beschränken die Haftung der Gesellschafter oder Aktionäre auf das Gesellschaftsvermögen.",
      "Das Einzelunternehmen ist die einfachste Form, der Inhaber haftet jedoch mit seinem gesamten Vermögen. Die Eintragung ins Handelsregister ist Pflicht, sobald der Jahresumsatz 100 000 Franken erreicht. Viele Selbständige beginnen so und wechseln zur GmbH, wenn das Geschäft wächst.",
      "Die Eintragung ist nur der erste Schritt: MWST, Sozialversicherungen, Buchhaltung und Steuern folgen rasch. Ark Fiduciaire begleitet Gründerinnen und Gründer in Genf, von der [Gesellschaftsgründung](/services/incorporation) bis zur Buchführung. Bei konkreten Fragen [kontaktieren Sie uns](/contact).",
    ].join("\n\n"),
    hMethod: () => "## Methodik",
    method: (f, L, S) => [
      `- **Quelle**: Publikationen des [Schweizerischen Handelsamtsblatts (SHAB)](${PORTAL_URL}), über die öffentliche Schnittstelle des Portals abgerufen am ${L.date(S.fetchedAt)}.`,
      "- **Neueintragungen**: Publikationen der Rubrik HR01 („Neueintragungen“) der Handelsregister von Genf, Waadt, Wallis, Neuenburg, Freiburg und Jura. Zweigniederlassungen sind eingeschlossen.",
      "- **Löschungen**: Publikationen der Rubrik HR03. Eine Löschung kann auf eine Liquidation, eine Fusion, eine Sitzverlegung oder einen anderen Grund zurückgehen; der Saldo ist daher ein Publikationsfluss, nicht die Veränderung der Zahl aktiver Unternehmen.",
      "- **Massgebendes Datum**: das Publikationsdatum im SHAB, nicht das Datum der Eintragung ins Register, das meist einige Tage früher liegt. Ein Teil der Eintragungen vom Monatsende erscheint deshalb im Folgemonat.",
      "- **Rechtsformen**: aus dem strukturierten Feld jeder Publikation gelesen. Der Tätigkeitsbereich ist eine indikative Stichwortzuordnung des Zwecks.",
      `- **Kontrollen**: ${L.n(S.quality.hr01Publications)} HR01- und ${L.n(S.quality.hr03Publications)} HR03-Publikationen im abgedeckten Zeitraum verarbeitet; ${L.n(S.quality.detailsParsed)} Publikationen des Monats vollständig gelesen; ${L.n(S.quality.seatTransferMentions)} erwähnen eine Sitzverlegung aus einem anderen Kanton; ${L.n(S.quality.uidDuplicates)} doppelte UID festgestellt.`,
      "- **Personendaten**: Der Bericht veröffentlicht nur aggregierte Zahlen. Es werden keine Namen von Personen oder Unternehmen genannt.",
      "- **Revisionen**: Eine nach dem Abruf annullierte oder berichtigte Publikation kann die Zahlen leicht verändern. Jeder Bericht behält die Zahlen seines Abrufdatums.",
    ].join("\n"),
    hCite: () => "## Diese Daten zitieren",
    cite: (f, L, S, slug) => `Journalistinnen, Journalisten und Forschende können diese Zahlen mit folgender Quellenangabe verwenden:\n\n> Ark Fiduciaire, „Firmengründungen in Genf und der Westschweiz, monatliche Statistik“, gestützt auf das Schweizerische Handelsamtsblatt (SHAB), Daten für ${L.month}. ${articleUrl("de", slug)}\n\nDaten im CSV-Format: [vollständige Zeitreihe](${PAGES.creations.csvHistory}) und [${L.month}](${PAGES.creations.csvMonth(f.T)}).`,
    hSeeAlso: () => "## Siehe auch",
    seeAlso: () => [
      `- [Konkurse in Genf und der Westschweiz: monatliche Statistik](/ressources/articles/${PAGES.faillites.slug})`,
      "- [GmbH oder AG in Genf gründen: Kriterien, Kapital und Steuern](/ressources/articles/creer-sarl-sa-geneve-criteres-capital-fiscalite-gouvernance-2026)",
      "- [Gesellschaftsgründung mit Ark Fiduciaire](/services/incorporation)",
    ].join("\n"),
    refs: [
      ["Schweizerisches Handelsamtsblatt (SHAB) – Publikationsportal", PORTAL_URL],
      ["Handelsregister (Zefix)", "https://www.zefix.ch/de/search/entity/welcome"],
      ["Handelsregisterverordnung (HRegV, SR 221.411) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/2007/686/de"],
      ["Obligationenrecht (OR, SR 220) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/de"],
    ],
  },
};

const TAGS = ["creation-entreprise", "registre-du-commerce", "statistiques", "geneve", "suisse-romande", "fosc"];

function helpers(locale, f) {
  const L = {
    n: (v) => fmtInt(locale, v),
    p: (v, signed = true) => fmtPct(locale, v, { signed }),
    s: (v) => fmtSigned(locale, v),
    share,
    canton: (c) => CANTON_NAMES[locale][c],
    legal: (k) => LEGAL_FORM_LABELS[locale][k],
    legalNoun: (k) => LEGAL_FORM_NOUNS[locale][k],
    date: (iso) => fmtDate(locale, iso),
    monthShort: (ym) => monthName(locale, ym, "short"),
    monthOnly: (ym) => monthOnly(locale, ym),
    month: monthName(locale, f.T),
    prevMonth: monthName(locale, f.prev),
    yoyMonth: monthName(locale, f.yoy),
  };
  L.trend = (v) => TEXT[locale].trend(v, L);
  return L;
}

/** Renders the créations page for one locale. Pure function of (locale, snapshot). */
function renderCreations(locale, snapshot, { date } = {}) {
  if (!TEXT[locale]) throw new Error(`Unsupported locale ${locale}`);
  const t = TEXT[locale];
  const f = computeFigures(snapshot);
  const L = helpers(locale, f);
  const slug = PAGES.creations.slug;

  const cantonRows = [...f.rows, { ...f.total, canton: null }].map((r) => [
    r.canton ? L.canton(r.canton) : `**${t.totalLabel}**`,
    L.n(r.creations), L.n(r.prevCreations), L.p(r.mom), L.n(r.yoyCreations), L.p(r.yoy), L.n(r.deletions), L.s(r.net),
  ]);
  const legalRows = [...f.rows, { ...f.total, canton: null }].map((r) => [
    r.canton ? L.canton(r.canton) : `**${t.totalLabel}**`,
    ...LEGAL_FORM_KEYS.map((k) => L.n(r.legal[k])),
    L.n(r.creations),
  ]);
  const ytdRows = [...f.rows, { ...f.total, canton: null }].map((r) => [
    r.canton ? L.canton(r.canton) : `**${t.totalLabel}**`,
    L.n(r.ytd), L.n(r.ytdPrev), L.p(r.ytdChange), L.n(r.ytdDeletions), L.s(r.ytdNet),
  ]);
  const trendRows = f.trend.map((m) => [L.monthShort(m.month), L.n(m.ge), L.n(m.total), L.n(m.deletions)]);
  const sectorRows = [
    ...f.sectors.map((s) => [SECTOR_LABELS[locale][s.key], L.n(s.count), L.p(share(s.count, f.sectorTotal), false)]),
    [SECTOR_LABELS[locale].unclassified, L.n(f.unclassified), L.p(share(f.unclassified, f.sectorTotal), false)],
  ];
  const legalHead = [t.cantonHead(f, L)[0], ...LEGAL_FORM_KEYS.map((k) => L.legal(k)), "Total"];

  const content = [
    t.intro(f, L),
    t.hKey(f, L),
    t.key(f, L),
    t.hCanton(f, L),
    t.cantonIntro(f, L),
    table(t.cantonHead(f, L), cantonRows, ["l", "r", "r", "r", "r", "r", "r", "r"]),
    t.cantonOutro(f, L),
    t.hLegal(f, L),
    t.legalIntro(f, L),
    table(legalHead, legalRows, ["l", "r", "r", "r", "r", "r", "r"]),
    t.legalOutro(f, L),
    t.hYtd(f, L),
    table(t.ytdHead(f, L), ytdRows, ["l", "r", "r", "r", "r", "r"]),
    t.hTrend(f, L),
    t.trendIntro(f, L),
    table(t.trendHead(f, L), trendRows, ["l", "r", "r", "r"]),
    t.hSector(f, L),
    t.sectorIntro(f, L),
    table(t.sectorHead(f, L), sectorRows, ["l", "r", "r"]),
    t.hMeaning(f, L),
    t.meaning(f, L),
    t.hMethod(f, L),
    t.method(f, L, snapshot),
    t.hCite(f, L),
    t.cite(f, L, snapshot, slug),
    t.hSeeAlso(f, L),
    t.seeAlso(f, L),
  ].join("\n\n");

  return {
    slug,
    title: t.title(f, L),
    description: t.description(f, L),
    content,
    author: "Ark Fiduciaire",
    date,
    category: "incorporation",
    tags: TAGS.slice(),
    references: t.refs.map(([labelKey, url]) => ({ labelKey, url })),
    series: PAGES.creations.series,
    reportMonth: snapshot.reportMonth,
  };
}

function csvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ---------- bankruptcies page ----------

const DEBTOR_LABELS = {
  fr: { company: "Sociétés", or731b: "dont art. 731b CO", person: "Particuliers", estate: "Successions" },
  en: { company: "Companies", or731b: "of which art. 731b CO", person: "Individuals", estate: "Estates" },
  de: { company: "Gesellschaften", or731b: "davon Art. 731b OR", person: "Privatpersonen", estate: "Nachlässe" },
};

function bankruptcies(snapshot, ym, c) {
  const m = snapshot.monthly[ym];
  if (!m || !m.kk02 || !m.kk03) throw new Error(`Snapshot has no bankruptcy data for ${ym}`);
  return m.kk02[c] + m.kk03[c];
}

/** All bankruptcy figures used by the page, the CSV and the highlights. */
function computeBankruptcyFigures(snapshot) {
  const T = snapshot.reportMonth;
  const prev = shiftMonth(T, -1);
  const yoy = shiftMonth(T, -12);
  const year = Number(T.slice(0, 4));
  const ytdMonths = monthsBetween(`${year}-01`, T);
  const ytdPrevMonths = ytdMonths.map((m) => shiftMonth(m, -12));
  const trendMonths = monthsBetween(shiftMonth(T, -12), T);
  const r12Months = monthsBetween(shiftMonth(T, -11), T);
  const r12PrevMonths = r12Months.map((m) => shiftMonth(m, -12));
  const rows = CANTONS.map((c) => {
    const count = bankruptcies(snapshot, T, c);
    const r12 = sum(r12Months.map((m) => bankruptcies(snapshot, m, c)));
    const r12Prev = sum(r12PrevMonths.map((m) => bankruptcies(snapshot, m, c)));
    const prevCount = bankruptcies(snapshot, prev, c);
    const yoyCount = bankruptcies(snapshot, yoy, c);
    const ytd = sum(ytdMonths.map((m) => bankruptcies(snapshot, m, c)));
    const ytdPrev = sum(ytdPrevMonths.map((m) => bankruptcies(snapshot, m, c)));
    return {
      canton: c,
      count, prevCount, yoyCount,
      mom: pctChange(count, prevCount),
      yoy: pctChange(count, yoyCount),
      kk02: snapshot.monthly[T].kk02[c],
      kk03: snapshot.monthly[T].kk03[c],
      ytd, ytdPrev, ytdChange: pctChange(ytd, ytdPrev),
      r12, r12Prev, r12Change: pctChange(r12, r12Prev),
      debtors: snapshot.target.debtors[c],
    };
  });
  const total = { canton: "total" };
  for (const k of ["count", "prevCount", "yoyCount", "kk02", "kk03", "ytd", "ytdPrev", "r12", "r12Prev"]) total[k] = sum(rows.map((r) => r[k]));
  total.r12Change = pctChange(total.r12, total.r12Prev);
  total.mom = pctChange(total.count, total.prevCount);
  total.yoy = pctChange(total.count, total.yoyCount);
  total.ytdChange = pctChange(total.ytd, total.ytdPrev);
  total.debtors = Object.fromEntries(["company", "or731b", "person", "estate"].map((k) => [k, sum(rows.map((r) => r.debtors[k]))]));
  const ge = rows.find((r) => r.canton === "GE");
  const trend = trendMonths.map((m) => ({
    month: m,
    ge: bankruptcies(snapshot, m, "GE"),
    total: sum(CANTONS.map((c) => bankruptcies(snapshot, m, c))),
    suspensions: sum(CANTONS.map((c) => snapshot.monthly[m].kk03[c])),
  }));
  return {
    T, prev, yoy, year, ytdFirst: ytdMonths[0], r12First: r12Months[0], rows, total, ge,
    geShare: share(ge.count, total.count), trend,
  };
}

const FAILLITES_TEXT = {
  fr: {
    title: (b, L) => `Faillites à Genève et en Suisse romande : ${L.month}`,
    description: (b, L) => `${L.n(b.total.count)} faillites publiées en Suisse romande en ${L.month}, dont ${L.n(b.ge.count)} à Genève. Chiffres par canton, sociétés, particuliers et successions, d'après la FOSC.`,
    intro: (b, L) => `En ${L.month}, la Feuille officielle suisse du commerce (FOSC) a publié **${L.n(b.total.count)} procédures de faillite** dans les six cantons romands (Genève, Vaud, Valais, Neuchâtel, Fribourg et Jura), dont **${L.n(b.ge.count)} à Genève**. Ce total additionne les publications de faillite avec appel aux créanciers (${L.n(b.total.kk02)}) et les suspensions de faillite faute d'actif (${L.n(b.total.kk03)}). Ces deux types de publications sont utilisés de la même manière dans tous les cantons, ce qui permet de les comparer. Il s'agit d'un comptage de publications, pas de débiteurs distincts.\n\nLes offices des faillites publient souvent par lots : d'un mois à l'autre, les chiffres peuvent varier fortement sans changement de fond. Pour suivre la tendance, le cumul sur douze mois est plus fiable que le chiffre d'un seul mois. Sur douze mois (${L.monthOnly(b.r12First)} ${b.r12First.slice(0, 4)} à ${L.month}), ${L.n(b.total.r12)} faillites ont été publiées en Suisse romande, ${L.trend(b.total.r12Change)} par rapport aux douze mois précédents.\n\nPour le seul mois de ${L.month}, ${L.n(b.total.debtors.company)} procédures concernent des sociétés, ${L.n(b.total.debtors.person)} des particuliers et ${L.n(b.total.debtors.estate)} des successions. Ce baromètre d'Ark Fiduciaire est calculé automatiquement à partir des publications officielles et mis à jour chaque mois ; la méthode et l'historique complet à télécharger figurent en fin d'article.`,
    hKey: (b, L) => `## Les chiffres clés de ${L.month}`,
    key: (b, L) => [
      `- **${L.n(b.total.r12)}** faillites publiées en Suisse romande sur douze mois, ${L.trend(b.total.r12Change)} par rapport aux douze mois précédents (${L.n(b.total.r12Prev)}).`,
      `- **${L.n(b.ge.r12)}** à Genève sur douze mois, ${L.trend(b.ge.r12Change)} (${L.n(b.ge.r12Prev)} les douze mois précédents).`,
      `- En ${L.month} : ${L.n(b.total.count)} faillites publiées en Suisse romande, dont ${L.n(b.ge.count)} à Genève (${L.n(b.total.prevCount)} en ${L.prevMonth}, ${L.n(b.total.yoyCount)} en ${L.yoyMonth}).`,
      `- ${L.n(b.total.kk03)} procédures suspendues faute d'actif, soit ${L.p(L.share(b.total.kk03, b.total.count), false)} du total.`,
      `- ${L.n(b.total.debtors.company)} faillites de sociétés, dont ${L.n(b.total.debtors.or731b)} liquidations ordonnées pour carences dans l'organisation (art. 731b CO).`,
      `- Depuis janvier, ${L.n(b.total.ytd)} faillites publiées, ${L.trend(b.total.ytdChange)} par rapport à la même période de ${b.year - 1} (${L.n(b.total.ytdPrev)}).`,
    ].join("\n"),
    hCanton: () => "## Faillites par canton",
    cantonIntro: (b, L) => `Le tableau donne les faillites publiées en ${L.month}, le mois précédent et le même mois de l'année passée, puis le cumul sur douze mois comparé aux douze mois précédents.`,
    cantonHead: (b, L) => ["Canton", L.monthShort(b.T), L.monthShort(b.prev), L.monthShort(b.yoy), "dont suspensions faute d'actif", "12 mois", "12 mois précédents", "Var. sur 12 mois"],
    totalLabel: "Suisse romande",
    cantonOutro: () => "Les chiffres mensuels dépendent du rythme de publication de chaque office ; seule la variation sur douze mois est calculée en pourcentage.",
    hDebtor: () => "## Sociétés, particuliers et successions",
    debtorIntro: (b, L) => `Le type de débiteur est lu dans le champ structuré de chaque publication. Les successions comprennent les successions répudiées par les héritiers, que l'office des faillites liquide. En ${L.month}, ${L.n(b.total.debtors.estate)} faillites romandes concernaient une succession.`,
    hYtd: (b, L) => `## Depuis le début de l'année (${L.monthOnly(b.ytdFirst)} à ${L.month})`,
    ytdHead: (b) => ["Canton", `Faillites ${b.year}`, `Faillites ${b.year - 1}`, "Variation"],
    hTrend: () => "## Évolution sur treize mois",
    trendIntro: () => "Faillites publiées chaque mois à Genève et dans l'ensemble des six cantons romands, avec le nombre de suspensions faute d'actif.",
    trendHead: () => ["Mois", "Genève", "Suisse romande", "dont suspensions (Suisse romande)"],
    hMeaning: () => "## Comment lire ces chiffres",
    meaning: () => [
      "Une faillite publiée ne correspond pas toujours à la disparition d'une entreprise active. Une part importante des procédures est suspendue faute d'actif (art. 230 LP) : l'office constate que les biens ne suffisent pas à couvrir les frais de la procédure, qui s'arrête, sauf si un créancier avance les frais.",
      "Les comparaisons sur un an doivent aussi tenir compte de la révision de la loi sur la poursuite pour dettes et la faillite (LP) entrée en vigueur le 1er janvier 2025 contre l'usage abusif de la faillite : depuis cette date, les créances de droit public, comme les impôts et les cotisations sociales, sont en principe poursuivies par voie de faillite contre les débiteurs inscrits au registre du commerce, et non plus par voie de saisie. Une partie de la hausse observée depuis 2025 peut en découler.",
      "Les successions répudiées par les héritiers sont liquidées par l'office des faillites (art. 193 LP) et apparaissent donc dans ces chiffres, sans lien avec une activité économique. De même, une société dont l'organisation est incomplète peut être dissoute par le juge et liquidée selon les règles de la faillite (art. 731b CO).",
      "Pour un dirigeant, les signes de difficulté apparaissent bien avant la faillite : liquidités tendues, perte de capital, surendettement. En cas de surendettement, le conseil d'administration doit en principe aviser le juge (art. 725b CO). Ark Fiduciaire accompagne les sociétés à Genève dans leur [gestion courante et leurs décisions sociales](/services/corporate). Pour une question précise, [contactez-nous](/contact).",
    ].join("\n\n"),
    hMethod: () => "## Méthodologie",
    method: (b, L, S) => [
      `- **Source** : publications de la [Feuille officielle suisse du commerce (FOSC)](${PORTAL_URL}), rubrique faillites, extraites via l'interface publique du portail le ${L.date(S.fetchedAt)}.`,
      "- **Faillites** : publications des sous-rubriques KK02 (« publication de faillite/appel aux créanciers ») et KK03 (« suspension de la procédure de faillite ») des six cantons romands.",
      "- **Pourquoi pas les avis d'ouverture** : la sous-rubrique KK01 (« avis préalable d'ouverture de faillite ») est utilisée très inégalement selon les cantons, presque systématiquement à Genève et rarement ailleurs. Elle ne permet pas de comparer les cantons.",
      "- **Date retenue** : la date de publication dans la FOSC, qui suit de quelques semaines le jugement de faillite.",
      "- **Comptage** : une publication compte pour une procédure. Une procédure suspendue puis reprise après une avance de frais, ou une publication rectifiée, peut être comptée deux fois ; ces cas sont rares.",
      `- **Contrôles** : ${L.n(S.quality.kk02Publications)} publications KK02 et ${L.n(S.quality.kk03Publications)} publications KK03 traitées sur la période couverte ; ${L.n(S.quality.bankruptcyDetailsParsed)} publications du mois lues en détail ; ${L.n(S.quality.bankruptcyCompanyUidDuplicates)} doublon d'IDE de société détecté ; ${L.n(S.quality.bankruptcyFreeTextQualifications)} publication(s) avec une mention libre sur le débiteur, classée(s) en succession si le texte l'indique, sinon en particulier.`,
      "- **Données personnelles** : le rapport ne publie que des agrégats. Aucun nom de personne ni d'entreprise n'est repris.",
      "- **Révisions** : une publication annulée ou corrigée après l'extraction peut modifier légèrement les chiffres.",
    ].join("\n"),
    hCite: () => "## Citer ces données",
    cite: (b, L, S, slug) => `Les journalistes et chercheurs peuvent reprendre ces chiffres en citant la source :\n\n> Ark Fiduciaire, « Faillites à Genève et en Suisse romande, statistiques mensuelles », d'après la Feuille officielle suisse du commerce (FOSC), données de ${L.month}. ${articleUrl("fr", slug)}\n\nDonnées au format CSV : [historique complet](${PAGES.faillites.csvHistory}) et [${L.month}](${PAGES.faillites.csvMonth(b.T)}).`,
    hSeeAlso: () => "## Voir aussi",
    seeAlso: () => [
      `- [Créations d'entreprises à Genève et en Suisse romande : statistiques mensuelles](/ressources/articles/${PAGES.creations.slug})`,
      "- [Risques de faillite : la responsabilité des administrateurs](/ressources/articles/risques-faillite-administrateurs)",
      "- [Liquidation d'une société en Suisse](/ressources/articles/liquidation-societe-suisse)",
      "- [Gestion de société avec Ark Fiduciaire](/services/corporate)",
    ].join("\n"),
    refs: [
      ["Feuille officielle suisse du commerce (FOSC) – portail des publications", PORTAL_URL],
      ["Loi fédérale sur la poursuite pour dettes et la faillite (LP, RS 281.1) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/11/529_488_529/fr"],
      ["Code des obligations (CO, RS 220) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr"],
    ],
  },
  en: {
    title: (b, L) => `Bankruptcies in Geneva and Romandie: ${L.month}`,
    description: (b, L) => `${L.n(b.total.count)} bankruptcies published in French-speaking Switzerland in ${L.month}, including ${L.n(b.ge.count)} in Geneva. Figures by canton, companies, individuals and estates, based on the SOGC.`,
    intro: (b, L) => `In ${L.month}, the Swiss Official Gazette of Commerce (SOGC) published **${L.n(b.total.count)} bankruptcy proceedings** across the six French-speaking cantons (Geneva, Vaud, Valais, Neuchâtel, Fribourg and Jura), including **${L.n(b.ge.count)} in Geneva**. The total adds up bankruptcy publications with a call to creditors (${L.n(b.total.kk02)}) and suspensions for lack of assets (${L.n(b.total.kk03)}). Every canton uses these two types of publication in the same way, which makes them comparable. This is a count of publications, not of distinct debtors.\n\nBankruptcy offices often publish in batches, so monthly figures can swing sharply without any underlying change. The twelve-month total is a more reliable guide to the trend than any single month. Over twelve months (${L.monthOnly(b.r12First)} ${b.r12First.slice(0, 4)} to ${L.month}), ${L.n(b.total.r12)} bankruptcies were published in French-speaking Switzerland, ${L.trend(b.total.r12Change)} on the previous twelve months.\n\nFor ${L.month} alone, ${L.n(b.total.debtors.company)} proceedings concern companies, ${L.n(b.total.debtors.person)} individuals and ${L.n(b.total.debtors.estate)} estates. This barometer by Ark Fiduciaire is computed automatically from the official publications and updated every month; the method and the full downloadable history are at the end of the article.`,
    hKey: (b, L) => `## Key figures for ${L.month}`,
    key: (b, L) => [
      `- **${L.n(b.total.r12)}** bankruptcies published in French-speaking Switzerland over twelve months, ${L.trend(b.total.r12Change)} on the previous twelve months (${L.n(b.total.r12Prev)}).`,
      `- **${L.n(b.ge.r12)}** in Geneva over twelve months, ${L.trend(b.ge.r12Change)} (${L.n(b.ge.r12Prev)} in the previous twelve months).`,
      `- In ${L.month}: ${L.n(b.total.count)} bankruptcies published in the region, including ${L.n(b.ge.count)} in Geneva (${L.n(b.total.prevCount)} in ${L.prevMonth}, ${L.n(b.total.yoyCount)} in ${L.yoyMonth}).`,
      `- ${L.n(b.total.kk03)} proceedings suspended for lack of assets, ${L.p(L.share(b.total.kk03, b.total.count), false)} of the total.`,
      `- ${L.n(b.total.debtors.company)} company bankruptcies, including ${L.n(b.total.debtors.or731b)} liquidations ordered for organisational deficiencies (art. 731b CO).`,
      `- Since January, ${L.n(b.total.ytd)} bankruptcies published, ${L.trend(b.total.ytdChange)} on the same period of ${b.year - 1} (${L.n(b.total.ytdPrev)}).`,
    ].join("\n"),
    hCanton: () => "## Bankruptcies by canton",
    cantonIntro: (b, L) => `The table gives bankruptcies published in ${L.month}, the previous month and the same month last year, then the twelve-month total compared with the previous twelve months.`,
    cantonHead: (b, L) => ["Canton", L.monthShort(b.T), L.monthShort(b.prev), L.monthShort(b.yoy), "of which suspended for lack of assets", "12 months", "Previous 12 months", "12-month change"],
    totalLabel: "French-speaking Switzerland",
    cantonOutro: () => "Monthly figures depend on each office's publication rhythm; only the twelve-month change is given as a percentage.",
    hDebtor: () => "## Companies, individuals and estates",
    debtorIntro: (b, L) => `The type of debtor is read from the structured field of each publication. Estates include estates renounced by the heirs, which the bankruptcy office liquidates. In ${L.month}, ${L.n(b.total.debtors.estate)} bankruptcies in the region concerned an estate.`,
    hYtd: (b, L) => `## Year to date (${L.monthOnly(b.ytdFirst)} to ${L.month})`,
    ytdHead: (b) => ["Canton", `Bankruptcies ${b.year}`, `Bankruptcies ${b.year - 1}`, "Change"],
    hTrend: () => "## Thirteen-month trend",
    trendIntro: () => "Bankruptcies published each month in Geneva and across the six French-speaking cantons, with the number of suspensions for lack of assets.",
    trendHead: () => ["Month", "Geneva", "French-speaking Switzerland", "of which suspended (French-speaking Switzerland)"],
    hMeaning: () => "## How to read these figures",
    meaning: () => [
      "A published bankruptcy does not always mean that an active business disappears. A large share of proceedings is suspended for lack of assets (art. 230 DEBA): the office finds that the assets do not cover the costs of the proceedings, which stop unless a creditor advances the costs.",
      "Year-on-year comparisons should also take into account the revision of the Debt Enforcement and Bankruptcy Act (DEBA) against the abusive use of bankruptcy, in force since 1 January 2025: since then, public-law claims such as taxes and social contributions are in principle enforced by bankruptcy, rather than by seizure, against debtors entered in the commercial register. Part of the increase seen since 2025 may stem from this.",
      "Estates renounced by the heirs are liquidated by the bankruptcy office (art. 193 DEBA) and therefore appear in these figures, with no link to any business activity. Likewise, a company whose organisation is incomplete can be dissolved by the court and liquidated under bankruptcy rules (art. 731b CO).",
      "For directors, warning signs appear well before bankruptcy: tight liquidity, capital loss, over-indebtedness. In case of over-indebtedness, the board must in principle notify the court (art. 725b CO). Ark Fiduciaire supports companies in Geneva with their [day-to-day corporate matters](/services/corporate). For a specific question, [get in touch](/contact).",
    ].join("\n\n"),
    hMethod: () => "## Methodology",
    method: (b, L, S) => [
      `- **Source**: publications of the [Swiss Official Gazette of Commerce (SOGC)](${PORTAL_URL}), bankruptcy heading, retrieved through the portal's public interface on ${L.date(S.fetchedAt)}.`,
      "- **Bankruptcies**: publications under sub-headings KK02 (\"publication of bankruptcy/call to creditors\") and KK03 (\"suspension of bankruptcy proceedings\") of the six French-speaking cantons.",
      "- **Why not opening notices**: sub-heading KK01 (\"preliminary notice of the opening of bankruptcy\") is used very unevenly by the cantons, almost systematically in Geneva and rarely elsewhere, so it cannot be used to compare cantons.",
      "- **Date used**: the SOGC publication date, which comes a few weeks after the bankruptcy judgment.",
      "- **Counting**: one publication counts as one proceeding. A proceeding suspended and later resumed after a cost advance, or a corrected publication, can be counted twice; such cases are rare.",
      `- **Checks**: ${L.n(S.quality.kk02Publications)} KK02 and ${L.n(S.quality.kk03Publications)} KK03 publications processed over the period covered; ${L.n(S.quality.bankruptcyDetailsParsed)} publications of the month read in full; ${L.n(S.quality.bankruptcyCompanyUidDuplicates)} duplicate company UID detected; ${L.n(S.quality.bankruptcyFreeTextQualifications)} publication(s) with a free-text debtor qualification, classed as an estate when the text says so, otherwise as an individual.`,
      "- **Personal data**: the report only publishes aggregates. No names of people or companies are included.",
      "- **Revisions**: a publication cancelled or corrected after retrieval may slightly change the figures.",
    ].join("\n"),
    hCite: () => "## Cite this data",
    cite: (b, L, S, slug) => `Journalists and researchers may use these figures with the following attribution:\n\n> Ark Fiduciaire, "Bankruptcies in Geneva and French-speaking Switzerland, monthly statistics", based on the Swiss Official Gazette of Commerce (SOGC), data for ${L.month}. ${articleUrl("en", slug)}\n\nData in CSV format: [full history](${PAGES.faillites.csvHistory}) and [${L.month}](${PAGES.faillites.csvMonth(b.T)}).`,
    hSeeAlso: () => "## See also",
    seeAlso: () => [
      `- [New companies in Geneva and French-speaking Switzerland: monthly statistics](/ressources/articles/${PAGES.creations.slug})`,
      "- [Bankruptcy risks: directors' liability](/ressources/articles/risques-faillite-administrateurs)",
      "- [Liquidating a company in Switzerland](/ressources/articles/liquidation-societe-suisse)",
      "- [Corporate services with Ark Fiduciaire](/services/corporate)",
    ].join("\n"),
    refs: [
      ["Swiss Official Gazette of Commerce (SOGC) – publications portal", PORTAL_URL],
      ["Debt Enforcement and Bankruptcy Act (DEBA, SR 281.1) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/11/529_488_529/en"],
      ["Code of Obligations (CO, SR 220) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/en"],
    ],
  },
  de: {
    title: (b, L) => `Konkurse in Genf und der Romandie: ${L.month}`,
    description: (b, L) => `${L.n(b.total.count)} publizierte Konkurse in der Westschweiz im ${L.month}, davon ${L.n(b.ge.count)} in Genf. Zahlen nach Kanton, Gesellschaften, Privatpersonen und Nachlässen, gestützt auf das SHAB.`,
    intro: (b, L) => `Im ${L.month} veröffentlichte das Schweizerische Handelsamtsblatt (SHAB) **${L.n(b.total.count)} Konkursverfahren** in den sechs Westschweizer Kantonen (Genf, Waadt, Wallis, Neuenburg, Freiburg und Jura), davon **${L.n(b.ge.count)} in Genf**. Das Total umfasst Konkurspublikationen mit Schuldenruf (${L.n(b.total.kk02)}) und Einstellungen mangels Aktiven (${L.n(b.total.kk03)}). Alle Kantone verwenden diese beiden Publikationsarten gleich, was Vergleiche erlaubt. Gezählt werden Publikationen, nicht einzelne Schuldner.\n\nDie Konkursämter publizieren oft gebündelt; die Monatszahlen können daher stark schwanken, ohne dass sich die Lage ändert. Für die Entwicklung ist die Summe über zwölf Monate verlässlicher als ein einzelner Monat. Über zwölf Monate (${L.monthOnly(b.r12First)} ${b.r12First.slice(0, 4)} bis ${L.month}) wurden in der Westschweiz ${L.n(b.total.r12)} Konkurse publiziert, gegenüber den zwölf Monaten davor ${L.trend(b.total.r12Change)}.\n\nVon den Verfahren im ${L.month} betreffen ${L.n(b.total.debtors.company)} Verfahren Gesellschaften, ${L.n(b.total.debtors.person)} Privatpersonen und ${L.n(b.total.debtors.estate)} Nachlässe. Dieses Barometer von Ark Fiduciaire wird automatisch aus den amtlichen Publikationen berechnet und monatlich aktualisiert; Methode und vollständige Zeitreihe zum Herunterladen finden sich am Ende des Artikels.`,
    hKey: (b, L) => `## Die wichtigsten Zahlen für ${L.month}`,
    key: (b, L) => [
      `- **${L.n(b.total.r12)}** publizierte Konkurse in der Westschweiz über zwölf Monate, gegenüber den zwölf Monaten davor (${L.n(b.total.r12Prev)}) ${L.trend(b.total.r12Change)}.`,
      `- **${L.n(b.ge.r12)}** in Genf über zwölf Monate, ${L.trend(b.ge.r12Change)} (${L.n(b.ge.r12Prev)} in den zwölf Monaten davor).`,
      `- Im ${L.month}: ${L.n(b.total.count)} publizierte Konkurse in der Westschweiz, davon ${L.n(b.ge.count)} in Genf (${L.n(b.total.prevCount)} im ${L.prevMonth}, ${L.n(b.total.yoyCount)} im ${L.yoyMonth}).`,
      `- ${L.n(b.total.kk03)} Verfahren mangels Aktiven eingestellt, das sind ${L.p(L.share(b.total.kk03, b.total.count), false)} des Totals.`,
      `- ${L.n(b.total.debtors.company)} Konkurse von Gesellschaften, davon ${L.n(b.total.debtors.or731b)} wegen Organisationsmängeln angeordnete Liquidationen (Art. 731b OR).`,
      `- Seit Januar ${L.n(b.total.ytd)} publizierte Konkurse, gegenüber dem gleichen Zeitraum ${b.year - 1} (${L.n(b.total.ytdPrev)}) ${L.trend(b.total.ytdChange)}.`,
    ].join("\n"),
    hCanton: () => "## Konkurse nach Kanton",
    cantonIntro: (b, L) => `Die Tabelle zeigt die im ${L.month} publizierten Konkurse, den Vormonat und den gleichen Monat des Vorjahres, dann die Summe über zwölf Monate im Vergleich zu den zwölf Monaten davor.`,
    cantonHead: (b, L) => ["Kanton", L.monthShort(b.T), L.monthShort(b.prev), L.monthShort(b.yoy), "davon Einstellungen mangels Aktiven", "12 Monate", "12 Monate davor", "Veränderung über 12 Monate"],
    totalLabel: "Westschweiz",
    cantonOutro: () => "Die Monatszahlen hängen vom Publikationsrhythmus der einzelnen Ämter ab; nur die Veränderung über zwölf Monate wird in Prozent angegeben.",
    hDebtor: () => "## Gesellschaften, Privatpersonen und Nachlässe",
    debtorIntro: (b, L) => `Die Art des Schuldners wird aus dem strukturierten Feld jeder Publikation gelesen. Nachlässe umfassen von den Erben ausgeschlagene Erbschaften, die das Konkursamt liquidiert. Im ${L.month} betrafen ${L.n(b.total.debtors.estate)} Westschweizer Konkurse einen Nachlass.`,
    hYtd: (b, L) => `## Seit Jahresbeginn (${L.monthOnly(b.ytdFirst)} bis ${L.month})`,
    ytdHead: (b) => ["Kanton", `Konkurse ${b.year}`, `Konkurse ${b.year - 1}`, "Veränderung"],
    hTrend: () => "## Entwicklung über dreizehn Monate",
    trendIntro: () => "Monatlich publizierte Konkurse in Genf und in den sechs Westschweizer Kantonen insgesamt, mit der Zahl der Einstellungen mangels Aktiven.",
    trendHead: () => ["Monat", "Genf", "Westschweiz", "davon Einstellungen (Westschweiz)"],
    hMeaning: () => "## So sind diese Zahlen zu lesen",
    meaning: () => [
      "Ein publizierter Konkurs bedeutet nicht immer, dass ein aktives Unternehmen verschwindet. Ein grosser Teil der Verfahren wird mangels Aktiven eingestellt (Art. 230 SchKG): Das Amt stellt fest, dass das Vermögen die Verfahrenskosten nicht deckt, und das Verfahren endet, sofern kein Gläubiger die Kosten vorschiesst.",
      "Bei Vergleichen über ein Jahr ist zudem die seit dem 1. Januar 2025 geltende Revision des Bundesgesetzes über Schuldbetreibung und Konkurs (SchKG) gegen den missbräuchlichen Konkurs zu berücksichtigen: Seither werden öffentlich-rechtliche Forderungen wie Steuern und Sozialversicherungsbeiträge gegenüber im Handelsregister eingetragenen Schuldnern grundsätzlich auf Konkurs und nicht mehr auf Pfändung betrieben. Ein Teil des Anstiegs seit 2025 kann darauf zurückgehen.",
      "Von den Erben ausgeschlagene Erbschaften werden vom Konkursamt liquidiert (Art. 193 SchKG) und erscheinen daher in diesen Zahlen, ohne Bezug zu einer Geschäftstätigkeit. Ebenso kann eine Gesellschaft mit mangelhafter Organisation vom Gericht aufgelöst und nach den Vorschriften über den Konkurs liquidiert werden (Art. 731b OR).",
      "Für Geschäftsleitungen zeigen sich Warnsignale lange vor dem Konkurs: knappe Liquidität, Kapitalverlust, Überschuldung. Bei Überschuldung muss der Verwaltungsrat grundsätzlich das Gericht benachrichtigen (Art. 725b OR). Ark Fiduciaire begleitet Gesellschaften in Genf bei [laufenden gesellschaftsrechtlichen Fragen](/services/corporate). Bei konkreten Fragen [kontaktieren Sie uns](/contact).",
    ].join("\n\n"),
    hMethod: () => "## Methodik",
    method: (b, L, S) => [
      `- **Quelle**: Publikationen des [Schweizerischen Handelsamtsblatts (SHAB)](${PORTAL_URL}), Rubrik Konkurse, über die öffentliche Schnittstelle des Portals abgerufen am ${L.date(S.fetchedAt)}.`,
      "- **Konkurse**: Publikationen der Unterrubriken KK02 („Konkurspublikation/Schuldenruf“) und KK03 („Einstellung des Konkursverfahrens“) der sechs Westschweizer Kantone.",
      "- **Warum nicht die Eröffnungsanzeigen**: Die Unterrubrik KK01 („vorläufige Konkursanzeige“) wird von den Kantonen sehr unterschiedlich genutzt, in Genf fast systematisch, anderswo selten. Sie eignet sich daher nicht für Vergleiche zwischen Kantonen.",
      "- **Massgebendes Datum**: das Publikationsdatum im SHAB, das einige Wochen nach dem Konkursentscheid liegt.",
      "- **Zählung**: Eine Publikation gilt als ein Verfahren. Ein eingestelltes und nach einem Kostenvorschuss wieder aufgenommenes Verfahren oder eine berichtigte Publikation kann doppelt gezählt werden; solche Fälle sind selten.",
      `- **Kontrollen**: ${L.n(S.quality.kk02Publications)} KK02- und ${L.n(S.quality.kk03Publications)} KK03-Publikationen im abgedeckten Zeitraum verarbeitet; ${L.n(S.quality.bankruptcyDetailsParsed)} Publikationen des Monats vollständig gelesen; ${L.n(S.quality.bankruptcyCompanyUidDuplicates)} doppelte UID einer Gesellschaft festgestellt; ${L.n(S.quality.bankruptcyFreeTextQualifications)} Publikation(en) mit freiem Zusatz zum Schuldner, als Nachlass gezählt, wenn der Text dies angibt, sonst als Privatperson.`,
      "- **Personendaten**: Der Bericht veröffentlicht nur aggregierte Zahlen. Es werden keine Namen von Personen oder Unternehmen genannt.",
      "- **Revisionen**: Eine nach dem Abruf annullierte oder berichtigte Publikation kann die Zahlen leicht verändern.",
    ].join("\n"),
    hCite: () => "## Diese Daten zitieren",
    cite: (b, L, S, slug) => `Journalistinnen, Journalisten und Forschende können diese Zahlen mit folgender Quellenangabe verwenden:\n\n> Ark Fiduciaire, „Konkurse in Genf und der Westschweiz, monatliche Statistik“, gestützt auf das Schweizerische Handelsamtsblatt (SHAB), Daten für ${L.month}. ${articleUrl("de", slug)}\n\nDaten im CSV-Format: [vollständige Zeitreihe](${PAGES.faillites.csvHistory}) und [${L.month}](${PAGES.faillites.csvMonth(b.T)}).`,
    hSeeAlso: () => "## Siehe auch",
    seeAlso: () => [
      `- [Firmengründungen in Genf und der Westschweiz: monatliche Statistik](/ressources/articles/${PAGES.creations.slug})`,
      "- [Konkursrisiken: die Haftung der Verwaltungsräte](/ressources/articles/risques-faillite-administrateurs)",
      "- [Liquidation einer Gesellschaft in der Schweiz](/ressources/articles/liquidation-societe-suisse)",
      "- [Gesellschaftsrechtliche Dienstleistungen von Ark Fiduciaire](/services/corporate)",
    ].join("\n"),
    refs: [
      ["Schweizerisches Handelsamtsblatt (SHAB) – Publikationsportal", PORTAL_URL],
      ["Bundesgesetz über Schuldbetreibung und Konkurs (SchKG, SR 281.1) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/11/529_488_529/de"],
      ["Obligationenrecht (OR, SR 220) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/de"],
    ],
  },
};

const FAILLITES_TAGS = ["faillite", "poursuites", "statistiques", "geneve", "suisse-romande", "fosc"];

function bankruptcyHelpers(locale, b) {
  const L = helpers(locale, b);
  return L;
}

/** Renders the bankruptcies page for one locale. Pure function of (locale, snapshot). */
function renderFaillites(locale, snapshot, { date } = {}) {
  const t = FAILLITES_TEXT[locale];
  if (!t) throw new Error(`Unsupported locale ${locale}`);
  const b = computeBankruptcyFigures(snapshot);
  const L = bankruptcyHelpers(locale, b);
  const slug = PAGES.faillites.slug;
  const D = DEBTOR_LABELS[locale];
  const label = (r) => (r.canton !== "total" ? L.canton(r.canton) : `**${t.totalLabel}**`);
  const all = [...b.rows, b.total];

  const cantonRows = all.map((r) => [
    label(r), L.n(r.count), L.n(r.prevCount), L.n(r.yoyCount), L.n(r.kk03), L.n(r.r12), L.n(r.r12Prev), L.p(r.r12Change),
  ]);
  const debtorHead = [t.cantonHead(b, L)[0], D.company, D.or731b, D.person, D.estate, "Total"];
  const debtorRows = all.map((r) => [
    label(r), L.n(r.debtors.company), L.n(r.debtors.or731b), L.n(r.debtors.person), L.n(r.debtors.estate), L.n(r.count),
  ]);
  const ytdRows = all.map((r) => [label(r), L.n(r.ytd), L.n(r.ytdPrev), L.p(r.ytdChange)]);
  const trendRows = b.trend.map((m) => [L.monthShort(m.month), L.n(m.ge), L.n(m.total), L.n(m.suspensions)]);

  const content = [
    t.intro(b, L),
    t.hKey(b, L),
    t.key(b, L),
    t.hCanton(b, L),
    t.cantonIntro(b, L),
    table(t.cantonHead(b, L), cantonRows, ["l", "r", "r", "r", "r", "r", "r", "r"]),
    t.cantonOutro(b, L),
    t.hDebtor(b, L),
    t.debtorIntro(b, L),
    table(debtorHead, debtorRows, ["l", ...debtorHead.slice(1).map(() => "r")]),
    t.hYtd(b, L),
    table(t.ytdHead(b, L), ytdRows, ["l", "r", "r", "r"]),
    t.hTrend(b, L),
    t.trendIntro(b, L),
    table(t.trendHead(b, L), trendRows, ["l", "r", "r", "r"]),
    t.hMeaning(b, L),
    t.meaning(b, L),
    t.hMethod(b, L),
    t.method(b, L, snapshot),
    t.hCite(b, L),
    t.cite(b, L, snapshot, slug),
    t.hSeeAlso(b, L),
    t.seeAlso(b, L),
  ].join("\n\n");

  return {
    slug,
    title: t.title(b, L),
    description: t.description(b, L),
    content,
    author: "Ark Fiduciaire",
    date,
    category: "corporate",
    tags: FAILLITES_TAGS.slice(),
    references: t.refs.map(([labelKey, url]) => ({ labelKey, url })),
    series: PAGES.faillites.series,
    reportMonth: snapshot.reportMonth,
  };
}

// ---------- highlights ----------

const HIGHLIGHT_TEXT = {
  fr: (L, c, r, k) => `${L.canton(c)} : ${L.n(r.creations)} nouvelles inscriptions au registre du commerce en ${L.month} (${L.p(r.mom)} sur un mois, ${L.p(r.yoy)} sur un an), ${L.n(r.deletions)} radiations ; ${L.n(k.r12)} faillites publiées sur douze mois (${L.p(k.r12Change)} par rapport aux douze mois précédents).`,
  en: (L, c, r, k) => `${L.canton(c)}: ${L.n(r.creations)} new commercial register entries in ${L.month} (${L.p(r.mom)} month on month, ${L.p(r.yoy)} year on year), ${L.n(r.deletions)} deletions; ${L.n(k.r12)} bankruptcies published over twelve months (${L.p(k.r12Change)} on the previous twelve months).`,
  de: (L, c, r, k) => `${L.canton(c)}: ${L.n(r.creations)} Neueintragungen im Handelsregister im ${L.month} (${L.p(r.mom)} zum Vormonat, ${L.p(r.yoy)} zum Vorjahr), ${L.n(r.deletions)} Löschungen; ${L.n(k.r12)} publizierte Konkurse über zwölf Monate (${L.p(k.r12Change)} zu den zwölf Monaten davor).`,
};

/** One deterministic sentence per canton and locale, for cantonal press pitches. */
function renderHighlights(snapshot) {
  const f = computeFigures(snapshot);
  const b = computeBankruptcyFigures(snapshot);
  const out = {};
  for (const locale of LOCALES) {
    const L = helpers(locale, f);
    out[locale] = Object.fromEntries(
      CANTONS.map((c) => [c, HIGHLIGHT_TEXT[locale](L, c, f.rows.find((r) => r.canton === c), b.rows.find((r) => r.canton === c))]),
    );
  }
  return out;
}

// ---------- CSV ----------

function csvLines(header, rows) {
  return [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n") + "\n";
}

/** Per-month bankruptcies CSV (one row per canton). */
function renderFaillitesCsv(snapshot) {
  const b = computeBankruptcyFigures(snapshot);
  const header = [
    "report_month", "canton", "bankruptcies", "bankruptcies_prev_month", "bankruptcies_same_month_prev_year",
    "publication_kk02", "suspension_kk03", "debtor_company", "debtor_company_art731b", "debtor_person", "debtor_estate",
    "ytd_bankruptcies", "ytd_bankruptcies_prev_year", "rolling_12m_bankruptcies", "rolling_12m_bankruptcies_prev", "source", "retrieved_at",
  ];
  const rows = [...b.rows, { ...b.total, canton: "ROMANDIE" }].map((r) => [
    b.T, r.canton, r.count, r.prevCount, r.yoyCount, r.kk02, r.kk03,
    r.debtors.company, r.debtors.or731b, r.debtors.person, r.debtors.estate,
    r.ytd, r.ytdPrev, r.r12, r.r12Prev, "SOGC/FOSC amtsblattportal.ch (KK02, KK03)", snapshot.fetchedAt,
  ]);
  return csvLines(header, rows);
}

/**
 * Full-history CSVs (long format, month x canton) built from every stored
 * snapshot. Monthly counts come from the most recent snapshot covering the
 * month; breakdowns only exist for each snapshot's own report month.
 */
function renderHistoryCsvs(snapshots) {
  const sorted = [...snapshots].sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));
  const counts = new Map(); // ym -> monthly entry
  const targets = new Map(); // ym -> target
  for (const s of sorted) {
    for (const [ym, m] of Object.entries(s.monthly)) counts.set(ym, m);
    targets.set(s.reportMonth, s.target);
  }
  const months = [...counts.keys()].sort();
  const cre = [];
  const fal = [];
  for (const ym of months) {
    const m = counts.get(ym);
    const t = targets.get(ym);
    for (const c of CANTONS) {
      const lf = t && t.legalForms ? t.legalForms[c] : null;
      cre.push([ym, c, m.hr01[c], m.hr03[c], m.hr01[c] - m.hr03[c], ...LEGAL_FORM_KEYS.map((k) => (lf ? lf[k] : ""))]);
      if (m.kk02 && m.kk03) {
        const d = t && t.debtors ? t.debtors[c] : null;
        fal.push([ym, c, m.kk02[c] + m.kk03[c], m.kk02[c], m.kk03[c], ...["company", "or731b", "person", "estate"].map((k) => (d ? d[k] : ""))]);
      }
    }
  }
  return {
    creations: csvLines(["month", "canton", "new_entries", "deletions", "balance", ...LEGAL_FORM_KEYS.map((k) => `legal_form_${k}`)], cre),
    faillites: csvLines(["month", "canton", "bankruptcies", "publication_kk02", "suspension_kk03", "debtor_company", "debtor_company_art731b", "debtor_person", "debtor_estate"], fal),
  };
}

/** Per-month créations CSV (one row per canton). No names, no identifiers. */
function renderCsv(snapshot) {
  const f = computeFigures(snapshot);
  const header = [
    "report_month", "canton", "new_entries", "new_entries_prev_month", "new_entries_same_month_prev_year",
    "deletions", "balance", ...LEGAL_FORM_KEYS.map((k) => `legal_form_${k}`),
    "ytd_new_entries", "ytd_new_entries_prev_year", "ytd_deletions", "source", "retrieved_at",
  ];
  const lines = [header.join(",")];
  for (const r of [...f.rows, { ...f.total, canton: "ROMANDIE" }]) {
    lines.push([
      f.T, r.canton, r.creations, r.prevCreations, r.yoyCreations, r.deletions, r.net,
      ...LEGAL_FORM_KEYS.map((k) => r.legal[k]),
      r.ytd, r.ytdPrev, r.ytdDeletions, "SOGC/FOSC amtsblattportal.ch (HR01, HR03)", snapshot.fetchedAt,
    ].map(csvCell).join(","));
  }
  return lines.join("\n") + "\n";
}

module.exports = {
  LOCALES,
  CSV_DIR,
  PAGES,
  LEGACY_MONTHLY_SLUG_RE,
  TAGS,
  FAILLITES_TAGS,
  computeFigures,
  computeBankruptcyFigures,
  renderCreations,
  renderFaillites,
  renderHighlights,
  renderCsv,
  renderFaillitesCsv,
  renderHistoryCsvs,
  fmtPct,
  fmtInt,
};
