"use strict";

/**
 * SOGC monthly report: deterministic rendering (article in 5 locales + CSV).
 * Pure functions of the snapshot. Every figure is computed here from the
 * snapshot counts; the prose is fixed template text per locale.
 */

const { CANTONS, LEGAL_FORM_KEYS, PORTAL_URL, SERIES, shiftMonth, monthsBetween } = require("./sogcReport");

const SITE = "https://ark-fid.ch";
const LOCALES = ["fr", "en", "de", "es", "pt"];
const INTL_LOCALE = { fr: "fr-CH", en: "en-GB", de: "de-CH", es: "es-ES", pt: "pt-PT" };
const CSV_DIR = "assets/data/sogc";

const CANTON_NAMES = {
  fr: { GE: "Genève", VD: "Vaud", VS: "Valais", NE: "Neuchâtel", FR: "Fribourg", JU: "Jura" },
  en: { GE: "Geneva", VD: "Vaud", VS: "Valais", NE: "Neuchâtel", FR: "Fribourg", JU: "Jura" },
  de: { GE: "Genf", VD: "Waadt", VS: "Wallis", NE: "Neuenburg", FR: "Freiburg", JU: "Jura" },
  es: { GE: "Ginebra", VD: "Vaud", VS: "Valais", NE: "Neuchâtel", FR: "Friburgo", JU: "Jura" },
  pt: { GE: "Genebra", VD: "Vaud", VS: "Valais", NE: "Neuchâtel", FR: "Friburgo", JU: "Jura" },
};

const LEGAL_FORM_LABELS = {
  fr: { sa: "SA", sarl: "Sàrl", ei: "Raison individuelle", branch: "Succursales", other: "Autres formes" },
  en: { sa: "SA (company limited by shares)", sarl: "Sàrl (LLC)", ei: "Sole proprietorship", branch: "Branches", other: "Other forms" },
  de: { sa: "AG", sarl: "GmbH", ei: "Einzelunternehmen", branch: "Zweigniederlassungen", other: "Andere Rechtsformen" },
  es: { sa: "SA (sociedad anónima)", sarl: "Sàrl (sociedad limitada)", ei: "Empresa individual", branch: "Sucursales", other: "Otras formas" },
  pt: { sa: "SA (sociedade anónima)", sarl: "Sàrl (sociedade por quotas)", ei: "Empresa em nome individual", branch: "Sucursais", other: "Outras formas" },
};

// Legal form as a noun phrase with its article, for running text.
const LEGAL_FORM_NOUNS = {
  fr: { sa: "la SA", sarl: "la Sàrl", ei: "la raison individuelle", branch: "la succursale", other: "une autre forme" },
  en: { sa: "the SA", sarl: "the Sàrl", ei: "the sole proprietorship", branch: "the branch", other: "another form" },
  de: { sa: "die AG", sarl: "die GmbH", ei: "das Einzelunternehmen", branch: "die Zweigniederlassung", other: "eine andere Rechtsform" },
  es: { sa: "la SA", sarl: "la Sàrl", ei: "la empresa individual", branch: "la sucursal", other: "otra forma" },
  pt: { sa: "a SA", sarl: "a Sàrl", ei: "a empresa em nome individual", branch: "a sucursal", other: "outra forma" },
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
  es: {
    holding: "Holdings y participaciones", trade: "Comercio y trading", finance: "Finanzas, fiduciaria y seguros",
    realestate: "Inmobiliario y construcción", it: "Informática y digital", transport: "Transporte y logística",
    automotive: "Automoción y talleres", health: "Salud, belleza y bienestar", hospitality: "Restauración y hostelería",
    education: "Formación, cultura y eventos", consulting: "Consultoría y servicios a empresas", unclassified: "Sin clasificar",
  },
  pt: {
    holding: "Holdings e participações", trade: "Comércio e trading", finance: "Finanças, fiduciária e seguros",
    realestate: "Imobiliário e construção", it: "Informática e digital", transport: "Transporte e logística",
    automotive: "Automóvel e oficinas", health: "Saúde, beleza e bem-estar", hospitality: "Restauração e hotelaria",
    education: "Formação, cultura e eventos", consulting: "Consultoria e serviços a empresas", unclassified: "Não classificado",
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
  const space = locale === "fr" || locale === "de" || locale === "es" || locale === "pt" ? " " : "";
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

function reportSlug(reportMonth) {
  const name = stripAccents(monthOnly("fr", reportMonth)).toLowerCase();
  return `creations-entreprises-geneve-suisse-romande-${name}-${reportMonth.slice(0, 4)}`;
}

function csvFileName(reportMonth) {
  return `creations-entreprises-suisse-romande-${reportMonth}.csv`;
}

function csvPath(reportMonth) {
  return `/${CSV_DIR}/${csvFileName(reportMonth)}`;
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
    title: (f, L) => `Créations d'entreprises à Genève et en Suisse romande : ${L.month}`,
    description: (f, L) => `${L.n(f.total.creations)} nouvelles inscriptions au registre du commerce en Suisse romande en ${L.month}, dont ${L.n(f.ge.creations)} à Genève. Chiffres par canton, formes juridiques et radiations, d'après la FOSC.`,
    trend: (v, L) => (v === null ? "sans base de comparaison" : v > 0 ? `en hausse de ${L.p(v, false)}` : v < 0 ? `en baisse de ${L.p(v, false)}` : "stable"),
    intro: (f, L) => `En ${L.month}, la Feuille officielle suisse du commerce (FOSC) a publié **${L.n(f.total.creations)} nouvelles inscriptions** au registre du commerce dans les six cantons romands (Genève, Vaud, Valais, Neuchâtel, Fribourg et Jura), dont **${L.n(f.ge.creations)} à Genève**. Sur la même période, ${L.n(f.total.deletions)} radiations ont été publiées, soit un solde de ${L.s(f.total.net)} entités inscrites.\n\nCe baromètre mensuel d'Ark Fiduciaire est calculé automatiquement à partir des publications officielles de la FOSC. Les chiffres ne sont ni estimés ni extrapolés : ce sont des comptages de publications, détaillés par canton et par forme juridique. La méthode est décrite en fin d'article, avec les données téléchargeables.\n\nUne nouvelle inscription n'est pas toujours une nouvelle entreprise : le total comprend ${L.n(f.total.legal.branch)} succursales, et certaines inscriptions peuvent faire suite à un transfert de siège depuis un autre canton. Hors succursales, ${L.n(f.total.creations - f.total.legal.branch)} nouvelles sociétés, raisons individuelles et autres entités ont été inscrites.`,
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
    cite: (f, L, S, slug) => `Les journalistes et chercheurs peuvent reprendre ces chiffres en citant la source :\n\n> Ark Fiduciaire, « Créations d'entreprises à Genève et en Suisse romande : ${L.month} », d'après la Feuille officielle suisse du commerce (FOSC), publié le ${L.date(S.publishedOn)}. ${articleUrl("fr", slug)}\n\nDonnées agrégées au format CSV : [télécharger le fichier](${csvPath(f.T)}).`,
    refs: [
      ["Feuille officielle suisse du commerce (FOSC) – portail des publications", PORTAL_URL],
      ["Registre du commerce (Zefix)", "https://www.zefix.ch/fr/search/entity/welcome"],
      ["Ordonnance sur le registre du commerce (ORC, RS 221.411) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/2007/686/fr"],
      ["Code des obligations (CO, RS 220) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr"],
    ],
  },
  en: {
    title: (f, L) => `New companies in Geneva and French-speaking Switzerland: ${L.month}`,
    description: (f, L) => `${L.n(f.total.creations)} new commercial register entries in French-speaking Switzerland in ${L.month}, including ${L.n(f.ge.creations)} in Geneva. Figures by canton, legal form and deletions, based on the SOGC.`,
    trend: (v, L) => (v === null ? "with no basis for comparison" : v > 0 ? `up ${L.p(v, false)}` : v < 0 ? `down ${L.p(v, false)}` : "unchanged"),
    intro: (f, L) => `In ${L.month}, the Swiss Official Gazette of Commerce (SOGC) published **${L.n(f.total.creations)} new entries** in the commercial register across the six French-speaking cantons (Geneva, Vaud, Valais, Neuchâtel, Fribourg and Jura), including **${L.n(f.ge.creations)} in Geneva**. Over the same period, ${L.n(f.total.deletions)} deletions were published, a balance of ${L.s(f.total.net)} registered entities.\n\nThis monthly barometer by Ark Fiduciaire is computed automatically from the official SOGC publications. The figures are neither estimated nor extrapolated: they are counts of publications, broken down by canton and legal form. The method is described at the end of the article, together with the downloadable data.\n\nA new entry is not always a new business: the total includes ${L.n(f.total.legal.branch)} branches, and some entries may follow a transfer of seat from another canton. Excluding branches, ${L.n(f.total.creations - f.total.legal.branch)} new companies, sole proprietorships and other entities were registered.`,
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
    cite: (f, L, S, slug) => `Journalists and researchers may use these figures with the following attribution:\n\n> Ark Fiduciaire, "New companies in Geneva and French-speaking Switzerland: ${L.month}", based on the Swiss Official Gazette of Commerce (SOGC), published ${L.date(S.publishedOn)}. ${articleUrl("en", slug)}\n\nAggregated data in CSV format: [download the file](${csvPath(f.T)}).`,
    refs: [
      ["Swiss Official Gazette of Commerce (SOGC) – publications portal", PORTAL_URL],
      ["Commercial register (Zefix)", "https://www.zefix.ch/en/search/entity/welcome"],
      ["Commercial Register Ordinance (CRO, SR 221.411) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/2007/686/en"],
      ["Code of Obligations (CO, SR 220) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/en"],
    ],
  },
  de: {
    title: (f, L) => `Firmengründungen in Genf und der Westschweiz: ${L.month}`,
    description: (f, L) => `${L.n(f.total.creations)} Neueintragungen im Handelsregister der Westschweiz im ${L.month}, davon ${L.n(f.ge.creations)} in Genf. Zahlen nach Kanton, Rechtsform und Löschungen, gestützt auf das SHAB.`,
    trend: (v, L) => (v === null ? "ohne Vergleichsbasis" : v > 0 ? `ein Plus von ${L.p(v, false)}` : v < 0 ? `ein Minus von ${L.p(v, false)}` : "unverändert"),
    intro: (f, L) => `Im ${L.month} veröffentlichte das Schweizerische Handelsamtsblatt (SHAB) **${L.n(f.total.creations)} Neueintragungen** im Handelsregister der sechs Westschweizer Kantone (Genf, Waadt, Wallis, Neuenburg, Freiburg und Jura), davon **${L.n(f.ge.creations)} in Genf**. Im gleichen Zeitraum wurden ${L.n(f.total.deletions)} Löschungen publiziert, was einen Saldo von ${L.s(f.total.net)} eingetragenen Einheiten ergibt.\n\nDieses monatliche Barometer von Ark Fiduciaire wird automatisch aus den amtlichen SHAB-Publikationen berechnet. Die Zahlen sind weder geschätzt noch hochgerechnet: Es handelt sich um gezählte Publikationen, aufgeschlüsselt nach Kanton und Rechtsform. Die Methode ist am Ende des Artikels beschrieben, zusammen mit den herunterladbaren Daten.\n\nNicht jede Neueintragung ist ein neues Unternehmen: Das Total umfasst ${L.n(f.total.legal.branch)} Zweigniederlassungen, und einzelne Eintragungen können auf eine Sitzverlegung aus einem anderen Kanton zurückgehen. Ohne Zweigniederlassungen wurden ${L.n(f.total.creations - f.total.legal.branch)} neue Gesellschaften, Einzelunternehmen und andere Einheiten eingetragen.`,
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
    cite: (f, L, S, slug) => `Journalistinnen, Journalisten und Forschende können diese Zahlen mit folgender Quellenangabe verwenden:\n\n> Ark Fiduciaire, „Firmengründungen in Genf und der Westschweiz: ${L.month}“, gestützt auf das Schweizerische Handelsamtsblatt (SHAB), veröffentlicht am ${L.date(S.publishedOn)}. ${articleUrl("de", slug)}\n\nAggregierte Daten im CSV-Format: [Datei herunterladen](${csvPath(f.T)}).`,
    refs: [
      ["Schweizerisches Handelsamtsblatt (SHAB) – Publikationsportal", PORTAL_URL],
      ["Handelsregister (Zefix)", "https://www.zefix.ch/de/search/entity/welcome"],
      ["Handelsregisterverordnung (HRegV, SR 221.411) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/2007/686/de"],
      ["Obligationenrecht (OR, SR 220) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/de"],
    ],
  },
  es: {
    title: (f, L) => `Creación de empresas en Ginebra y la Suiza francófona: ${L.month}`,
    description: (f, L) => `${L.n(f.total.creations)} nuevas inscripciones en el registro mercantil de la Suiza francófona en ${L.month}, de ellas ${L.n(f.ge.creations)} en Ginebra. Cifras por cantón, forma jurídica y bajas, según la FOSC.`,
    trend: (v, L) => (v === null ? "sin base de comparación" : v > 0 ? `un aumento del ${L.p(v, false)}` : v < 0 ? `un descenso del ${L.p(v, false)}` : "sin cambios"),
    intro: (f, L) => `En ${L.month}, la Hoja Oficial Suiza de Comercio (FOSC) publicó **${L.n(f.total.creations)} nuevas inscripciones** en el registro mercantil de los seis cantones francófonos (Ginebra, Vaud, Valais, Neuchâtel, Friburgo y Jura), de ellas **${L.n(f.ge.creations)} en Ginebra**. En el mismo periodo se publicaron ${L.n(f.total.deletions)} bajas, es decir, un saldo de ${L.s(f.total.net)} entidades inscritas.\n\nEste barómetro mensual de Ark Fiduciaire se calcula automáticamente a partir de las publicaciones oficiales de la FOSC. Las cifras no son estimaciones ni extrapolaciones: son recuentos de publicaciones, desglosados por cantón y por forma jurídica. El método se describe al final del artículo, junto con los datos descargables.\n\nUna nueva inscripción no siempre es una nueva empresa: el total incluye ${L.n(f.total.legal.branch)} sucursales, y algunas inscripciones pueden deberse a un traslado de domicilio desde otro cantón. Sin contar las sucursales, se inscribieron ${L.n(f.total.creations - f.total.legal.branch)} nuevas sociedades, empresas individuales y otras entidades.`,
    hKey: (f, L) => `## Cifras clave de ${L.month}`,
    key: (f, L) => [
      `- **${L.n(f.total.creations)}** nuevas inscripciones en la Suiza francófona: ${L.trend(f.total.mom)} respecto a ${L.prevMonth} (${L.n(f.total.prevCreations)}) y ${L.trend(f.total.yoy)} respecto a ${L.yoyMonth} (${L.n(f.total.yoyCreations)}).`,
      `- **${L.n(f.ge.creations)}** en Ginebra, el ${L.p(f.geShare, false)} del total regional; ${L.trend(f.ge.mom)} en un mes y ${L.trend(f.ge.yoy)} en un año.`,
      `- El cantón más activo es ${L.canton(f.topCanton.canton)}, con ${L.n(f.topCanton.creations)} nuevas inscripciones.`,
      `- La forma más frecuente es ${L.legalNoun(f.topLegal)} (${L.n(f.total.legal[f.topLegal])} inscripciones, ${L.p(L.share(f.total.legal[f.topLegal], f.total.creations), false)}).`,
      `- **${L.n(f.total.deletions)}** bajas publicadas en los seis cantones, con un saldo de ${L.s(f.total.net)}.`,
      `- Desde enero, ${L.n(f.total.ytd)} nuevas inscripciones: ${L.trend(f.total.ytdChange)} respecto al mismo periodo de ${f.year - 1} (${L.n(f.total.ytdPrev)}).`,
    ].join("\n"),
    hCanton: () => "## Nuevas inscripciones y bajas por cantón",
    cantonIntro: (f, L) => `La tabla compara las nuevas inscripciones de ${L.month} con el mes anterior y con el mismo mes del año pasado. El saldo corresponde a las nuevas inscripciones menos las bajas publicadas en el mismo mes.`,
    cantonHead: (f, L) => ["Cantón", `Inscripciones ${L.monthShort(f.T)}`, L.monthShort(f.prev), "Var. mensual", L.monthShort(f.yoy), "Var. anual", "Bajas", "Saldo"],
    totalLabel: "Suiza francófona",
    cantonOutro: (f, L) => `Ginebra representa el ${L.p(f.geShare, false)} de las nuevas inscripciones de la región en el mes. Las variaciones mensuales deben leerse con prudencia en los cantones pequeños, donde unas pocas inscripciones bastan para mover mucho el porcentaje.`,
    hLegal: () => "## Formas jurídicas de las nuevas inscripciones",
    legalIntro: (f, L) => `La forma jurídica se lee en el campo estructurado de cada publicación. En Ginebra, la forma más frecuente este mes es ${L.legalNoun(f.geTopLegal)} (${L.n(f.ge.legal[f.geTopLegal])} de ${L.n(f.ge.creations)}).`,
    legalOutro: () => "«Otras formas» agrupa sobre todo sociedades colectivas, asociaciones, fundaciones y cooperativas inscritas en el registro mercantil. Las sucursales incluyen las de empresas suizas y extranjeras.",
    hYtd: (f, L) => `## En lo que va de año (${L.monthOnly(f.ytdFirst)} a ${L.month})`,
    ytdHead: (f, L) => ["Cantón", `Inscripciones ${f.year}`, `Inscripciones ${f.year - 1}`, "Variación", `Bajas ${f.year}`, `Saldo ${f.year}`],
    hTrend: () => "## Evolución en trece meses",
    trendIntro: () => "Nuevas inscripciones publicadas cada mes en Ginebra y en el conjunto de los seis cantones francófonos, con las bajas de la región en el mismo mes.",
    trendHead: () => ["Mes", "Ginebra", "Suiza francófona", "Bajas (Suiza francófona)"],
    hSector: () => "## Sectores de actividad (indicativo)",
    sectorIntro: (f, L) => `Para dar un orden de magnitud, el objeto social de cada nueva inscripción se asigna a un sector mediante palabras clave. Esta clasificación es **aproximada**: no sigue la nomenclatura oficial NOGA, un objeto puede abarcar varias actividades y algunos no contienen ninguna palabra clave reconocida (${L.n(f.unclassified)} inscripciones sin clasificar de ${L.n(f.sectorTotal)}).`,
    sectorHead: () => ["Sector (clasificación por palabras clave)", "Inscripciones", "Proporción"],
    hMeaning: () => "## Qué significan estas cifras para quien crea una empresa",
    meaning: () => [
      "La elección entre Sàrl y SA depende ante todo del capital y de la imagen buscada. La Sàrl exige un capital mínimo de 20 000 francos y la SA un capital social mínimo de 100 000 francos, del que al menos el 20 % de cada acción y al menos 50 000 francos en total deben desembolsarse en la constitución. Ambas formas limitan la responsabilidad de los socios o accionistas al patrimonio de la sociedad.",
      "La empresa individual es la forma más sencilla, pero el titular responde de las deudas con todo su patrimonio. La inscripción en el registro mercantil es obligatoria cuando la cifra de negocios anual alcanza 100 000 francos. Muchos autónomos empiezan así y pasan a una Sàrl cuando la actividad crece.",
      "La inscripción es solo el primer paso: IVA, seguros sociales, contabilidad e impuestos llegan enseguida. Ark Fiduciaire acompaña a los fundadores en Ginebra, desde la [constitución de la sociedad](/services/incorporation) hasta la contabilidad. Para una pregunta concreta, [contáctenos](/contact).",
    ].join("\n\n"),
    hMethod: () => "## Metodología",
    method: (f, L, S) => [
      `- **Fuente**: publicaciones de la [Hoja Oficial Suiza de Comercio (FOSC)](${PORTAL_URL}), obtenidas a través de la interfaz pública del portal el ${L.date(S.fetchedAt)}.`,
      "- **Nuevas inscripciones**: publicaciones de la rúbrica HR01 («nuevas inscripciones») de los registros mercantiles de Ginebra, Vaud, Valais, Neuchâtel, Friburgo y Jura. Incluyen las sucursales.",
      "- **Bajas**: publicaciones de la rúbrica HR03. Una baja puede deberse a una liquidación, una fusión, un traslado de domicilio u otra causa; el saldo es, por tanto, un flujo de publicaciones y no la variación del número de empresas activas.",
      "- **Fecha utilizada**: la fecha de publicación en la FOSC, no la de inscripción en el registro, que suele ser unos días anterior. Parte de las inscripciones de final de mes aparece por ello en el mes siguiente.",
      "- **Formas jurídicas**: leídas en el campo estructurado de cada publicación. El sector es una clasificación indicativa por palabras clave del objeto social.",
      `- **Controles**: ${L.n(S.quality.hr01Publications)} publicaciones HR01 y ${L.n(S.quality.hr03Publications)} publicaciones HR03 tratadas en el periodo cubierto; ${L.n(S.quality.detailsParsed)} publicaciones del mes leídas en detalle; ${L.n(S.quality.seatTransferMentions)} mencionan un traslado de domicilio desde otro cantón; ${L.n(S.quality.uidDuplicates)} IDE duplicado detectado.`,
      "- **Datos personales**: el informe solo publica agregados. No se incluye ningún nombre de persona ni de empresa.",
      "- **Revisiones**: una publicación anulada o corregida después de la extracción puede modificar ligeramente las cifras. Cada informe conserva las cifras de su fecha de extracción.",
    ].join("\n"),
    hCite: () => "## Citar estos datos",
    cite: (f, L, S, slug) => `Periodistas e investigadores pueden utilizar estas cifras citando la fuente:\n\n> Ark Fiduciaire, «Creación de empresas en Ginebra y la Suiza francófona: ${L.month}», según la Hoja Oficial Suiza de Comercio (FOSC), publicado el ${L.date(S.publishedOn)}. ${articleUrl("es", slug)}\n\nDatos agregados en formato CSV: [descargar el archivo](${csvPath(f.T)}).`,
    refs: [
      ["Hoja Oficial Suiza de Comercio (FOSC) – portal de publicaciones", PORTAL_URL],
      ["Registro mercantil (Zefix)", "https://www.zefix.ch/fr/search/entity/welcome"],
      ["Ordenanza sobre el registro mercantil (ORC, RS 221.411) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/2007/686/fr"],
      ["Código de obligaciones (CO, RS 220) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr"],
    ],
  },
  pt: {
    title: (f, L) => `Criação de empresas em Genebra e na Suíça francófona: ${L.month}`,
    description: (f, L) => `${L.n(f.total.creations)} novas inscrições no registo comercial da Suíça francófona em ${L.month}, das quais ${L.n(f.ge.creations)} em Genebra. Números por cantão, forma jurídica e cancelamentos, segundo a FOSC.`,
    trend: (v, L) => (v === null ? "sem base de comparação" : v > 0 ? `uma subida de ${L.p(v, false)}` : v < 0 ? `uma descida de ${L.p(v, false)}` : "sem alteração"),
    intro: (f, L) => `Em ${L.month}, a Folha Oficial Suíça do Comércio (FOSC) publicou **${L.n(f.total.creations)} novas inscrições** no registo comercial dos seis cantões francófonos (Genebra, Vaud, Valais, Neuchâtel, Friburgo e Jura), das quais **${L.n(f.ge.creations)} em Genebra**. No mesmo período foram publicados ${L.n(f.total.deletions)} cancelamentos, ou seja, um saldo de ${L.s(f.total.net)} entidades inscritas.\n\nEste barómetro mensal da Ark Fiduciaire é calculado automaticamente a partir das publicações oficiais da FOSC. Os números não são estimados nem extrapolados: são contagens de publicações, discriminadas por cantão e por forma jurídica. O método é descrito no final do artigo, com os dados para descarregar.\n\nUma nova inscrição nem sempre é uma nova empresa: o total inclui ${L.n(f.total.legal.branch)} sucursais, e algumas inscrições podem resultar de uma transferência de sede a partir de outro cantão. Excluindo as sucursais, foram inscritas ${L.n(f.total.creations - f.total.legal.branch)} novas sociedades, empresas em nome individual e outras entidades.`,
    hKey: (f, L) => `## Números-chave de ${L.month}`,
    key: (f, L) => [
      `- **${L.n(f.total.creations)}** novas inscrições na Suíça francófona: ${L.trend(f.total.mom)} face a ${L.prevMonth} (${L.n(f.total.prevCreations)}) e ${L.trend(f.total.yoy)} face a ${L.yoyMonth} (${L.n(f.total.yoyCreations)}).`,
      `- **${L.n(f.ge.creations)}** em Genebra, ou seja ${L.p(f.geShare, false)} do total regional; ${L.trend(f.ge.mom)} num mês e ${L.trend(f.ge.yoy)} num ano.`,
      `- O cantão mais ativo é ${L.canton(f.topCanton.canton)}, com ${L.n(f.topCanton.creations)} novas inscrições.`,
      `- A forma mais frequente é ${L.legalNoun(f.topLegal)} (${L.n(f.total.legal[f.topLegal])} inscrições, ${L.p(L.share(f.total.legal[f.topLegal], f.total.creations), false)}).`,
      `- **${L.n(f.total.deletions)}** cancelamentos publicados nos seis cantões, com um saldo de ${L.s(f.total.net)}.`,
      `- Desde janeiro, ${L.n(f.total.ytd)} novas inscrições: ${L.trend(f.total.ytdChange)} face ao mesmo período de ${f.year - 1} (${L.n(f.total.ytdPrev)}).`,
    ].join("\n"),
    hCanton: () => "## Novas inscrições e cancelamentos por cantão",
    cantonIntro: (f, L) => `A tabela compara as novas inscrições de ${L.month} com o mês anterior e com o mesmo mês do ano passado. O saldo corresponde às novas inscrições menos os cancelamentos publicados no mesmo mês.`,
    cantonHead: (f, L) => ["Cantão", `Inscrições ${L.monthShort(f.T)}`, L.monthShort(f.prev), "Var. mensal", L.monthShort(f.yoy), "Var. anual", "Cancelamentos", "Saldo"],
    totalLabel: "Suíça francófona",
    cantonOutro: (f, L) => `Genebra representa ${L.p(f.geShare, false)} das novas inscrições da região no mês. As variações mensais devem ser lidas com prudência nos cantões mais pequenos, onde poucas inscrições bastam para alterar muito a percentagem.`,
    hLegal: () => "## Formas jurídicas das novas inscrições",
    legalIntro: (f, L) => `A forma jurídica é lida no campo estruturado de cada publicação. Em Genebra, a forma mais frequente este mês é ${L.legalNoun(f.geTopLegal)} (${L.n(f.ge.legal[f.geTopLegal])} de ${L.n(f.ge.creations)}).`,
    legalOutro: () => "«Outras formas» agrupa sobretudo sociedades em nome coletivo, associações, fundações e cooperativas inscritas no registo comercial. As sucursais incluem as de empresas suíças e estrangeiras.",
    hYtd: (f, L) => `## Desde o início do ano (${L.monthOnly(f.ytdFirst)} a ${L.month})`,
    ytdHead: (f, L) => ["Cantão", `Inscrições ${f.year}`, `Inscrições ${f.year - 1}`, "Variação", `Cancelamentos ${f.year}`, `Saldo ${f.year}`],
    hTrend: () => "## Evolução em treze meses",
    trendIntro: () => "Novas inscrições publicadas em cada mês em Genebra e no conjunto dos seis cantões francófonos, com os cancelamentos da região no mesmo mês.",
    trendHead: () => ["Mês", "Genebra", "Suíça francófona", "Cancelamentos (Suíça francófona)"],
    hSector: () => "## Setores de atividade (indicativo)",
    sectorIntro: (f, L) => `Para dar uma ordem de grandeza, o objeto social de cada nova inscrição é atribuído a um setor por palavras-chave. Esta classificação é **aproximada**: não segue a nomenclatura oficial NOGA, um objeto pode abranger várias atividades e alguns não contêm nenhuma palavra-chave reconhecida (${L.n(f.unclassified)} inscrições não classificadas em ${L.n(f.sectorTotal)}).`,
    sectorHead: () => ["Setor (classificação por palavras-chave)", "Inscrições", "Proporção"],
    hMeaning: () => "## O que estes números significam para quem cria uma empresa",
    meaning: () => [
      "A escolha entre Sàrl e SA depende sobretudo do capital e da imagem pretendida. A Sàrl exige um capital mínimo de 20 000 francos e a SA um capital social mínimo de 100 000 francos, do qual pelo menos 20 % de cada ação e pelo menos 50 000 francos no total devem ser realizados na constituição. Ambas as formas limitam a responsabilidade dos sócios ou acionistas ao património da sociedade.",
      "A empresa em nome individual é a forma mais simples, mas o titular responde pelas dívidas com todo o seu património. A inscrição no registo comercial torna-se obrigatória quando o volume de negócios anual atinge 100 000 francos. Muitos independentes começam assim e passam para uma Sàrl quando a atividade cresce.",
      "A inscrição é apenas o primeiro passo: IVA, seguros sociais, contabilidade e impostos seguem-se rapidamente. A Ark Fiduciaire acompanha os fundadores em Genebra, desde a [constituição da sociedade](/services/incorporation) até à contabilidade. Para uma questão concreta, [contacte-nos](/contact).",
    ].join("\n\n"),
    hMethod: () => "## Metodologia",
    method: (f, L, S) => [
      `- **Fonte**: publicações da [Folha Oficial Suíça do Comércio (FOSC)](${PORTAL_URL}), obtidas através da interface pública do portal em ${L.date(S.fetchedAt)}.`,
      "- **Novas inscrições**: publicações da rubrica HR01 («novas inscrições») dos registos comerciais de Genebra, Vaud, Valais, Neuchâtel, Friburgo e Jura. Incluem as sucursais.",
      "- **Cancelamentos**: publicações da rubrica HR03. Um cancelamento pode resultar de uma liquidação, de uma fusão, de uma transferência de sede ou de outra causa; o saldo é, portanto, um fluxo de publicações e não a variação do número de empresas ativas.",
      "- **Data utilizada**: a data de publicação na FOSC, e não a data de inscrição no registo, que normalmente a precede em alguns dias. Parte das inscrições do fim do mês aparece por isso no mês seguinte.",
      "- **Formas jurídicas**: lidas no campo estruturado de cada publicação. O setor é uma classificação indicativa por palavras-chave do objeto social.",
      `- **Controlos**: ${L.n(S.quality.hr01Publications)} publicações HR01 e ${L.n(S.quality.hr03Publications)} publicações HR03 tratadas no período coberto; ${L.n(S.quality.detailsParsed)} publicações do mês lidas em detalhe; ${L.n(S.quality.seatTransferMentions)} mencionam uma transferência de sede a partir de outro cantão; ${L.n(S.quality.uidDuplicates)} IDE duplicado detetado.`,
      "- **Dados pessoais**: o relatório publica apenas agregados. Não é incluído nenhum nome de pessoa ou de empresa.",
      "- **Revisões**: uma publicação anulada ou corrigida após a extração pode alterar ligeiramente os números. Cada relatório mantém os números da sua data de extração.",
    ].join("\n"),
    hCite: () => "## Citar estes dados",
    cite: (f, L, S, slug) => `Jornalistas e investigadores podem utilizar estes números citando a fonte:\n\n> Ark Fiduciaire, «Criação de empresas em Genebra e na Suíça francófona: ${L.month}», segundo a Folha Oficial Suíça do Comércio (FOSC), publicado em ${L.date(S.publishedOn)}. ${articleUrl("pt", slug)}\n\nDados agregados em formato CSV: [descarregar o ficheiro](${csvPath(f.T)}).`,
    refs: [
      ["Folha Oficial Suíça do Comércio (FOSC) – portal de publicações", PORTAL_URL],
      ["Registo comercial (Zefix)", "https://www.zefix.ch/fr/search/entity/welcome"],
      ["Portaria sobre o registo comercial (ORC, RS 221.411) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/2007/686/fr"],
      ["Código das obrigações (CO, RS 220) – Fedlex", "https://www.fedlex.admin.ch/eli/cc/27/317_321_377/fr"],
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

/** Renders the article for one locale. Pure function of (locale, snapshot). */
function renderArticle(locale, snapshot) {
  if (!TEXT[locale]) throw new Error(`Unsupported locale ${locale}`);
  const t = TEXT[locale];
  const f = computeFigures(snapshot);
  const L = helpers(locale, f);
  const slug = reportSlug(snapshot.reportMonth);

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
  ].join("\n\n");

  return {
    slug,
    title: t.title(f, L),
    description: t.description(f, L),
    content,
    author: "Ark Fiduciaire",
    date: snapshot.publishedOn,
    category: "incorporation",
    tags: TAGS.slice(),
    references: t.refs.map(([labelKey, url]) => ({ labelKey, url })),
    series: SERIES,
    reportMonth: snapshot.reportMonth,
  };
}

function csvCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Aggregate CSV (one row per canton and metric family). No names, no identifiers. */
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
  TAGS,
  computeFigures,
  renderArticle,
  renderCsv,
  reportSlug,
  csvFileName,
  csvPath,
  fmtPct,
  fmtInt,
};
