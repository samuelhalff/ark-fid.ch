"use strict";

const fs = require("fs");
const path = require("path");

// Import trend and reference validation modules
const { getTopicSuggestions, buildSEOSuggestions } = require("./lib/trends");
const {
  validateReferences,
  deduplicateByDomain,
  getFallbackReferences,
  isTrustedDomain,
  ALLOWED_REFERENCE_DOMAINS,
} = require("./lib/referenceValidator");
const {
  extractOutdatedSwissVatRateMatches,
} = require("./lib/outdatedVatValidator");
const { buildLengthRecoveryPlan } = require("./lib/draftLengthRecovery");
const {
  TOPIC_KEYWORDS,
  describeTopic,
  detectTopic,
  findRecentTitleConflict,
  findRecentTopicConflict,
  getTopicSimilarityDetails,
  getTopicTokens,
} = require("./lib/articleTopicGuardrails");
const {
  getAvailableTopics,
  buildTopicGuidanceForAgent,
  validateArticleTopicAgainstAvailable,
} = require("./lib/topicSelector");
const {
  extractOpenAIMetrics,
  formatOpenAIMetricsLog,
  formatWordProgressLog,
} = require("./lib/openaiTelemetry");
const { buildAzureOpenAIChatBody } = require("./lib/azureOpenAIChatOptions");

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const APPLY = args.has("--apply");
const DRY = args.has("--dry-run");
const TRANSLATE_EXISTING = args.has("--translate-existing");
let MOCK_PATH = null;

for (const arg of rawArgs) {
  if (arg.startsWith("--mock=")) {
    MOCK_PATH = arg.slice("--mock=".length);
  }
}

function loadMockData(filePath) {
  try {
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    return JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (error) {
    throw new Error(
      `Failed to load mock data from ${filePath}: ${error.message}`,
    );
  }
}

const MOCK_DATA = MOCK_PATH ? loadMockData(MOCK_PATH) : null;
const OFFLINE_MODE = process.env.OFFLINE_MODE === "1";
const REQUIRE_TRANSLATIONS =
  process.env.REQUIRE_TRANSLATIONS === "1" || process.env.CI === "true";
const AI_TWO_STEP = process.env.AI_TWO_STEP === "1";
const FORCE_TOPIC = (process.env.FORCE_TOPIC || "").trim();
const FORCE_TOPIC_KEYWORDS = (process.env.FORCE_TOPIC_KEYWORDS || "")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const FORCE_TOPIC_CATEGORY = (process.env.FORCE_TOPIC_CATEGORY || "").trim();
const SKIP_TOPIC_ROTATION =
  process.env.SKIP_TOPIC_ROTATION === "1" || Boolean(FORCE_TOPIC);
const TOPIC_ROTATION_WINDOW = Math.max(
  1,
  parseInt(process.env.TOPIC_ROTATION_WINDOW || "10", 10) || 10,
);

const AZURE_AGENT_ENDPOINT = process.env.AZURE_AGENT_ENDPOINT;
const AZURE_AGENT_NAME = process.env.AZURE_AGENT_NAME;
const AZURE_AGENT_API_KEY = process.env.AZURE_AGENT_API_KEY;
const AZURE_AGENT_RESEARCH_NAME =
  process.env.AZURE_AGENT_RESEARCH_NAME || AZURE_AGENT_NAME;
const AZURE_AGENT_RESPONSES_API_VERSION =
  process.env.AZURE_AGENT_RESPONSES_API_VERSION || "2025-11-15-preview";
const AZURE_AGENT_FORCE_RESPONSES =
  process.env.AZURE_AGENT_FORCE_RESPONSES === "1";
const AZURE_AGENT_RESPONSES_RETRIES = parseInt(
  process.env.AZURE_AGENT_RESPONSES_RETRIES || "4",
  10,
);
const AZURE_AGENT_RESPONSES_BACKOFF_MS = parseInt(
  process.env.AZURE_AGENT_RESPONSES_BACKOFF_MS || "15000",
  10,
);
const AZURE_AGENT_RESPONSES_BACKOFF_MAX_MS = parseInt(
  process.env.AZURE_AGENT_RESPONSES_BACKOFF_MAX_MS || "120000",
  10,
);
const AZURE_AGENT_RESPONSES_BACKOFF_JITTER_MS = parseInt(
  process.env.AZURE_AGENT_RESPONSES_BACKOFF_JITTER_MS || "2000",
  10,
);
const AZURE_AGENT_RESPONSES_TIMEOUT_MS = parseInt(
  process.env.AZURE_AGENT_RESPONSES_TIMEOUT_MS || "180000",
  10,
);
const AZURE_AGENT_RESPONSES_COOLDOWN_MS = parseInt(
  process.env.AZURE_AGENT_RESPONSES_COOLDOWN_MS || "8000",
  10,
);
const AZURE_AGENT_RESPONSES_MAX_OUTPUT_TOKENS = parseInt(
  process.env.AZURE_AGENT_RESPONSES_MAX_OUTPUT_TOKENS || "0",
  10,
);
const AZURE_AGENT_FALLBACK_TO_OPENAI =
  process.env.AZURE_AGENT_FALLBACK_TO_OPENAI === "1";

const REFERENCE_MIN_COUNT = parseInt(
  process.env.REFERENCE_MIN_COUNT || "3",
  10,
);
const REFERENCE_MAX_COUNT = parseInt(
  process.env.REFERENCE_MAX_COUNT || "6",
  10,
);
const REFERENCE_MIN_TRUSTED_DOMAINS = parseInt(
  process.env.REFERENCE_MIN_TRUSTED_DOMAINS || "1",
  10,
);
const ALLOWED_REFERENCE_DOMAINS_PROMPT = [
  "Domaines autorisés pour les références publiées:",
  ALLOWED_REFERENCE_DOMAINS.join(", "),
].join(" ");

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_API_KEY = process.env.AZURE_OPENAI_API_KEY;
const AZURE_OPENAI_API_VERSION =
  process.env.AZURE_OPENAI_API_VERSION || "2024-05-01-preview";
const AZURE_OPENAI_DEPLOYMENT =
  process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-4.1";
const AZURE_OPENAI_DRAFT_ENDPOINT =
  process.env.AZURE_OPENAI_DRAFT_ENDPOINT || AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DRAFT_API_VERSION =
  process.env.AZURE_OPENAI_DRAFT_API_VERSION || AZURE_OPENAI_API_VERSION;
const AZURE_OPENAI_DRAFT_DEPLOYMENT =
  process.env.AZURE_OPENAI_DRAFT_DEPLOYMENT || AZURE_OPENAI_DEPLOYMENT;
const AZURE_OPENAI_DRAFT_MAX_TOKENS = parseInt(
  process.env.AZURE_OPENAI_DRAFT_MAX_TOKENS || "4096",
  10,
);
const AZURE_OPENAI_RESEARCH_ENDPOINT = process.env.AZURE_OPENAI_RESEARCH_ENDPOINT;
const AZURE_OPENAI_RESEARCH_API_VERSION =
  process.env.AZURE_OPENAI_RESEARCH_API_VERSION || AZURE_OPENAI_API_VERSION;
const AZURE_OPENAI_RESEARCH_DEPLOYMENT =
  process.env.AZURE_OPENAI_RESEARCH_DEPLOYMENT;
const AZURE_OPENAI_RESEARCH_API_KEY =
  process.env.AZURE_OPENAI_RESEARCH_API_KEY || AZURE_OPENAI_API_KEY;

const ROOT = process.cwd();
const TRANSLATIONS_DIR = path.join(ROOT, "src", "translations");
const FR_PATH = path.join(TRANSLATIONS_DIR, "fr", "ressources.json");
const LOCALES = ["en", "de", "es", "pt"];

const SERVICES = [
  "comptabilité (PME, indépendants, Swiss GAAP FER)",
  "audit et révision (contrôle ordinaire/restreint, opting-out, préparation du dossier)",
  "contrôle interne et gestion des risques (séparation des tâches, accès bancaires, workflows)",
  "fiscalité (TVA, impôt cantonal et fédéral, BEPS 2.0)",
  "corporate (gouvernance, PV, AG, conseils d'administration)",
  "paie (swissdec, LPP, LAA, AC, payroll externalisé)",
  "reporting de gestion (budget, forecast, KPIs, comptabilité analytique)",
  "trésorerie et financement (cash-flow, dossiers bancaires, retards de paiement)",
  "domiciliation et direction",
  "outsourcing administratif et financier",
  "implémentation Odoo et intégrations ERP (facture QR, CAMT, stock, e-commerce, workflows)",
  "fusions et acquisitions (M&A)",
  "transmission d'entreprise et due diligence financière",
  "family office (gestion de patrimoine, HNI)",
  "constitution et incorporation d'entreprise",
  "immigration et mobilité internationale (permis, ANobAG, expatriés)",
  "conformité réglementaire (SRO/OAR, LBA/AML, FINMA)",
];

function loadJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function isoDateToday() {
  return new Date().toISOString().slice(0, 10);
}

function hasUnnecessaryCaps(input) {
  if (!input || typeof input !== "string") return false;
  const tokens = input.split(/\s+/);
  for (const token of tokens) {
    if (!token) continue;
    const letters = token.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
    if (letters.length <= 3) continue;
    const upper = letters.toUpperCase();
    if (letters === upper) {
      return true;
    }
  }
  return false;
}

/**
 * Detects untranslated payloads by comparing title, description and content
 * against the canonical article.
 */
function isDuplicateTranslation(localized, canonical) {
  if (!localized || !canonical) return false;
  const sameTitle = (localized.title || "") === (canonical.title || "");
  const sameDesc =
    (localized.description || "") === (canonical.description || "");
  const sameContent = (localized.content || "") === (canonical.content || "");
  return sameTitle && sameDesc && sameContent;
}

function getLastArticle(frData) {
  const articles = Array.isArray(frData?.Articles) ? frData.Articles : [];
  if (!articles.length) return null;
  const sorted = [...articles].sort((a, b) =>
    (a.date || "").localeCompare(b.date || ""),
  );
  return sorted[sorted.length - 1];
}

/**
 * Analyze recent topic distribution and suggest underrepresented topics.
 * This ensures we don't keep writing about the same topics repeatedly.
 */
function analyzeRecentTopics(frData, recentCount = 15) {
  const articles = Array.isArray(frData?.Articles) ? frData.Articles : [];
  const sorted = [...articles].sort((a, b) =>
    (b.date || "").localeCompare(a.date || ""),
  );
  const recent = sorted.slice(0, recentCount);

  // Count topics in recent articles
  const topicCounts = {};
  for (const topic of TOPIC_KEYWORDS) {
    topicCounts[topic.topic] = 0;
  }
  topicCounts["general"] = 0;

  for (const article of recent) {
    const topic = detectTopic(article);
    topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  }

  // Find overrepresented topics (more than 2 articles in last 15)
  const overrepresented = [];
  for (const [topic, count] of Object.entries(topicCounts)) {
    if (count >= 2 && topic !== "general") {
      overrepresented.push({ topic, count, label: describeTopic(topic) });
    }
  }

  // Find underrepresented topics (0-1 articles in last 15)
  const underrepresented = TOPIC_KEYWORDS.filter(
    (t) => (topicCounts[t.topic] || 0) <= 1,
  ).map((t) => t.label);

  // Get recent topics in the enforced rotation window to avoid repetition
  const lastRotationTopics = recent
    .slice(0, TOPIC_ROTATION_WINDOW)
    .map((a) => detectTopic(a));

  return {
    topicCounts,
    overrepresented,
    underrepresented,
    lastRotationTopics,
    avoidTopics: [...new Set(lastRotationTopics.filter((t) => t !== "general"))],
    rotationWindow: TOPIC_ROTATION_WINDOW,
  };
}

function buildSystemPrompt(frJson, trendData = null, topicAnalysis = null) {
  const today = isoDateToday();
  const twelveMonthsAgo = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().slice(0, 10);
  })();
  const lastArticle = getLastArticle(frJson);
  const lastTopic = detectTopic(lastArticle);
  const minWords = parseInt(process.env.SEO_MIN_WORDS || "800", 10);
  const maxWords = parseInt(process.env.SEO_MAX_WORDS || "3000", 10);
  const lengthGuidance = process.env.SEO_MIN_WORDS
    ? `- Longueur MINIMALE: ${minWords} mots (objectif ${Math.max(minWords, 1500)} à ${Math.max(Math.max(minWords, 1500), maxWords)}). Si tu es en dessous, ajoute des sections (checklist, FAQ, e[...]`
    : "- Article format pratique (800 à 1500 mots), structuré avec sections claires, listes, exemples chiffrés.";
  const longFormRequirements =
    process.env.SEO_MIN_WORDS && minWords >= 1500
      ? [
          "- OBLIGATOIRE (pour atteindre la longueur): au moins 10 sections H2, plusieurs H3, 2 checklists, 2 tableaux, 1 cas pratique chiffré (CHF) et une FAQ de 6 questions.",
          "- OBLIGATOIRE: inclure une section 'processus étape-par-étape' et une section 'erreurs fréquentes + corrections'.",
        ]
      : [];
  const recentSlugs = (Array.isArray(frJson.Articles) ? frJson.Articles : [])
    .slice(-12)
    .map((a) => a.slug)
    .filter(Boolean);

  const topicNote = FORCE_TOPIC
    ? `Thème forcé pour cette mise à jour: "${FORCE_TOPIC}". La rotation thématique est désactivée.`
    : lastArticle
      ? `Dernier article publié le ${lastArticle.date}: "${
          lastArticle.title
        }". Thème identifié: ${describeTopic(
          lastTopic,
        )}. Choisis un nouveau sujet CLAIREMENT DIFFÉRENT pour maintenir l'alternance éditoriale.`
      : "Aucun article récent identifié. Choisis un sujet à forte valeur pour dirigeants PME genevois.";

  // Build topic diversity guidance
  const diversityGuidance = [];
  if (FORCE_TOPIC) {
    diversityGuidance.push(
      "ℹ️ Rotation thématique désactivée pour ce run (thème forcé).",
    );
  } else {
    if (topicAnalysis) {
      diversityGuidance.push(buildTopicGuidanceForAgent(topicAnalysis));
    }
  }

  // Build trend-based keyword guidance
  const trendGuidance = [];
  if (trendData && trendData.selectedTopic) {
    const { suggestedTopic, keywords, outline, category } =
      trendData.selectedTopic;
    const trendLabel = trendData.forced
      ? "Sujet imposé"
      : "Sujet suggéré par tendance";
    trendGuidance.push(
      "",
      "=== SIGNAUX TENDANCE SEO (à intégrer si pertinent) ===",
      `📈 ${trendLabel}: "${suggestedTopic}"`,
      `🔑 Mots-clés SEO cibles: ${keywords.join(", ")}`,
    );
    if (outline && outline.length > 0) {
      trendGuidance.push(`📋 Plan suggéré: ${outline.join(" → ")}`);
    }
    if (category) {
      trendGuidance.push(`📁 Catégorie thématique: ${category}`);
    }
    if (trendData.usedFallback) {
      trendGuidance.push(
        "ℹ️ (Sujet basé sur liste evergreen - tendances indisponibles)",
      );
    }
    trendGuidance.push(
      "",
      "⚠️ IMPORTANT: Intègre ces mots-clés naturellement dans le titre, la description et le contenu pour optimiser le SEO.",
      "⚠️ Le sujet suggéré est une indication, adapte-le selon nos services fiduciaires genevois.",
    );
  }

  const topicConstraint = FORCE_TOPIC
    ? "- Sujet cohérent avec nos services (liste ci-dessous) en respectant le thème imposé."
    : "- Sujet cohérent avec nos services (liste ci-dessous) et DIFFÉRENT des articles récents.";
  const slugConstraint = FORCE_TOPIC
    ? "- Aucun doublon de slug."
    : "- Aucun doublon de slug, ni de sujet déjà traité récemment.";

  return [
    "Tu es un assistant éditorial SEO expert pour Ark Fiduciaire (Genève, Suisse romande).",
    `Date actuelle: ${today}. Privilégie des éléments publiés ou mis à jour entre ${twelveMonthsAgo} et ${today}. Les pages officielles stables (admin.ch, fedlex.admin.ch, bsv.admin.ch, estv[...]`,
    topicNote,
    "",
    "=== DIVERSITÉ THÉMATIQUE (CRITIQUE) ===",
    ...diversityGuidance,
    ...trendGuidance,
    "",
    "Objectif: proposer EXACTEMENT 1 nouvel article (section « Articles ») en français, avec des conseils pratiques et utiles pour les visiteurs PME/indépendants.",
    "",
    "=== STYLE D'ÉCRITURE (CRITIQUE — ton humain obligatoire) ===",
    "Écris comme un expert fiduciaire genevois qui rédige un article de blog, PAS comme une IA.",
    "- Ton direct et franc, comme si tu expliquais le sujet à un client. Utilise « vous » et glisse des « on » naturels.",
    "- Varie le rythme: phrases courtes et percutantes à côté de phrases plus longues. Pas de cadence monotone.",
    "- Permets-toi des tournures parlées (« Attention, piège classique », « Résultat? », « Concrètement, ça veut dire… »).",
    "- NE COMMENCE JAMAIS par une section « Introduction ». Entre directement dans le vif du sujet.",
    "- Titres H2/H3 concrets et spécifiques, pas génériques (ex: « 3 erreurs qui coûtent cher aux Sàrl » plutôt que « Erreurs fréquentes »).",
    "- Varie la longueur des paragraphes et évite le schéma répétitif « intro → liste → conclusion » pour chaque section.",
    "- Ajoute 1-2 observations de terrain ou anecdotes professionnelles pour ancrer le propos.",
    "- Ose une opinion professionnelle assumée (« À notre avis, la meilleure approche… »).",
    "",
    "MOTS ET TOURNURES INTERDITS (typiques d'une IA):",
    "- « il est important de noter », « il convient de », « il est essentiel de », « il est crucial de »",
    "- « en effet », « de plus », « par ailleurs », « en outre », « de surcroît »",
    "- « dans ce contexte », « à cet égard », « dans cette optique »",
    "- « n'hésitez pas à », « il va sans dire », « force est de constater »",
    "- « ainsi » en début de phrase, « en conclusion », « en résumé » (fin d'article)",
    "- « permettre de », « afin de » (quand « pour » suffit), « optimiser », « maximiser », « naviguer dans » (figuré)",
    "- Formules creuses: « Dans un monde où… », « Face à… », « À l'ère de… »",
    "",
    "=== FAITS VÉRIFIÉS (ne pas contredire) ===",
    "- Taux de TVA suisses (depuis le 1er janvier 2024): taux normal 8,1 %, taux réduit 2,6 %, taux spécial hébergement 3,8 %. Les anciens taux (7,7 %, 2,5 %, 3,7 %) ne sont plus en vigueur.",
    "- INTERDIT ABSOLU: ne mentionne jamais les anciens taux 7,7 %, 2,5 % ou 3,7 %, même pour une comparaison historique. Si tu parles des taux, utilise uniquement 8,1 %, 2,6 % et 3,8 %.",
    "",
    "Contraintes impératives:",
    "- FOCUS sur des conseils pratiques, astuces concrètes, erreurs courantes à éviter, guides étape-par-étape, taux/rates actuels par canton/activité.",
    "- Exemples souhaités: omissions courantes dans déclarations fiscales, taux sociaux par canton, taux TVA par activité, conformité LBA/AML, obtention de licences FINMA, affiliation SRO/OAR[...]",
    "- ÉVITER les articles généraux ou théoriques; privilégier le concret et l'actionnable.",
    topicConstraint,
    slugConstraint,
    lengthGuidance,
    ...longFormRequirements,
    "- Titres: utilise la syntaxe Markdown (## pour H2, ### pour H3) sans écrire « H2 » ou « H3 » dans le texte.",
    "- Style professionnel, humain, sans capitales superflues.",
    "- Références: fournis 4 à 6 liens vérifiables (HTTP 200, pas de login), sans URL inventée.",
    "- Références: inclure au moins 1 source officielle (admin.ch / fedlex.admin.ch / bsv.admin.ch / estv.admin.ch / seco.admin.ch / finma.ch, etc.).",
    "- Références: compléter uniquement avec des sources institutionnelles, associations professionnelles, institutions académiques, registres officiels, documentation officielle Odoo ou site[...]",
    ALLOWED_REFERENCE_DOMAINS_PROMPT,
    "- Inspiration privée autorisée: tu peux lire des concurrents pour comprendre le sujet, mais tu ne dois jamais publier leur URL comme source.",
    "- INTERDIT: ne JAMAIS citer de sites concurrents ou de cabinets (fiduciaires, treuhand, avocats, notaires, comptables, experts-comptables, consultants, intégrateurs Odoo, steuerberater, kan[...]",
    "- Chaque domaine ne doit être représenté qu'une seule fois dans les références (pas de doublons de domaine).",
    `Slugs récents à éviter: ${recentSlugs.join(", ") || "aucun"}.`,
    `Services à promouvoir: ${SERVICES.join(", ")}.`,
    "",
    "Format de sortie STRICT (application/json):",
    "{",
    '  "newArticle": {',
    '    "slug": "<slug-unique-fr>",',
    '    "title": "<titre FR>",',
    '    "description": "<description FR>",',
    '    "content": "<contenu FR complet (Markdown autorisé)>",',
    '    "author": "Ark Fiduciaire",',
    '    "date": "YYYY-MM-DD",',
    '    "references": [ { "labelKey": "Libellé FR", "url": "https://..." }, ... ]',
    "  },",
    '  "newLabels": {',
    '    "Libellé FR": "Texte à afficher (FR)"',
    "  }",
    "}",
  ].join("\n");
}

// ... [Rest of the file remains the same until enforceTopicRotation] ...

function enforceTopicRotation(frData, newArticle, topicAnalysis = null) {
  if (SKIP_TOPIC_ROTATION) {
    return;
  }
  const articles = Array.isArray(frData?.Articles) ? frData.Articles : [];
  if (!articles.length) return;

  // Pre-check: validate against available topics if analysis provided
  if (topicAnalysis) {
    const preCheck = validateArticleTopicAgainstAvailable(newArticle, topicAnalysis);
    if (!preCheck.valid) {
      const err = new Error(preCheck.error);
      err.code = "TOPIC_NOT_IN_AVAILABLE_POOL";
      err.topic = preCheck.detectedTopic;
      throw err;
    }
  }

  const conflict = findRecentTopicConflict(articles, newArticle, {
    windowSize: TOPIC_ROTATION_WINDOW,
  });
  if (!conflict) {
    return;
  }

  if (conflict.code === "TOPIC_DUPLICATE") {
    const err = new Error(
      `Le thème "${describeTopic(conflict.topic)}" a déjà été traité dans les ${TOPIC_ROTATION_WINDOW} derniers articles (article: "${conflict.previousTitle}")`,
    );
    err.code = conflict.code;
    err.topic = conflict.topic;
    err.previousTitle = conflict.previousTitle;
    err.previousSlug = conflict.previousSlug;
    throw err;
  }

  const err = new Error(
    `Sujet trop similaire à un article récent ("${conflict.previousTitle}", similarité ${(conflict.similarity * 100).toFixed(0)}%)`,
  );
  err.code = conflict.code;
  err.previousTitle = conflict.previousTitle;
  err.previousSlug = conflict.previousSlug;
  err.similarity = conflict.similarity;
  throw err;
}

// ... [Continue with rest of file, updating generateArticleWithRetries and other relevant functions]

async function generateArticleWithRetries(frData, attempts, trendData = null, topicAnalysis = null) {
  const basePrompt = buildSystemPrompt(frData, trendData, topicAnalysis);
  let prompt = basePrompt;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(
      `Requesting Azure Agent for new FR article... (attempt ${attempt}/${attempts})`,
    );

    let draft;
    if (MOCK_DATA?.draft) {
      draft = MOCK_DATA.draft;
    } else {
      draft = await requestAgentJson(prompt, { agentName: AZURE_AGENT_NAME });
    }

    try {
      const newArticle = draft.newArticle;
      const newLabels = draft.newLabels || {};
      validateNewArticle(frData, newArticle);
      enforceTopicRotation(frData, newArticle, topicAnalysis);
      normalizeArticleDates(newArticle);
      return { newArticle, newLabels, trendData };
    } catch (error) {
      lastError = error;
      console.warn(`Draft invalid: ${error.message}`);
      prompt = buildRetryPrompt(basePrompt, error, frData);
    }
  }

  throw (
    lastError ||
    new Error("Échec génération article après plusieurs tentatives")
  );
}

// [Include all the rest of the original file content here - extractJsonFromText, azureOpenAIJson, 
// requestAgentJson, main(), etc. - with updated call to generateArticleWithRetries including topicAnalysis]

async function main() {
  if (!fs.existsSync(FR_PATH)) {
    throw new Error(`Canonical FR ressources file not found: ${FR_PATH}`);
  }
  if (!MOCK_DATA) {
    ensureAzureEnv();
  }

  const frData = loadJSON(FR_PATH);

  // Get existing slugs and topic analysis for pre-generation validation
  const existingSlugs = (Array.isArray(frData.Articles) ? frData.Articles : [])
    .map((a) => a.slug)
    .filter(Boolean);
  const topicAnalysis = analyzeRecentTopics(frData, 15);
  
  // **NEW: Get available topics before generation**
  const availableTopicsAnalysis = getAvailableTopics(
    frData,
    topicAnalysis.avoidTopics,
    TOPIC_ROTATION_WINDOW,
  );
  console.log(
    `\n📋 Available topics for selection: ${availableTopicsAnalysis.availableTopics.map((t) => t.label).join(", ")}`,
  );

  let trendData;
  if (FORCE_TOPIC) {
    const forcedKeywords = FORCE_TOPIC_KEYWORDS.length
      ? FORCE_TOPIC_KEYWORDS
      : [FORCE_TOPIC];
    trendData = {
      selectedTopic: {
        suggestedTopic: FORCE_TOPIC,
        keywords: forcedKeywords,
        category: FORCE_TOPIC_CATEGORY || undefined,
      },
      forced: true,
      provider: "forced",
      usedFallback: true,
      trendsChecked: 0,
      relevantTrendsChecked: 0,
      error: null,
    };
    console.log(`\n📌 Forced topic requested: "${FORCE_TOPIC}"`);
  } else {
    console.log("\n📊 Fetching trend signals for topic selection...");
    trendData = await getTopicSuggestions({
      existingSlugs,
      avoidTopics: topicAnalysis.avoidTopics,
      recentTopicCategories: topicAnalysis.lastRotationTopics,
      topicCounts: topicAnalysis.topicCounts,
    });
  }

  if (trendData.selectedTopic) {
    console.log(`[trends] Provider: ${trendData.provider}`);
    console.log(`[trends] Trends checked: ${trendData.trendsChecked}`);
    console.log(`[trends] Used fallback: ${trendData.usedFallback}`);
    console.log(
      `[trends] Selected topic: "${trendData.selectedTopic.suggestedTopic}"`,
    );
    console.log(
      `[trends] Target keywords: ${trendData.selectedTopic.keywords?.join(", ")}`,
    );
    if (trendData.error) {
      console.warn(`[trends] API warning: ${trendData.error}`);
    }
  }

  const seoSuggestions = buildSEOSuggestions(trendData.selectedTopic);
  if (seoSuggestions) {
    console.log(`[seo] Primary keyword: "${seoSuggestions.primaryKeyword}"`);
    console.log(`[seo] Category: ${seoSuggestions.category}`);
  }

  let newArticle;
  let newLabels;

  if (AI_TWO_STEP) {
    if (!MOCK_DATA) {
      ensureOpenAIEnv();
    }
    const { research } = await generateResearchWithRetries(
      frData,
      parseInt(process.env.AI_RESEARCH_RETRIES || "2", 10),
      trendData,
      seoSuggestions,
    );

    const refCarrier = {
      title: research.title,
      slug: research.slug,
      content: "",
      references: Array.isArray(research.references) ? research.references : [],
    };
    await repairReferences(refCarrier, research.category || "general");
    const validatedReferences = Array.isArray(refCarrier.references)
      ? refCarrier.references
      : [];

    const drafted = await draftArticleFromResearch(
      frData,
      research,
      validatedReferences,
    );
    newArticle = drafted.newArticle;
    newLabels = drafted.newLabels || {};
  } else {
    const drafted = await generateArticleWithRetries(
      frData,
      parseInt(process.env.AI_ARTICLE_RETRIES || "3", 10),
      trendData,
      availableTopicsAnalysis,
    );
    newArticle = drafted.newArticle;
    newLabels = drafted.newLabels || {};
  }

  const articleCategory =
    seoSuggestions?.category || detectTopic(newArticle) || "general";
  await repairReferences(newArticle, articleCategory);
  syncContentReferencesSection(newArticle);
  sanitizeContentExternalLinks(newArticle);
  normalizeMarkdownHeadings(newArticle);
  normalizeArticleDates(newArticle);
  logArticleMetrics(newArticle, "FR");

  if (DRY || !APPLY) {
    console.log("[dry-run] Would append article to FR:", {
      newArticle,
      newLabels,
    });
  } else {
    const updated = { ...frData };
    updated.Articles = Array.isArray(updated.Articles)
      ? updated.Articles.slice()
      : [];
    updated.Articles.push({ ...newArticle, content: newArticle.content });
    mergeLabels(updated, newLabels);
    saveJSON(FR_PATH, updated);
    console.log("FR updated with 1 Article.");
  }

  console.log("Requesting Azure OpenAI translations (EN/DE/ES/PT)...");
  let translations;
  if (MOCK_DATA?.translations) {
    translations = MOCK_DATA.translations;
  } else {
    ensureOpenAIEnv();
    translations = await azureOpenAITranslateJson(
      buildTranslatePrompt(newArticle, newLabels),
    );
  }
  if (REQUIRE_TRANSLATIONS) {
    assertTranslationPayload(translations, LOCALES);
  }

  for (const locale of LOCALES) {
    const targetPath = path.join(TRANSLATIONS_DIR, locale, "ressources.json");
    if (!fs.existsSync(targetPath)) {
      console.warn(`[WARN] Missing ${locale}/ressources.json; skipping.`);
      continue;
    }
    const data = loadJSON(targetPath);
    data.Articles = Array.isArray(data.Articles) ? data.Articles : [];
    const seenSlugs = new Set(data.Articles.map((a) => a.slug));

    const payload = translations[locale];
    if (!payload || !payload.Article) {
      const message = `[WARN] Missing translation payload for ${locale}; skipping.`;
      if (REQUIRE_TRANSLATIONS) {
        throw new Error(message);
      }
      console.warn(message);
      continue;
    }
    const articleTr = payload.Article;
    const labelsTr = payload.labels || {};
    const localizedArticle = {
      slug: newArticle.slug,
      title: articleTr.title,
      description: articleTr.description,
      content: articleTr.content,
      author: newArticle.author,
      date: newArticle.date,
      references: newArticle.references,
    };

    if (
      REQUIRE_TRANSLATIONS &&
      isDuplicateTranslation(localizedArticle, newArticle)
    ) {
      throw new Error(
        `[ERROR] ${locale} translation matches FR content for ${newArticle.slug}.`,
      );
    }

    if (
      hasUnnecessaryCaps(localizedArticle.title) ||
      hasUnnecessaryCaps(localizedArticle.description)
    ) {
      console.warn(`[WARN] Caps heuristic flagged in ${locale} article text.`);
    }

    if (DRY || !APPLY) {
      console.log(`[dry-run] Would append to ${locale}:`, {
        article: localizedArticle,
        labels: labelsTr,
      });
      continue;
    }

    if (!seenSlugs.has(localizedArticle.slug)) {
      data.Articles.push(localizedArticle);
    }
    mergeLabels(data, labelsTr);
    saveJSON(targetPath, data);
    console.log(`${locale} updated.`);
  }

  if (TRANSLATE_EXISTING && APPLY && !DRY) {
    const spawnSync = require("child_process").spawnSync;
    console.log("Regenerating translations for existing articles...");
    const result = spawnSync(
      "node",
      ["scripts/translate-articles.js", "--apply"],
      {
        stdio: "inherit",
        env: process.env,
      },
    );
    if (result.status !== 0) {
      throw new Error(
        `translate-articles.js failed with exit code ${result.status}`,
      );
    }
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
