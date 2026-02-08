"use strict";
/**
 * Trends module for selecting SEO topics for Ark Fiduciaire.
 *
 * Why this exists:
 * - "True" Google Trends daily feeds are broad (sports/celebrity/politics) and
 *   often irrelevant for fiduciary services.
 * - We still want to react to fresh news when it intersects our services.
 * - When no relevant trend exists, we rotate through evergreen, high-intent
 *   topics and enrich keywords with Google Suggest.
 *
 * Supported providers (env `TRENDS_PROVIDER`):
 * - `hybrid` (default): Google Trends RSS (CH) + evergreen rotation + Suggest
 * - `google_rss`: only Google Trends RSS + Suggest (no evergreen)
 *
 * Env:
 * - `TRENDS_GEO` (default: CH)
 * - `TRENDS_LANGUAGE` (default: fr)
 * - `TRENDS_MAX_TOPICS` (default: 10)
 * - `TRENDS_SUGGEST` (default: 1)
 * - `TRENDS_SUGGEST_MAX` (default: 8)
 */

const EVERGREEN_TOPICS = [
  {
    topic: "cotisations-sociales-employeur-suisse",
    title: "Cotisations sociales en Suisse: guide employeur (AVS/AI/APG, AC, LPP, LAA)",
    keywords: [
      "cotisations sociales",
      "AVS",
      "LPP",
      "LAA",
      "employeur",
      "paie",
      "Genève",
      "Suisse",
    ],
    category: "payroll",
    outline: [
      "H2 panorama des cotisations",
      "H2 AVS/AI/APG et AC: principes, taux",
      "H2 LPP: seuils, coordination, plans",
      "H2 LAA: couverture et obligations",
      "H2 exemples chiffrés (CHF)",
      "H2 erreurs fréquentes + corrections",
      "FAQ",
    ],
  },
  {
    topic: "certificat-salaire-suisse-erreurs",
    title: "Certificat de salaire en Suisse: erreurs fréquentes, contrôles et bonnes pratiques",
    keywords: [
      "certificat de salaire",
      "salaire",
      "AVS",
      "frais",
      "avantages",
      "employeur",
      "Suisse",
    ],
    category: "payroll",
    outline: [
      "H2 à quoi sert le certificat",
      "H2 éléments imposables/non imposables",
      "H2 frais: ce qui passe / ce qui bloque",
      "H2 contrôles et risques",
      "H2 checklist + FAQ",
    ],
  },
  {
    topic: "tva-suisse-declaration-erreurs-delais",
    title: "TVA Suisse: délais, décomptes et erreurs fréquentes (et comment les éviter)",
    keywords: ["TVA Suisse", "décompte TVA", "AFC", "taux TVA", "délais", "erreurs"],
    category: "tax",
    outline: [
      "H2 assujettissement et méthodes",
      "H2 délais et contrôles AFC",
      "H2 erreurs fréquentes + corrections",
      "H2 cas pratique chiffré (CHF)",
      "H2 checklist TVA + FAQ",
    ],
  },
  {
    topic: "dividendes-suisse-salaire-vs-dividendes",
    title: "Salaire vs dividendes en Suisse: arbitrer pour dirigeants de PME (risques et méthode)",
    keywords: [
      "salaire vs dividendes",
      "dividendes",
      "PME",
      "charges sociales",
      "fiscalité",
      "Genève",
    ],
    category: "tax",
    outline: [
      "H2 logique économique et fiscale",
      "H2 risques (requalification, charges)",
      "H2 exemples chiffrés",
      "H2 erreurs fréquentes + corrections",
      "FAQ",
    ],
  },
  {
    topic: "cloture-comptable-pme-checklist",
    title: "Clôture comptable PME: checklist, délais, écritures sensibles et contrôle qualité",
    keywords: [
      "clôture comptable",
      "PME",
      "bilan",
      "compte de résultat",
      "provisions",
      "contrôle interne",
    ],
    category: "accounting",
    outline: [
      "H2 planning de clôture",
      "H2 écritures sensibles (provisions, transitoires)",
      "H2 documents à réunir",
      "H2 deux tableaux (planning + risques)",
      "FAQ",
    ],
  },
  {
    topic: "swiss-gaap-fer-pme-choisir",
    title: "Swiss GAAP FER pour PME: quand l'adopter, avantages, coûts et points d'attention",
    keywords: ["Swiss GAAP FER", "PME", "reporting", "normes comptables", "bilan"],
    category: "accounting",
    outline: ["H2 quand c'est pertinent", "H2 différences clés", "H2 impacts", "FAQ"],
  },
  {
    topic: "sarl-ou-sa-geneve-criteres",
    title: "Créer une Sàrl ou une SA à Genève: critères, coûts, gouvernance et fiscalité",
    keywords: ["Sàrl", "SA", "Genève", "création d'entreprise", "registre du commerce", "capital"],
    category: "incorporation",
    outline: [
      "H2 différences Sàrl vs SA",
      "H2 capital, organes, responsabilité",
      "H2 fiscalité et rémunération",
      "H2 procédure et délais",
      "FAQ",
    ],
  },
  {
    topic: "registre-commerce-suisse-documents-delais",
    title: "Registre du commerce en Suisse: documents, délais, erreurs et coûts (guide pratique)",
    keywords: ["registre du commerce", "Suisse", "statuts", "inscription", "délais", "erreurs"],
    category: "incorporation",
    outline: ["H2 étapes", "H2 documents", "H2 délais", "H2 erreurs", "FAQ"],
  },
  {
    topic: "lba-aml-fiduciaire-kyc",
    title: "LBA/AML en fiduciaire: obligations, KYC, risques et dossier de conformité",
    keywords: ["LBA", "AML", "KYC", "MROS", "OAR", "conformité", "fiduciaire"],
    category: "regulatory",
    outline: [
      "H2 périmètre et obligations",
      "H2 KYC: pièces et contrôles",
      "H2 surveillance (PEP, sanctions)",
      "H2 signalement MROS",
      "FAQ",
    ],
  },
  {
    topic: "domiciliation-suisse-conditions-risques",
    title: "Domiciliation en Suisse: ce que les entreprises doivent vérifier (contrats, substance, risques)",
    keywords: ["domiciliation", "Suisse", "Genève", "substance", "siège", "risques"],
    category: "domiciliation",
    outline: ["H2 définition", "H2 contrat", "H2 substance", "H2 cas pratique", "FAQ"],
  },
  {
    topic: "outsourcing-finance-cfo-a-la-demande",
    title: "CFO à la demande / outsourcing finance: quand externaliser, coûts, KPIs et gouvernance",
    keywords: ["CFO à la demande", "outsourcing finance", "reporting", "cash-flow", "KPIs", "PME"],
    category: "outsourcing",
    outline: ["H2 cas d'usage", "H2 périmètre", "H2 gouvernance", "H2 coûts", "FAQ"],
  },
  {
    topic: "odoo-comptabilite-suisse-tva",
    title: "Odoo en Suisse: comptabilité et TVA (paramétrage, contrôles, erreurs fréquentes)",
    keywords: ["Odoo Suisse", "comptabilité", "TVA", "plan comptable", "PME", "contrôle"],
    category: "odoo",
    outline: ["H2 paramétrage", "H2 TVA", "H2 exports", "H2 erreurs", "FAQ"],
  },
  {
    topic: "independant-suisse-avs-impots-comptabilite",
    title: "Indépendant en Suisse: AVS, acomptes d'impôts, facturation et comptabilité (guide concret)",
    keywords: ["indépendant", "AVS indépendant", "acomptes impôts", "facturation", "comptabilité", "Suisse"],
    category: "tax",
    outline: ["H2 statut", "H2 AVS/assurances", "H2 impôts", "H2 compta", "FAQ"],
  },
];

const CATEGORY_KEYWORDS = {
  payroll: [
    "avs",
    "apg",
    "lpp",
    "laa",
    "salaire",
    "salaires",
    "paie",
    "swissdec",
    "certificat de salaire",
  ],
  tax: [
    "tva",
    "impôt",
    "impots",
    "déduction",
    "déductions",
    "dividende",
    "acomptes",
    "afc",
    "estv",
  ],
  accounting: ["comptabilité", "comptabilite", "bilan", "clôture", "cloture", "fer", "reporting"],
  // Avoid overly short tokens like "sa" which cause lots of false matches (e.g., "galataSAaray").
  incorporation: ["sàrl", "sarl", "registre du commerce", "création", "creation", "statuts", "capital"],
  corporate: ["conseil d'administration", "assemblée générale", "gouvernance", "fusion", "acquisition", "m&a"],
  regulatory: ["lba", "aml", "finma", "mros", "kyc", "conformité", "compliance"],
  domiciliation: ["domiciliation", "adresse", "substance", "siège", "siege"],
  outsourcing: ["outsourcing", "externalisation", "cfo", "kpi", "cash", "trésorerie", "tresorerie", "reporting"],
  odoo: ["odoo", "erp", "facturation", "comptabilité", "comptabilite", "tva"],
  finance: ["financement", "banque", "budget", "business plan", "levée de fonds", "levee de fonds"],
  "family-office": ["patrimoine", "succession", "planification", "family office"],
};

function isoDateToday() {
  return new Date().toISOString().slice(0, 10);
}

function stableHash(input) {
  const s = String(input || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function safeText(s) {
  if (!s) return "";
  return String(s).replace(/\s+/g, " ").trim();
}

function normalizeForMatch(s) {
  return safeText(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasKeyword(normalizedHaystack, rawNeedle) {
  const needle = normalizeForMatch(rawNeedle);
  if (!needle) return false;
  // If the needle contains spaces, substring match is fine.
  if (needle.includes(" ")) return normalizedHaystack.includes(needle);
  // Word-boundary match for short tokens (e.g. "afc", "tva").
  if (needle.length <= 4) {
    const re = new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`, "i");
    return re.test(normalizedHaystack);
  }
  return normalizedHaystack.includes(needle);
}

function decodeXmlEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractXmlTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? decodeXmlEntities(m[1]) : "";
}

function extractXmlTags(block, tag) {
  const rx = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "ig");
  const out = [];
  let m;
  while ((m = rx.exec(block))) out.push(decodeXmlEntities(m[1]));
  return out;
}

async function fetchText(url, { timeoutMs = 8000, headers = null } = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "*/*",
        ...(headers || {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

async function fetchGoogleTrendingRss(config = {}) {
  const {
    geo = process.env.TRENDS_GEO || "CH",
    hl = (process.env.TRENDS_LANGUAGE || "fr") + "-CH",
    maxTopics = parseInt(process.env.TRENDS_MAX_TOPICS || "10", 10),
  } = config;

  const url = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}&hl=${encodeURIComponent(hl)}`;
  try {
    const xml = await fetchText(url, {
      timeoutMs: 8000,
      headers: {
        Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
      },
    });
    const items = xml.split(/<item>/i).slice(1).map((s) => s.split(/<\/item>/i)[0] || "");
    const topics = [];
    for (const raw of items) {
      const title = safeText(extractXmlTag(raw, "title"));
      if (!title) continue;
      const traffic = safeText(extractXmlTag(raw, "ht:approx_traffic"));
      const pubDate = safeText(extractXmlTag(raw, "pubDate"));
      const newsUrls = extractXmlTags(raw, "ht:news_item_url").slice(0, 3);
      const newsSources = extractXmlTags(raw, "ht:news_item_source").slice(0, 3);
      const articles = [];
      for (let i = 0; i < Math.min(newsUrls.length, newsSources.length, 3); i++) {
        articles.push({ title: "", source: newsSources[i], url: newsUrls[i] });
      }
      topics.push({
        title,
        traffic: traffic || "unknown",
        relatedQueries: [],
        articles,
        pubDate,
      });
      if (topics.length >= Math.max(5, maxTopics * 2)) break;
    }
    return {
      topics: topics.slice(0, maxTopics),
      geo,
      language: hl,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.warn(`[trends] Google RSS error: ${error.message}`);
    return { topics: [], error: error.message };
  }
}

async function fetchGoogleSuggest(keyword, config = {}) {
  const { hl = process.env.TRENDS_LANGUAGE || "fr" } = config;
  const suggestUrl =
    "https://suggestqueries.google.com/complete/search" +
    `?client=firefox&hl=${encodeURIComponent(hl)}&q=${encodeURIComponent(keyword)}`;
  try {
    const text = await fetchText(suggestUrl, {
      timeoutMs: 6000,
      headers: { Accept: "application/json, text/plain;q=0.9, */*;q=0.5" },
    });
    const parsed = JSON.parse(text);
    const suggestions = Array.isArray(parsed?.[1]) ? parsed[1] : [];
    return suggestions.map(safeText).filter(Boolean);
  } catch {
    return [];
  }
}

async function fetchGoogleTrends() {
  return { topics: [], error: "google-trends-api disabled (use google_rss/hybrid)" };
}

function guessCategoryFromText(text) {
  const t = normalizeForMatch(text);
  if (!t) return { category: "general", score: 0, strong: false };

  const strongKeywords = new Set([
    "tva",
    "avs",
    "lpp",
    "laa",
    "lba",
    "kyc",
    "odoo",
    "swissdec",
    "registre du commerce",
  ]);

  let best = { category: "general", score: 0, strong: false };
  for (const [category, keys] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0;
    let strong = false;
    for (const k of keys) {
      if (!hasKeyword(t, k)) continue;
      score += 1;
      if (strongKeywords.has(normalizeForMatch(k))) strong = true;
    }
    if (score > best.score) best = { category, score, strong };
  }
  return best;
}

function filterRelevantTrends(trends = []) {
  const out = [];
  for (const trend of trends) {
    const title = safeText(trend?.title);
    if (!title) continue;
    const guess = guessCategoryFromText(title);
    // RSS contains lots of irrelevant public trends. Require either:
    // - multiple fiduciary keyword hits, or
    // - at least one strong, unambiguous keyword.
    const relevant = guess.category !== "general" && (guess.score >= 2 || guess.strong);
    if (!relevant) continue;
    out.push({ ...trend, _category: guess.category, _score: guess.score });
  }
  return out;
}

function slugifyFr(input) {
  return safeText(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 70);
}

function pickOutlineForCategory(category) {
  const templates = {
    payroll: ["H2 obligations employeur", "H2 taux et calcul", "H2 exemples", "H2 erreurs", "FAQ"],
    tax: ["H2 cadre", "H2 calcul", "H2 erreurs", "H2 cas pratique", "FAQ"],
    accounting: ["H2 objectifs", "H2 planning", "H2 écritures", "H2 contrôles", "FAQ"],
    incorporation: ["H2 choisir la forme", "H2 étapes", "H2 coûts", "H2 erreurs", "FAQ"],
    regulatory: ["H2 périmètre", "H2 obligations", "H2 preuves", "H2 erreurs", "FAQ"],
    outsourcing: ["H2 cas d'usage", "H2 périmètre", "H2 gouvernance", "H2 coûts", "FAQ"],
    domiciliation: ["H2 définition", "H2 contrat", "H2 risques", "H2 cas pratique", "FAQ"],
    odoo: ["H2 paramétrage", "H2 TVA", "H2 flux", "H2 erreurs", "FAQ"],
    corporate: ["H2 contexte", "H2 étapes", "H2 documents", "H2 risques", "FAQ"],
    finance: ["H2 options", "H2 dossier", "H2 KPIs", "H2 erreurs", "FAQ"],
    "family-office": ["H2 objectifs", "H2 gouvernance", "H2 fiscalité", "H2 risques", "FAQ"],
    general: ["H2 contexte", "H2 méthode", "H2 cas pratique", "H2 erreurs", "FAQ"],
  };
  return templates[category] || templates.general;
}

function mapTrendToArticleParams(trend, existingSlugs = []) {
  const title = safeText(trend?.title);
  if (!title) return null;
  const category = trend?._category || guessCategoryFromText(title).category;
  if (category === "general") return null;

  const suggestedSlug = slugifyFr(title);
  if (!suggestedSlug || existingSlugs.includes(suggestedSlug)) return null;

  const baseKeywords = (CATEGORY_KEYWORDS[category] || []).slice(0, 6);
  const keywords = [...new Set([title, ...baseKeywords, "Suisse", "Genève"])].slice(0, 12);

  return {
    suggestedTopic: `${title}: impacts et points d'attention pour les entreprises en Suisse`,
    keywords,
    suggestedSlug,
    category,
    outline: pickOutlineForCategory(category),
    trendSignal: {
      source: "google_trends_rss",
      indicators: ["google_trends_rss"],
      date: isoDateToday(),
      raw: { title, traffic: trend?.traffic || "unknown" },
    },
  };
}

function scoreEvergreenTopic(t, { avoidTopics = [], recentTopicCategories = [], topicCounts = {} }) {
  let score = 100;
  if (avoidTopics.includes(t.category)) score -= 50;
  if (recentTopicCategories.includes(t.category)) score -= 25;

  const count = typeof topicCounts[t.category] === "number" ? topicCounts[t.category] : 0;
  score += Math.max(0, 20 - count * 4);

  // Deterministic daily rotation.
  score += stableHash(`${isoDateToday()}::${t.topic}`) % 7;
  return score;
}

async function enrichKeywordsWithSuggest(selectedTopic) {
  const enable = process.env.TRENDS_SUGGEST !== "0";
  if (!enable || !selectedTopic) return selectedTopic;
  const max = parseInt(process.env.TRENDS_SUGGEST_MAX || "8", 10);
  const base = Array.isArray(selectedTopic.keywords) ? selectedTopic.keywords : [];
  const primary = base[0] || selectedTopic.suggestedTopic || "";
  const suggestions = await fetchGoogleSuggest(primary);
  if (!suggestions.length) return selectedTopic;
  const extras = suggestions.map((s) => safeText(s)).filter(Boolean).slice(0, max);
  selectedTopic.keywords = [...new Set([...base, ...extras])].slice(0, 16);
  return selectedTopic;
}

async function getTopicSuggestions(options = {}) {
  const {
    existingSlugs = [],
    avoidTopics = [],
    recentTopicCategories = [],
    topicCounts = {},
  } = options;

  let provider = String(process.env.TRENDS_PROVIDER || "hybrid").trim().toLowerCase();
  if (!provider || provider === "google_trends") provider = "hybrid";

  let trendsResult = { topics: [], error: null };
  if (provider === "google_rss" || provider === "hybrid") {
    trendsResult = await fetchGoogleTrendingRss();
  }

  const relevantTrends = filterRelevantTrends(trendsResult.topics || []);
  let selectedTopic = null;
  let usedFallback = false;

  for (const trend of relevantTrends) {
    const params = mapTrendToArticleParams(trend, existingSlugs);
    if (!params) continue;
    if (avoidTopics.includes(params.category)) continue;
    selectedTopic = params;
    break;
  }

  if (!selectedTopic) {
    usedFallback = true;
    if (provider === "google_rss") {
      // No evergreen rotation in RSS-only mode.
      return {
        selectedTopic: null,
        usedFallback: true,
        trendsChecked: Array.isArray(trendsResult.topics) ? trendsResult.topics.length : 0,
        relevantTrendsChecked: relevantTrends.length,
        provider,
        error: trendsResult.error || null,
      };
    }

    console.log("[trends] No suitable trending topic found, using evergreen topics");
    const candidates = EVERGREEN_TOPICS
      .filter((t) => !existingSlugs.includes(t.topic))
      .filter((t) => !avoidTopics.includes(t.category))
      .map((t) => ({
        t,
        score: scoreEvergreenTopic(t, { avoidTopics, recentTopicCategories, topicCounts }),
      }))
      .sort((a, b) => b.score - a.score);
    const best = (candidates[0] && candidates[0].t) || EVERGREEN_TOPICS[0];
    selectedTopic = {
      suggestedTopic: best.title,
      keywords: best.keywords,
      suggestedSlug: best.topic,
      category: best.category,
      outline: best.outline,
      trendSignal: {
        source: "evergreen_fallback",
        indicators: ["evergreen_rotation"],
        date: isoDateToday(),
      },
    };
  }

  selectedTopic = await enrichKeywordsWithSuggest(selectedTopic);
  return {
    selectedTopic,
    usedFallback,
    trendsChecked: Array.isArray(trendsResult.topics) ? trendsResult.topics.length : 0,
    relevantTrendsChecked: relevantTrends.length,
    provider,
    error: trendsResult.error || null,
  };
}

function buildSEOSuggestions(topicParams) {
  if (!topicParams) return null;
  const { suggestedTopic, keywords = [], category } = topicParams;
  const primaryKeyword = keywords[0] || suggestedTopic;
  const secondaryKeywords = keywords.slice(1, 7);
  const local = ["Suisse", "Genève", "PME"];
  const allKeywords = [...new Set([primaryKeyword, ...secondaryKeywords, ...local])];

  return {
    primaryKeyword,
    secondaryKeywords,
    allKeywords,
    metaTitle: `${suggestedTopic} | Ark Fiduciaire`.slice(0, 60),
    metaDescription: `Guide concret sur ${String(primaryKeyword).toLowerCase()} en Suisse (PME, employeurs, indépendants). Exemples, checklists, erreurs fréquentes.`.slice(
      0,
      160,
    ),
    category: category || guessCategoryFromText(suggestedTopic) || "general",
  };
}

module.exports = {
  fetchGoogleTrends,
  fetchGoogleTrendingRss,
  fetchGoogleSuggest,
  filterRelevantTrends,
  mapTrendToArticleParams,
  getTopicSuggestions,
  buildSEOSuggestions,
  EVERGREEN_TOPICS,
};
