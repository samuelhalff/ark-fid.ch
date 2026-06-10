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
  extractOpenAIMetrics,
  formatOpenAIMetricsLog,
  formatWordProgressLog,
} = require("./lib/openaiTelemetry");
const {
  getAvailableTopics,
  buildTopicGuidanceForAgent,
  validateArticleTopicAgainstAvailable,
} = require("./lib/topicSelector");
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

const TOPIC_TAGS = {
  odoo: ["odoo", "erp", "comptabilite", "tva", "automatisation", "reporting"],
  payroll: ["paie", "salaires", "avs", "lpp", "laa", "swissdec"],
  tax: ["fiscalite", "impot", "tva", "ifd", "tax", "declaration"],
  audit: ["audit", "revision", "controle", "rapport", "seuils", "gouvernance"],
  accounting: ["comptabilite", "comptable", "bilan", "reporting", "cloture", "fer"],
  corporate: ["corporate", "gouvernance", "assemblee", "registre", "transparence", "sa"],
  domiciliation: ["domiciliation", "siege", "adresse", "courrier", "substance", "aml"],
  outsourcing: ["outsourcing", "externalisation", "bpo", "processus", "finance", "reporting"],
  ma: ["fusion", "acquisition", "due", "diligence", "transmission", "valorisation"],
  "family-office": ["patrimoine", "succession", "family", "office", "fortune", "gouvernance"],
  incorporation: ["constitution", "creation", "registre", "capital", "statuts", "succursale"],
  immigration: ["immigration", "permis", "anobag", "mobilite", "expatrie", "avs"],
  finance: ["tresorerie", "finance", "cash", "budget", "forecast", "paiement"],
  regulatory: ["conformite", "reglementaire", "oar", "lba", "aml", "finma"],
  general: ["pme", "suisse", "geneve", "fiduciaire", "conseil", "entreprise"],
};

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

function normalizeTag(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureArticleTaxonomy(article, preferredCategory = "") {
  const category = preferredCategory || article.category || detectTopic(article) || "general";
  article.category = category;

  const corpus = normalizeTag(
    `${article.content || ""} ${article.title || ""} ${article.description || ""}`,
  ).replace(/-/g, " ");
  const candidates = [
    ...(FORCE_TOPIC_KEYWORDS || []),
    ...((TOPIC_TAGS[category] || TOPIC_TAGS.general) || []),
    ...TOPIC_TAGS.general,
  ]
    .map(normalizeTag)
    .filter(Boolean);

  const tags = [];
  for (const tag of candidates) {
    if (tags.length >= 6) break;
    if (!tags.includes(tag) && corpus.includes(tag.replace(/-/g, " "))) {
      tags.push(tag);
    }
  }
  for (const tag of candidates) {
    if (tags.length >= 3) break;
    if (!tags.includes(tag)) tags.push(tag);
  }
  article.tags = tags.slice(0, 6);
  return article;
}

function normalizeArticleUiLabels(content, labels) {
  if (typeof content !== "string" || !labels) return content;
  let normalized = content
    .replace(
      /^### Related Services$/gim,
      `### ${labels.relatedServices || "Related services"}`,
    )
    .replace(
      /^## Related Services$/gim,
      `## ${labels.relatedServices || "Related services"}`,
    )
    .replace(
      /\[Contact Us\]\(\/contact\)/g,
      `[${labels.contactUs || "Contact us"}](/contact)`,
    );

  for (const [source, target] of Object.entries(labels.services || {})) {
    normalized = normalized.replace(
      new RegExp(`\\[${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "g"),
      `[${target}]`,
    );
  }
  return normalized;
}

function normalizeArticleUiLabelsInPlace(article, labels) {
  if (!article || typeof article.content !== "string") return;
  article.content = normalizeArticleUiLabels(article.content, labels);
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
    ? `- Longueur MINIMALE: ${minWords} mots (objectif ${Math.max(minWords, 1500)} à ${Math.max(Math.max(minWords, 1500), maxWords)}). Si tu es en dessous, ajoute des sections (checklist, FAQ, exemples chiffrés, cas cantonaux, cas pratiques).`
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
    `Date actuelle: ${today}. Privilégie des éléments publiés ou mis à jour entre ${twelveMonthsAgo} et ${today}. Les pages officielles stables (admin.ch, fedlex.admin.ch, bsv.admin.ch, estv.admin.ch, seco.admin.ch, finma.ch, kmu.admin.ch, ch.ch) peuvent être plus anciennes si elles sont encore valables.`,
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
    "- Exemples souhaités: omissions courantes dans déclarations fiscales, taux sociaux par canton, taux TVA par activité, conformité LBA/AML, obtention de licences FINMA, affiliation SRO/OAR, quand/déclarer comment, pièges à éviter, optimisations légales.",
    "- ÉVITER les articles généraux ou théoriques; privilégier le concret et l'actionnable.",
    topicConstraint,
    slugConstraint,
    lengthGuidance,
    ...longFormRequirements,
    "- Titres: utilise la syntaxe Markdown (## pour H2, ### pour H3) sans écrire « H2 » ou « H3 » dans le texte.",
    "- Style professionnel, humain, sans capitales superflues.",
    "- Références: fournis 4 à 6 liens vérifiables (HTTP 200, pas de login), sans URL inventée.",
    "- Références: inclure au moins 1 source officielle (admin.ch / fedlex.admin.ch / bsv.admin.ch / estv.admin.ch / seco.admin.ch / finma.ch, etc.).",
    "- Références: compléter uniquement avec des sources institutionnelles, associations professionnelles, institutions académiques, registres officiels, documentation officielle Odoo ou sites reconnus de cette liste.",
    ALLOWED_REFERENCE_DOMAINS_PROMPT,
    "- Inspiration privée autorisée: tu peux lire des concurrents pour comprendre le sujet, mais tu ne dois jamais publier leur URL comme source.",
    "- INTERDIT: ne JAMAIS citer de sites concurrents ou de cabinets (fiduciaires, treuhand, avocats, notaires, comptables, experts-comptables, consultants, intégrateurs Odoo, steuerberater, kanzlei, Big 4, etc.). Aucun lien vers un cabinet concurrent.",
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
    '    "category": "<topic slug: odoo|payroll|tax|audit|accounting|corporate|domiciliation|outsourcing|ma|family-office|incorporation|immigration|finance|regulatory|general>",',
    '    "tags": ["<tag-slug-1>", "<tag-slug-2>", "<tag-slug-3>"],',
    '    "references": [ { "labelKey": "Libellé FR", "url": "https://..." }, ... ]',
    "  },",
    '  "newLabels": {',
    '    "Libellé FR": "Texte à afficher (FR)"',
    "  }",
    "}",
  ].join("\n");
}

function buildTranslatePrompt(newArticle, newLabels) {
  return [
    "Tu es traducteur professionnel. Traduis les champs ci-dessous en conservant les structures, slugs, URLs et clés.",
    'Respecte les minuscules/majuscules d\'origine et garde "Ark Fiduciaire" tel quel.',
    "Fourni uniquement le JSON demandé, sans commentaire.",
    "IMPORTANT: Chaque locale (en, de, es, pt) doit être traduite. Ne retourne jamais le texte français pour une autre langue.",
    "",
    "Format attendu:",
    "{",
    '  "en": { "Article": { "title": "...", "description": "...", "content": "..." }, "labels": { "Libellé FR": "English label" } },',
    '  "de": { "Article": { ... }, "labels": { ... } },',
    '  "es": { "Article": { ... }, "labels": { ... } },',
    '  "pt": { "Article": { ... }, "labels": { ... } }',
    "}",
    "",
    "Entrée source:",
    JSON.stringify({ newArticle, newLabels }, null, 2),
  ].join("\n");
}

function buildResearchPrompt(
  frJson,
  trendData,
  seoSuggestions,
  topicAnalysis = null,
) {
  const today = isoDateToday();
  const twelveMonthsAgo = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 12);
    return d.toISOString().slice(0, 10);
  })();

  const recentSlugs = (Array.isArray(frJson.Articles) ? frJson.Articles : [])
    .slice(-12)
    .map((a) => a.slug)
    .filter(Boolean);

  const minWords = parseInt(process.env.SEO_MIN_WORDS || "800", 10);
  const maxWords = parseInt(process.env.SEO_MAX_WORDS || "3000", 10);

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
      `🔑 Mots-clés SEO cibles: ${Array.isArray(keywords) ? keywords.join(", ") : ""}`,
    );
    if (outline && outline.length > 0) {
      trendGuidance.push(`📋 Plan suggéré: ${outline.join(" → ")}`);
    }
    if (category) {
      trendGuidance.push(`📁 Catégorie thématique: ${category}`);
    }
  }

  const diversityGuidance = FORCE_TOPIC
    ? ["ℹ️ Rotation thématique désactivée pour ce run (thème forcé)."]
    : topicAnalysis
      ? [buildTopicGuidanceForAgent(topicAnalysis)]
      : [];
  const forcedTopicLine = FORCE_TOPIC
    ? `Thème imposé pour cette mise à jour: "${FORCE_TOPIC}".`
    : "";
  const topicConstraint = FORCE_TOPIC
    ? "- Sujet cohérent avec nos services (liste ci-dessous) en respectant le thème imposé."
    : "- Sujet cohérent avec nos services (liste ci-dessous) et différent des articles récents.";

  return [
    "Tu es un stratège SEO + chercheur web pour Ark Fiduciaire (Genève, Suisse romande).",
    `Date actuelle: ${today}. Privilégie des sources publiées ou mises à jour entre ${twelveMonthsAgo} et ${today}. Les pages officielles stables (admin.ch, fedlex.admin.ch, bsv.admin.ch, estv.admin.ch, seco.admin.ch, finma.ch, kmu.admin.ch, ch.ch) peuvent être plus anciennes si elles sont encore valables.`,
    "",
    forcedTopicLine,
    "=== DIVERSITÉ THÉMATIQUE (CRITIQUE) ===",
    ...diversityGuidance,
    ...trendGuidance,
    "",
    "Objectif: proposer 1 sujet + plan + références vérifiables (PAS l'article complet).",
    "",
    "=== FAITS VÉRIFIÉS (ne pas contredire) ===",
    "- Taux de TVA suisses (depuis le 1er janvier 2024): taux normal 8,1 %, taux réduit 2,6 %, taux spécial hébergement 3,8 %. Les anciens taux (7,7 %, 2,5 %, 3,7 %) ne sont plus en vigueur.",
    "- INTERDIT ABSOLU: ne mentionne jamais les anciens taux 7,7 %, 2,5 % ou 3,7 %, même pour une comparaison historique. Si tu parles des taux, utilise uniquement 8,1 %, 2,6 % et 3,8 %.",
    "",
    "Contraintes:",
    topicConstraint,
    `- L'article final fera ${Math.max(minWords, 1500)} à ${Math.max(Math.max(minWords, 1500), maxWords)} mots.`,
    "- Références: fournir 12 à 18 liens vérifiables (HTTP 200, pas de login), sans URL inventée.",
    "- Références: inclure au moins 2 sources officielles (admin.ch / fedlex.admin.ch / bsv.admin.ch / estv.admin.ch / seco.admin.ch / finma.ch, etc.).",
    "- Références: compléter uniquement avec des sources institutionnelles, associations professionnelles, institutions académiques, registres officiels, documentation officielle Odoo ou sites reconnus de cette liste.",
    ALLOWED_REFERENCE_DOMAINS_PROMPT,
    "- Inspiration privée autorisée: tu peux lire des concurrents pour comprendre le sujet, mais tu ne dois jamais publier leur URL comme source.",
    "- INTERDIT: ne JAMAIS citer de sites concurrents ou de cabinets (fiduciaires, treuhand, avocats, notaires, comptables, experts-comptables, consultants, intégrateurs Odoo, steuerberater, kanzlei, Big 4, etc.). Aucun lien vers un cabinet concurrent.",
    "- STRICT: chaque référence doit provenir d'un domaine différent (1 domaine = 1 lien). Si tu donnes 12 références, ce sont 12 domaines distincts, sinon la réponse est rejetée.",
    `Slugs récents à éviter: ${recentSlugs.join(", ") || "aucun"}.`,
    `Services à promouvoir: ${SERVICES.join(", ")}.`,
    "",
    seoSuggestions?.primaryKeyword
      ? `Mot-clé principal à viser: ${seoSuggestions.primaryKeyword}`
      : "",
    "",
    "Format de sortie STRICT (application/json):",
    "{",
    '  "research": {',
    '    "slug": "<slug-unique-fr>",',
    '    "title": "<titre FR>",',
    '    "description": "<description FR>",',
    '    "category": "<payroll|tax|corporate|odoo|accounting|audit|incorporation|immigration|regulatory|outsourcing|ma|family-office|domiciliation|finance|general>",',
    '    "primaryKeyword": "<mot-clé principal>",',
    '    "secondaryKeywords": ["..."],',
    '    "outline": ["H2 ...", "H2 ...", "FAQ ..."],',
    '    "references": [ { "labelKey": "Libellé FR", "url": "https://..." }, ... ]',
    "  }",
    "}",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildDraftPromptFromResearch(research, validatedReferences) {
  const minWords = parseInt(process.env.SEO_MIN_WORDS || "1500", 10);
  const maxWords = parseInt(process.env.SEO_MAX_WORDS || "3000", 10);
  return [
    "Tu es un rédacteur SEO senior pour Ark Fiduciaire (Genève).",
    "Rédige un article long et utile, très concret, sans blabla.",
    "",
    "=== STYLE D'ÉCRITURE (CRITIQUE — lire attentivement) ===",
    "Écris comme un expert fiduciaire genevois qui rédige un article de blog, PAS comme une IA.",
    "",
    "TONALITÉ ET VOIX:",
    "- Ton direct et franc, comme si tu expliquais le sujet à un client lors d'un rendez-vous.",
    "- Utilise « vous » pour t'adresser au lecteur. Glisse parfois un « on » naturel.",
    "- Permets-toi des phrases courtes et percutantes à côté de phrases plus longues. Varie le rythme.",
    "- Ose des tournures parlées ou légèrement familières quand c'est approprié (« Attention, c'est un piège classique », « Résultat? », « Concrètement, ça veut dire que… »).",
    "- N'hésite pas à interpeller le lecteur: questions rhétoriques, mises en situation, petites provocations.",
    "",
    "MOTS ET EXPRESSIONS INTERDITS (typiques d'une IA — ne JAMAIS utiliser):",
    "- « il est important de noter », « il convient de », « il est essentiel de », « il est crucial de »",
    "- « en effet », « de plus », « par ailleurs », « en outre », « de surcroît », « qui plus est »",
    "- « dans ce contexte », « à cet égard », « dans cette optique », « dans le cadre de »",
    "- « n'hésitez pas à », « il va sans dire », « force est de constater »",
    "- « ainsi » en début de phrase, « en conclusion », « pour conclure », « en résumé » (en conclusion d'article)",
    "- « permettre de », « afin de » (quand « pour » suffit)",
    "- « l'importance de », « un aspect crucial », « un élément clé », « un facteur déterminant »",
    "- « optimiser », « maximiser », « tirer parti de », « naviguer dans » (sens figuré)",
    "- Toute formule creuse du type « Dans un monde où… », « Face à… », « À l'ère de… »",
    "",
    "STRUCTURE ET RYTHME:",
    "- NE COMMENCE JAMAIS par une section intitulée « Introduction ». Entre directement dans le vif du sujet.",
    "- Varie la longueur des paragraphes: certains courts (1-2 phrases), d'autres plus développés.",
    "- Mélange les formats: paragraphes narratifs, listes à puces, tableaux, exemples chiffrés — sans suivre un schéma répétitif.",
    "- Évite le schéma prévisible « phrase d'intro → liste à puces → phrase de conclusion » pour chaque section.",
    "- Les titres H2 et H3 doivent être concrets et spécifiques, pas génériques (« 3 erreurs qui coûtent cher aux Sàrl genevoises » plutôt que « Erreurs fréquentes »).",
    "- Ne termine pas chaque section par une phrase de transition ou un résumé. Certaines sections s'arrêtent net, d'autres enchaînent naturellement.",
    "",
    "CE QUI FAIT LA DIFFÉRENCE (un article humain vs un article IA):",
    "- Ajoute 1 à 2 anecdotes ou observations de terrain (« En pratique, beaucoup de PME genevoises découvrent ce problème au moment du bouclement… »).",
    "- Mentionne des spécificités locales: cantons, offices, délais réels, montants courants.",
    "- Utilise des chiffres précis plutôt que des fourchettes vagues.",
    "- Les exemples chiffrés doivent être réalistes et situés (entreprise type, secteur, canton).",
    "- Permets-toi une opinion professionnelle assumée (« À notre avis, la meilleure approche reste… »).",
    "",
    "=== FAITS VÉRIFIÉS (ne pas contredire) ===",
    "- Taux de TVA suisses (depuis le 1er janvier 2024): taux normal 8,1 %, taux réduit 2,6 %, taux spécial hébergement 3,8 %. Les anciens taux (7,7 %, 2,5 %, 3,7 %) ne sont plus en vigueur.",
    "- INTERDIT ABSOLU: ne mentionne jamais les anciens taux 7,7 %, 2,5 % ou 3,7 %, même pour une comparaison historique. Si tu parles des taux, utilise uniquement 8,1 %, 2,6 % et 3,8 %.",
    "",
    `CONTRAINTE DE LONGUEUR (STRICTE): entre ${Math.max(minWords, 1500)} et ${Math.max(maxWords, Math.max(minWords, 1500))} mots (viser ~2200).`,
    "Si tu es en dessous du minimum, tu DOIS ajouter du contenu (plus de H2/H3, plus d'explications, plus d'exemples). Ne termine pas tôt.",
    "Structure obligatoire: 10+ sections H2, plusieurs H3, 2 tableaux, 2 checklists, 1 cas pratique chiffré (CHF), une section étape-par-étape, une section erreurs fréquentes + corrections, et une FAQ de 6 questions.",
    "Astuce pour atteindre la longueur: fais des sections orientées décision (risques, contrôles, documents, exemples) et des listes actionnables.",
    "IMPORTANT:",
    "- N'invente AUCUN lien ni URL.",
    "- N'inclus AUCUNE URL dans le texte (pas de http/https).",
    "- Quand tu cites une source, écris simplement (source: <labelKey>).",
    "- Titres: utilise ## pour H2 et ### pour H3, sans préfixer les titres par « H2 » ou « H3 ».",
    "- Utilise exactement le slug, titre et description fournis.",
    "",
    "Plan à suivre:",
    JSON.stringify(research.outline || [], null, 2),
    "",
    "Références disponibles (ne pas modifier, ne pas ajouter):",
    JSON.stringify(validatedReferences, null, 2),
    "",
    "Format de sortie STRICT (application/json):",
    "{",
    '  "newArticle": {',
    `    "slug": ${JSON.stringify(research.slug)},`,
    `    "title": ${JSON.stringify(research.title)},`,
    `    "description": ${JSON.stringify(research.description)},`,
    '    "content": "<contenu FR complet en Markdown (sans URLs)>",',
    '    "author": "Ark Fiduciaire",',
    '    "date": "YYYY-MM-DD",',
    '    "category": "<topic slug>",',
    '    "tags": ["<tag-slug-1>", "<tag-slug-2>", "<tag-slug-3>"],',
    '    "references": [ { "labelKey": "Libellé FR", "url": "https://..." }, ... ]',
    "  },",
    '  "newLabels": {',
    '    "Libellé FR": "Texte à afficher (FR)"',
    "  }",
    "}",
  ].join("\n");
}

function extractJsonFromText(raw) {
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty Azure Agent response");
  }
  const fixBadJsonEscapes = (input) =>
    // Fix invalid escape sequences like "\_" or "\'" that frequently appear in
    // markdown-ish content inside JSON strings.
    input.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
  const fixControlCharsInStrings = (input) => {
    // JSON does not allow raw control characters inside strings (notably newlines).
    // Some models emit JSON-like text with raw newlines within quoted strings.
    let out = "";
    let inString = false;
    let escaped = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (!inString) {
        if (ch === '"') inString = true;
        out += ch;
        continue;
      }

      if (escaped) {
        escaped = false;
        out += ch;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        out += ch;
        continue;
      }
      if (ch === '"') {
        inString = false;
        out += ch;
        continue;
      }

      const code = ch.charCodeAt(0);
      if (code === 0x0a) {
        out += "\\n";
        continue;
      }
      if (code === 0x0d) {
        out += "\\r";
        continue;
      }
      if (code === 0x09) {
        out += "\\t";
        continue;
      }
      if (code < 0x20) {
        out += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
      out += ch;
    }
    return out;
  };
  const fixLenientJson = (input) =>
    fixControlCharsInStrings(fixBadJsonEscapes(input));
  try {
    return JSON.parse(raw);
  } catch (error) {
    try {
      return JSON.parse(fixLenientJson(raw));
    } catch {}
    // Look for fenced code block
    const fence = raw.match(/```(?:json)?\n([\s\S]*?)```/i);
    if (fence) {
      const inner = fence[1].trim();
      try {
        return JSON.parse(inner);
      } catch {
        return JSON.parse(fixLenientJson(inner));
      }
    }
    // Fallback to first JSON object
    const firstBrace = raw.indexOf("{");
    if (firstBrace !== -1) {
      let depth = 0;
      for (let i = firstBrace; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            const candidate = raw.slice(firstBrace, i + 1);
            try {
              return JSON.parse(candidate);
            } catch {
              return JSON.parse(fixLenientJson(candidate));
            }
          }
        }
      }
    }
    throw error;
  }
}

/**
 * Legacy Azure agents use OpenAI-style IDs that start with "asst".
 */
function isLegacyAgentId(agentIdentifier) {
  return (
    typeof agentIdentifier === "string" && agentIdentifier.startsWith("asst")
  );
}

/**
 * Build a Responses API agent_reference payload from "name" or "name:version".
 * @param {string} agentName
 * @returns {{name: string, type: string, version?: string}}
 */
function buildAgentReference(agentName) {
  if (typeof agentName !== "string" || !agentName.trim()) {
    throw new Error("AZURE_AGENT_NAME must be a non-empty string");
  }
  const trimmedName = agentName.trim();
  const [name, version] = trimmedName.split(":", 2);
  if (!name) {
    throw new Error("AZURE_AGENT_NAME must include a name");
  }
  const agent = { name, type: "agent_reference" };
  if (version) {
    agent.version = version;
  }
  return agent;
}

async function listAgentsViaRest(credential) {
  if (typeof fetch !== "function") {
    return [];
  }

  const token = await credential.getToken("https://ai.azure.com/.default");
  if (!token?.token) {
    throw new Error("Failed to obtain Azure token for ai.azure.com scope");
  }

  const baseUrl = AZURE_AGENT_ENDPOINT.replace(/\/+$/, "");
  const url = `${baseUrl}/agents?api-version=${AZURE_AGENT_RESPONSES_API_VERSION}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token.token}` },
  });

  if (!response.ok) {
    throw new Error(
      `Foundry agents REST list failed: ${response.status} ${response.statusText}`,
    );
  }

  const payload = await response.json();
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data.map((agent) => ({
    id: agent.id,
    name: (agent.name || agent.id || "").trim(),
    version: agent.versions?.latest?.version,
  }));
}

async function listAgentVersionsViaRest(credential, agentId) {
  if (typeof fetch !== "function") {
    return [];
  }

  const token = await credential.getToken("https://ai.azure.com/.default");
  if (!token?.token) {
    throw new Error("Failed to obtain Azure token for ai.azure.com scope");
  }

  const baseUrl = AZURE_AGENT_ENDPOINT.replace(/\/+$/, "");
  const encoded = encodeURIComponent(agentId);
  const url = `${baseUrl}/agents/${encoded}/versions?api-version=${AZURE_AGENT_RESPONSES_API_VERSION}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token.token}` },
  });

  if (!response.ok) {
    throw new Error(
      `Foundry agent versions REST list failed: ${response.status} ${response.statusText}`,
    );
  }

  const payload = await response.json();
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data.map((version) => ({
    id: version.id,
    name: (version.name || "").trim(),
    version: version.version,
  }));
}

const agentReferenceCache = new Map();

async function resolveAgentReference(agentName, credential) {
  if (agentReferenceCache.has(agentName)) {
    return agentReferenceCache.get(agentName);
  }

  if (typeof agentName !== "string" || !agentName.trim()) {
    throw new Error("AZURE_AGENT_NAME must be a non-empty string");
  }

  const trimmed = agentName.trim();
  const [namePart, versionPart] = trimmed.split(":", 2);
  const directRef = buildAgentReference(trimmed);

  const { AIProjectClient } = require("@azure/ai-projects");
  const client = new AIProjectClient(AZURE_AGENT_ENDPOINT, credential);

  // Prefer Foundry agent metadata via REST. Some SDK list endpoints return only
  // legacy assistants (asst_*) even when Foundry agents exist.
  if (namePart) {
    try {
      const token = await credential.getToken("https://ai.azure.com/.default");
      const url = `${AZURE_AGENT_ENDPOINT.replace(/\/+$/, "")}/agents?api-version=${encodeURIComponent(
        AZURE_AGENT_RESPONSES_API_VERSION,
      )}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token.token}` },
      });
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : [];
        const match = data.find(
          (a) =>
            (a?.id && `${a.id}` === namePart) ||
            (a?.name && `${a.name}`.toLowerCase() === namePart.toLowerCase()),
        );
        const latest = match?.versions?.latest;
        if (match && latest) {
          const ref = {
            name: latest?.name || match?.name || namePart,
            type: "agent_reference",
          };
          const v = versionPart || latest?.version;
          if (v) ref.version = `${v}`;
          agentReferenceCache.set(agentName, ref);
          return ref;
        }
      }
    } catch {
      // ignore and continue to list-based resolution
    }
  }
  const listFn =
    typeof client.agents.list === "function"
      ? client.agents.list.bind(client.agents)
      : typeof client.agents.listAgents === "function"
        ? client.agents.listAgents.bind(client.agents)
        : null;
  const candidates = [];
  const nameMatches = [];
  let idMatch = null;
  try {
    if (listFn) {
      for await (const agent of listFn()) {
        const agentName = (agent.name || "").trim();
        const agentVersion = agent.version;
        candidates.push({ id: agent.id, name: agentName, version: agentVersion });

        if (agent.id === trimmed || agent.id === namePart) {
          idMatch = agent;
        }

        if (
          agentName &&
          (agentName === namePart ||
            agentName.toLowerCase() === namePart.toLowerCase())
        ) {
          nameMatches.push(agent);
        }
      }
    }
  } catch (error) {
    console.warn(
      `[agent] Could not list agents (${error?.message || error}).`,
    );
  }

  let chosen = null;
  if (versionPart) {
    chosen = nameMatches.find(
      (agent) => `${agent.version || ""}` === `${versionPart}`,
    );
    if (!chosen && nameMatches.length) {
      const versions = nameMatches
        .map((agent) => agent.version)
        .filter(Boolean)
        .map((v) => `${v}`);
      const err = new Error(
        `Agent "${namePart}" found, but version "${versionPart}" does not match available versions: ${
          versions.length ? versions.join(", ") : "(unknown)"
        }`,
      );
      err.code = "AGENT_VERSION_NOT_FOUND";
      throw err;
    }
  }

  if (!chosen && idMatch) {
    chosen = idMatch;
  }

  if (!chosen && nameMatches.length) {
    chosen = nameMatches[0];
    if (nameMatches.length > 1) {
      console.warn(
        `[agent] Multiple agent versions found for "${namePart}". Using version "${chosen.version || "unknown"}". Set AZURE_AGENT_NAME=${namePart}:<version> to pin.`,
      );
    }
  }

  let restCandidates = null;
  if (!chosen) {
    try {
      restCandidates = await listAgentsViaRest(credential);
      const restIdMatch = restCandidates.find(
        (agent) => agent.id === trimmed || agent.id === namePart,
      );
      const restNameMatches = restCandidates.filter(
        (agent) =>
          agent.name &&
          (agent.name === namePart ||
            agent.name.toLowerCase() === namePart.toLowerCase()),
      );

      if (versionPart) {
        const restTarget = restNameMatches[0] || restIdMatch;
        if (restTarget) {
          const versions = await listAgentVersionsViaRest(
            credential,
            restTarget.id || restTarget.name,
          );
          const versionMatch = versions.find(
            (agent) => `${agent.version || ""}` === `${versionPart}`,
          );
          if (versionMatch) {
            chosen = {
              id: restTarget.id,
              name: restTarget.name,
              version: versionMatch.version,
            };
          }
        }
      }

      if (!chosen && restIdMatch) {
        chosen = restIdMatch;
      }

      if (!chosen && restNameMatches.length) {
        chosen = restNameMatches[0];
      }
    } catch (error) {
      console.warn(
        `[agent] REST agent listing failed (${error?.message || error}).`,
      );
    }
  }

  if (!chosen) {
    const availableCandidates =
      restCandidates && restCandidates.length
        ? restCandidates
        : candidates;
    const available =
      availableCandidates
        .map(
          (c) =>
            `${c.name || "(unnamed)"}${c.version ? `:${c.version}` : ""} (${c.id})`,
        )
        .join(", ") || "(none)";
    const err = new Error(
      `Agent "${trimmed}" not found in project. Available agents: ${available}`,
    );
    err.code = "AGENT_NOT_FOUND";
    throw err;
  }

  const ref = { name: chosen.name, type: "agent_reference" };
  if (versionPart) {
    ref.version = versionPart;
  } else if (chosen.version) {
    ref.version = chosen.version;
  }

  agentReferenceCache.set(agentName, ref);
  return ref;
}

function extractResponseText(response) {
  if (!response || typeof response !== "object") return "";
  if (response.output_text) return response.output_text;
  let outputText = "";
  if (response.output) {
    if (typeof response.output === "string") {
      outputText = response.output;
    } else if (Array.isArray(response.output)) {
      for (const item of response.output) {
        if (item.type === "text" && item.text) {
          outputText =
            typeof item.text === "string" ? item.text : item.text.value || "";
        } else if (item.type === "message" && item.content) {
          for (const c of item.content) {
            if (c.type === "text" && c.text) {
              outputText =
                typeof c.text === "string" ? c.text : c.text.value || "";
            } else if (c.type === "output_text" && c.text) {
              outputText = c.text;
            }
          }
        }
      }
    } else if (response.output.content) {
      for (const c of response.output.content) {
        if (c.type === "text" && c.text) {
          outputText = typeof c.text === "string" ? c.text : c.text.value || "";
        } else if (c.type === "output_text" && c.text) {
          outputText = c.text;
        }
      }
    }
  }
  if (!outputText && response.choices?.[0]?.message?.content) {
    outputText = response.choices[0].message.content;
  }
  return outputText;
}

function sleep(ms) {
  if (!ms || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHeaderValue(headers, name) {
  if (!headers) return null;
  const lower = name.toLowerCase();
  if (typeof headers.get === "function") {
    return headers.get(name) || headers.get(lower) || null;
  }
  if (typeof headers === "object") {
    return headers[name] || headers[lower] || null;
  }
  return null;
}

function getRetryAfterMsFromError(error) {
  const headersCandidates = [
    error?.headers,
    error?.response?.headers,
    error?.res?.headers,
  ];
  for (const headers of headersCandidates) {
    const msRaw = getHeaderValue(headers, "x-ms-retry-after-ms");
    const ms = msRaw ? parseInt(`${msRaw}`, 10) : NaN;
    if (Number.isFinite(ms)) return Math.max(0, ms);

    const secRaw = getHeaderValue(headers, "retry-after");
    const sec = secRaw ? parseInt(`${secRaw}`, 10) : NaN;
    if (Number.isFinite(sec)) return Math.max(0, sec) * 1000;
  }
  return null;
}

function ensureHttpsUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return `https://${raw}`;
}

function buildAzureOpenAIChatUrlFor({ endpoint, deployment, apiVersion }) {
  if (!endpoint) throw new Error("Missing Azure OpenAI endpoint");
  let url = ensureHttpsUrl(String(endpoint).trim());
  if (!url) throw new Error("Missing Azure OpenAI endpoint");
  if (!deployment) throw new Error("Missing Azure OpenAI deployment");
  if (!apiVersion) throw new Error("Missing Azure OpenAI apiVersion");

  const u = new URL(url);

  // Normalize to the chat completions route (some teams store a full URL in the secret,
  // others store just the origin).
  const hasDeploymentPath = /\/openai\/deployments\//.test(u.pathname);
  const hasChatCompletions = /\/chat\/completions$/.test(u.pathname);

  if (hasDeploymentPath) {
    // Replace deployment in-path for drafting vs translations.
    u.pathname = u.pathname.replace(
      /(\/openai\/deployments\/)([^\/]+)/,
      `$1${deployment}`,
    );
    if (!hasChatCompletions) {
      u.pathname = `${u.pathname.replace(/\/+$/, "")}/chat/completions`;
    }
  } else {
    u.pathname = `/openai/deployments/${deployment}/chat/completions`;
  }

  if (!u.searchParams.has("api-version")) {
    u.searchParams.set("api-version", apiVersion);
  }

  return u.toString();
}

function buildDraftRepairPromptFromExistingArticle(
  article,
  { mode, minWords, maxWords },
) {
  const targetMin = Math.max(parseInt(minWords || "1500", 10) || 1500, 1500);
  const targetMax = Math.max(
    parseInt(maxWords || "3000", 10) || 3000,
    targetMin,
  );
  const currentWords = countWords(article?.content || "");
  const action =
    mode === "expand"
      ? `Allonge le contenu pour dépasser ${targetMin} mots (objectif ~2200).`
      : `Raccourcis le contenu pour être sous ${targetMax} mots (objectif ~2200).`;

  return [
    "Tu es un rédacteur SEO senior pour Ark Fiduciaire (Genève).",
    action,
    "IMPORTANT:",
    "- Ne change PAS le slug, le titre, la description, l'auteur, la date.",
    "- Ne change PAS les références; garde exactement la même liste.",
    "- N'inclus AUCUNE URL dans le texte (pas de http/https).",
    "- Conserve la structure (H2/H3) et les éléments obligatoires (2 tableaux, 2 checklists, 1 cas pratique chiffré CHF, étape-par-étape, erreurs fréquentes + corrections, FAQ 6 questions).",
    `- Longueur STRICTE: ${targetMin} à ${targetMax} mots. Le texte actuel fait ~${currentWords} mots.`,
    "",
    "STYLE (conserver le ton humain):",
    "- Garde un ton direct et conversationnel, pas académique.",
    "- NE RAJOUTE PAS de formules IA: « il est important de noter », « en effet », « de plus », « par ailleurs », « dans ce contexte », « en conclusion ».",
    "- Si tu allonges, ajoute des exemples concrets chiffrés, des observations de terrain ou des cas pratiques — pas du remplissage générique.",
    "",
    "Voici l'article actuel (JSON):",
    JSON.stringify(
      {
        newArticle: {
          slug: article?.slug,
          title: article?.title,
          description: article?.description,
          content: article?.content,
          author: article?.author,
          date: article?.date,
          references: Array.isArray(article?.references)
            ? article.references
            : [],
        },
      },
      null,
      2,
    ),
    "",
    "Retourne STRICTEMENT un JSON de la forme:",
    "{",
    '  "newArticle": {',
    '    "slug": "...",',
    '    "title": "...",',
    '    "description": "...",',
    '    "content": "...",',
    '    "author": "Ark Fiduciaire",',
    '    "date": "YYYY-MM-DD",',
    '    "references": [ { "labelKey": "...", "url": "https://..." }, ... ]',
    "  }",
    "}",
  ].join("\n");
}

function buildDraftAppendPromptFromExistingArticle(
  article,
  { minWords, appendAttempt = 1 },
) {
  const recoveryPlan = buildLengthRecoveryPlan({
    currentWords: countWords(article?.content || ""),
    minWords,
    attempt: appendAttempt,
  });
  return [
    "Tu es un rédacteur SEO senior.",
    "Objectif: compléter l'article EXISTANT en ajoutant du contenu UTILE (pas de blabla) pour dépasser le minimum de mots.",
    "",
    `Contrainte: ajoute au moins ${recoveryPlan.addAtLeastWords} mots (l'article actuel est ~${recoveryPlan.currentWords} mots, minimum requis: ${recoveryPlan.targetMinWords}).`,
    `Tu es encore sous le minimum après ${appendAttempt} tentative(s) de correction. Cette fois, ajoute franchement de la matière utile, sans répéter l'existant.`,
    "IMPORTANT:",
    "- Ne modifie pas le texte existant: tu ajoutes uniquement de nouvelles sections à la fin.",
    "- Ajoute 3 à 5 nouvelles sections H2, avec des sous-sections H3 si utile.",
    "- Ajoute 2 checklists et au moins 1 tableau dans les nouvelles sections.",
    "- Ajoute 4 à 6 questions de FAQ supplémentaires (si une FAQ existe déjà, continue-la).",
    "- N'inclus AUCUNE URL dans le texte (pas de http/https).",
    "- Quand tu cites une source, écris seulement (source: <labelKey>) et utilise uniquement des labelKey déjà présents dans les références de l'article.",
    "",
    "STYLE (ton humain — pas de remplissage IA):",
    "- Écris comme un expert qui parle à un client. Ton direct, exemples concrets, chiffres réalistes.",
    "- INTERDIT: « il est important de noter », « en effet », « de plus », « par ailleurs », « dans ce contexte », « il convient de », « en conclusion ».",
    "- Ajoute de la substance: cas pratiques chiffrés, comparaisons cantonales, pièges réels — pas de phrases creuses ou de généralités.",
    "- Varie le rythme: mélange phrases courtes et développements plus longs.",
    "",
    "Article existant (à compléter):",
    JSON.stringify(
      {
        title: article?.title,
        description: article?.description,
        content: article?.content,
        references: Array.isArray(article?.references) ? article.references : [],
      },
      null,
      2,
    ),
    "",
    "Retourne STRICTEMENT un JSON de la forme:",
    "{",
    '  "appendContent": "<Markdown à ajouter à la fin>",',
    '  "newLabels": { "Libellé FR": "Texte à afficher (FR)" }',
    "}",
  ].join("\n");
}

async function azureOpenAIJson(prompt, options = {}) {
  const {
    endpoint = AZURE_OPENAI_ENDPOINT,
    deployment = AZURE_OPENAI_DEPLOYMENT,
    apiVersion = AZURE_OPENAI_API_VERSION,
    apiKey = AZURE_OPENAI_API_KEY,
    temperature = 0.2,
    topP = 0.9,
    maxTokens = null,
    debugLabel = null,
    onMetrics = null,
    system = "You are a professional assistant. Output ONLY a JSON object.",
  } = options;

  if (!apiKey) {
    throw new Error("Missing AZURE_OPENAI_API_KEY");
  }
  const url = buildAzureOpenAIChatUrlFor({
    endpoint,
    deployment,
    apiVersion,
  });
  const body = buildAzureOpenAIChatBody({
    deployment,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
    temperature,
    topP,
    maxTokens,
    responseFormat: { type: "json_object" },
  });

  const maxRetries = parseInt(process.env.AZURE_OPENAI_RETRIES || "6", 10);
  let attempt = 0;
  while (true) {
    attempt += 1;
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      const cause = error?.cause;
      const details = [];
      if (cause?.code) details.push(`code=${cause.code}`);
      if (cause?.errno) details.push(`errno=${cause.errno}`);
      if (cause?.syscall) details.push(`syscall=${cause.syscall}`);
      if (cause?.address) details.push(`address=${cause.address}`);
      if (cause?.port) details.push(`port=${cause.port}`);
      const detailSuffix = details.length ? ` (${details.join(", ")})` : "";
      throw new Error(
        `Azure OpenAI fetch failed: ${error?.message || "unknown error"}${detailSuffix}`,
      );
    }
    const text = await res.text().catch(() => "");
    if (res.ok) {
      const parsed = JSON.parse(text);
      const metrics = extractOpenAIMetrics(parsed, {
        requestedMaxTokens: maxTokens,
      });
      if (debugLabel) {
        console.log(formatOpenAIMetricsLog(debugLabel, metrics));
      }
      if (typeof onMetrics === "function") {
        onMetrics(metrics);
      }
      const content = parsed?.choices?.[0]?.message?.content;
      if (!content) throw new Error("Azure OpenAI returned no content.");
      return extractJsonFromText(content);
    }
    const retryable = [408, 429, 500, 502, 503, 504];
    if (retryable.includes(res.status) && attempt <= maxRetries) {
      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader
        ? parseInt(retryAfterHeader, 10)
        : NaN;
      const retryAfterMsHeader = res.headers.get("x-ms-retry-after-ms");
      const retryAfterMs = retryAfterMsHeader
        ? parseInt(retryAfterMsHeader, 10)
        : NaN;

      const serverDelayMs = Number.isFinite(retryAfterMs)
        ? Math.max(0, retryAfterMs)
        : Number.isFinite(retryAfterSeconds)
          ? Math.max(0, retryAfterSeconds) * 1000
          : null;
      const expBackoffMs = Math.min(30000, 2000 * Math.pow(2, attempt - 1));
      const jitterMs = Math.floor(Math.random() * 400);
      const delay = Math.max(serverDelayMs || 0, expBackoffMs + jitterMs);
      console.warn(
        `[WARN] Azure OpenAI HTTP ${res.status} (attempt ${attempt}/${maxRetries}) retrying in ${delay}ms`,
      );
      await sleep(delay);
      continue;
    }
    throw new Error(`Azure OpenAI HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
}

async function azureOpenAITranslateJson(prompt) {
  return await azureOpenAIJson(prompt, {
    system: "You are a professional translator. Output ONLY a JSON object.",
    temperature: 0.2,
    topP: 0.9,
  });
}

/**
 * Resolve an agent name or ID to the internal assistant ID (asst_* format).
 * If the identifier already looks like an assistant ID, returns it directly.
 * Otherwise, lists all agents and finds the one matching by name.
 * @param {import("@azure/ai-projects").AgentsOperations | any} agentsClient
 * @param {string} agentNameOrId - Agent name or assistant ID
 * @returns {Promise<string>} The resolved assistant ID (asst_* format)
 */
async function resolveAgentId(agentsClient, agentNameOrId) {
  const debugAgent = !!process.env.DEBUG_AGENT;
  if (typeof agentNameOrId !== "string" || !agentNameOrId.trim()) {
    throw new Error("AZURE_AGENT_NAME must be a non-empty string");
  }
  const trimmed = agentNameOrId.trim();
  const [nameCandidate] = trimmed.split(":", 1);
  // If it already looks like an assistant ID, use it directly
  if (trimmed.startsWith("asst_") || trimmed.startsWith("asst-")) {
    if (debugAgent)
      console.log(`[agent] Using direct assistant ID: ${trimmed}`);
    return trimmed;
  }

  // List agents and find by name
  if (debugAgent)
    console.log(`[agent] Resolving agent name "${trimmed}" to assistant ID...`);
  const listFn =
    typeof agentsClient.list === "function"
      ? agentsClient.list.bind(agentsClient)
      : typeof agentsClient.listAgents === "function"
        ? agentsClient.listAgents.bind(agentsClient)
        : null;
  if (!listFn) {
    throw new Error("Azure agents client does not support list/listAgents");
  }
  const agentsIter = listFn();
  const candidates = [];
  for await (const agent of agentsIter) {
    if (debugAgent)
      console.log(`[agent]   found: id=${agent.id} name=${agent.name}`);
    const agentName = (agent.name || "").trim();
    if (
      agentName === trimmed ||
      agentName.toLowerCase() === trimmed.toLowerCase() ||
      agentName === nameCandidate ||
      agentName.toLowerCase() === nameCandidate.toLowerCase()
    ) {
      if (!isLegacyAgentId(agent.id)) {
        const err = new Error(
          `Agent "${trimmed}" resolved to non-legacy id "${agent.id}".`,
        );
        err.code = "AGENT_NOT_CLASSIC";
        throw err;
      }
      if (debugAgent) {
        console.log(`[agent] Resolved "${trimmed}" -> ${agent.id}`);
      }
      return agent.id;
    }
    candidates.push({ id: agent.id, name: agent.name });
  }

  const available =
    candidates.map((c) => `"${c.name}" (${c.id})`).join(", ") || "(none)";
  const err = new Error(
    `Agent with name "${trimmed}" not found. Available agents: ${available}`,
  );
  err.code = "AGENT_NOT_FOUND";
  throw err;
}

/**
 * Call an Azure AI Foundry Agent using the standard thread/run API.
 * Supports both agent names and legacy assistant IDs (asst_*).
 * @param {string} prompt - The user prompt
 * @param {Object} options - Options including agentId (agent name or ID)
 * @returns {Promise<Object>} Parsed JSON response
 */
async function azureAgentJson(prompt, { agentId = AZURE_AGENT_NAME } = {}) {
  if (!AZURE_AGENT_ENDPOINT) throw new Error("Missing AZURE_AGENT_ENDPOINT");
  if (!agentId) throw new Error("Missing AZURE_AGENT_NAME");

  const { AIProjectClient } = require("@azure/ai-projects");
  const { DefaultAzureCredential } = require("@azure/identity");
  const credential = new DefaultAzureCredential();
  const client = new AIProjectClient(AZURE_AGENT_ENDPOINT, credential);
  const debugAgent = !!process.env.DEBUG_AGENT;
  const timeoutMs = parseInt(
    process.env.AZURE_AGENT_RUN_TIMEOUT_MS || "180000",
    10,
  );

  // Resolve agent name to assistant ID if needed
  const assistantId = await resolveAgentId(client.agents, agentId);
  if (debugAgent) {
    console.log(
      `[agent] Using assistantId=${assistantId} (from input: ${agentId})`,
    );
  }

  // Create thread and send user message
  const thread = await client.agents.threads.create();
  await client.agents.messages.create(thread.id, "user", prompt);

  if (debugAgent) {
    console.log(`[agent] Created thread ${thread.id}, starting run...`);
  }

  // Create run and poll until complete, enforcing an overall timeout.
  // The poller's requestOptions.timeout only covers individual HTTP calls,
  // so we use AbortController to enforce the total wall-clock timeout.
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  let run;
  try {
    const poller = client.agents.runs.createAndPoll(thread.id, assistantId, {
      pollingOptions: { intervalInMs: 2000 },
    });
    run = await poller.pollUntilDone({ abortSignal: ac.signal });
  } catch (err) {
    clearTimeout(timer);
    if (ac.signal.aborted) {
      throw new Error(`Azure Agent run timeout after ${timeoutMs} ms`);
    }
    throw err;
  }
  clearTimeout(timer);

  if (debugAgent) {
    console.log(`[agent] Run completed with status: ${run.status}`);
  }

  // Retrieve assistant messages
  const messages = await client.agents.messages.list(thread.id, {
    order: "asc",
  });
  let lastAssistantText = "";
  for await (const message of messages) {
    if (message.role !== "assistant" || !Array.isArray(message.content)) {
      continue;
    }
    for (const c of message.content) {
      if (c.type === "text" && c.text && typeof c.text.value === "string") {
        lastAssistantText = c.text.value;
      }
    }
  }
  if (!lastAssistantText) {
    throw new Error("Azure Agent returned no assistant text content");
  }
  return extractJsonFromText(lastAssistantText);
}

/**
 * Call Azure AI Foundry Agent using the OpenAI Responses API with agent reference.
 * Uses direct fetch() because the OpenAI SDK's options.body replaces (not merges)
 * the params body, which would drop the "input" field when injecting "agent".
 * @param {string} prompt - The user prompt
 * @param {Object} options - Options including agentName
 * @returns {Promise<Object>} Parsed JSON response
 */
async function azureAgentResponsesApi(
  prompt,
  { agentName = AZURE_AGENT_NAME } = {},
) {
  if (!AZURE_AGENT_ENDPOINT) throw new Error("Missing AZURE_AGENT_ENDPOINT");
  if (!agentName) throw new Error("Missing AZURE_AGENT_NAME");

  const { DefaultAzureCredential } = require("@azure/identity");
  const { AzureOpenAI } = require("openai");
  const apiKey = (AZURE_AGENT_API_KEY || "").trim();
  const useApiKey = !!apiKey;
  const credential = useApiKey ? null : new DefaultAzureCredential();
  const debugAgent = !!process.env.DEBUG_AGENT;

  const azureADTokenProvider = useApiKey
    ? null
    : async () => {
        const token = await credential.getToken("https://ai.azure.com/.default");
        if (!token?.token) {
          throw new Error("Failed to obtain Azure token for ai.azure.com scope");
        }
        return token.token;
      };

  const baseURL = `${AZURE_AGENT_ENDPOINT.replace(/\/+$/, "")}/openai`;
  const openAIClient = new AzureOpenAI({
    apiVersion: AZURE_AGENT_RESPONSES_API_VERSION,
    baseURL,
    ...(useApiKey
      ? { apiKey }
      : { azureADTokenProvider, apiKey: null }),
  });
  const agentRef = useApiKey
    ? buildAgentReference(agentName)
    : await resolveAgentReference(agentName, credential);

  if (debugAgent) {
    console.log(
      `[agent] Responses API (SDK) using agent=${agentRef.name}${
        agentRef.version ? `:${agentRef.version}` : ""
      }`,
    );
  }

  let response;
  let useMaxOutputTokens = AZURE_AGENT_RESPONSES_MAX_OUTPUT_TOKENS > 0;
  for (let attempt = 0; attempt <= AZURE_AGENT_RESPONSES_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      AZURE_AGENT_RESPONSES_TIMEOUT_MS,
    );
    try {
      const conversation = await openAIClient.conversations.create(
        {
          items: [{ type: "message", role: "user", content: prompt }],
        },
        { signal: controller.signal },
      );

      response = await openAIClient.responses.create(
        {
          conversation: conversation.id,
          agent: agentRef,
          ...(useMaxOutputTokens
            ? { max_output_tokens: AZURE_AGENT_RESPONSES_MAX_OUTPUT_TOKENS }
            : {}),
        },
        { signal: controller.signal },
      );

      if (
        response.status === "incomplete" &&
        response.incomplete_details?.reason === "max_output_tokens"
      ) {
        if (useMaxOutputTokens && attempt < AZURE_AGENT_RESPONSES_RETRIES) {
          useMaxOutputTokens = false;
          if (debugAgent) {
            console.log(
              "[agent] Responses API hit max_output_tokens. Retrying once without a cap...",
            );
          }
          await sleep(AZURE_AGENT_RESPONSES_BACKOFF_MS);
          response = null;
          continue;
        }
        throw new Error(
          "Responses API returned incomplete output because max_output_tokens was reached. Increase AZURE_AGENT_RESPONSES_MAX_OUTPUT_TOKENS.",
        );
      }
      break;
    } catch (error) {
      if (controller.signal.aborted) {
        if (attempt < AZURE_AGENT_RESPONSES_RETRIES) {
          if (debugAgent) {
            console.log(
              `[agent] Responses API timeout after ${AZURE_AGENT_RESPONSES_TIMEOUT_MS}ms. Retrying...`,
            );
          }
          continue;
        }
        throw new Error(
          `Responses API timeout after ${AZURE_AGENT_RESPONSES_TIMEOUT_MS}ms`,
        );
      }

      const status = error?.status || error?.statusCode;
      if (status === 404) {
        const err = new Error(
          `Azure Agent not found (404). Check AZURE_AGENT_ENDPOINT and AZURE_AGENT_NAME. Resolved agent reference: ${agentRef.name}${agentRef.version ? `:${agentRef.version}` : ""}`,
        );
        err.code = "AGENT_NOT_FOUND_404";
        throw err;
      }
      if (
        (status === 408 ||
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504) &&
        attempt < AZURE_AGENT_RESPONSES_RETRIES
      ) {
        const baseBackoff = AZURE_AGENT_RESPONSES_BACKOFF_MS * (attempt + 1);
        const jitter =
          AZURE_AGENT_RESPONSES_BACKOFF_JITTER_MS > 0
            ? Math.floor(
                Math.random() * AZURE_AGENT_RESPONSES_BACKOFF_JITTER_MS,
              )
            : 0;
        const proposed = baseBackoff + jitter;
        const backoffMs =
          AZURE_AGENT_RESPONSES_BACKOFF_MAX_MS > 0
            ? Math.min(proposed, AZURE_AGENT_RESPONSES_BACKOFF_MAX_MS)
            : proposed;
        const retryAfterMs = getRetryAfterMsFromError(error);
        const effectiveBackoffMs = Math.max(backoffMs, retryAfterMs || 0);
        if (debugAgent) {
          console.log(
            `[agent] Responses API ${status} received. Retrying in ${effectiveBackoffMs}ms...`,
          );
        }
        await sleep(effectiveBackoffMs);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!response) {
    throw new Error("Responses API request failed without a response");
  }

  const outputText = extractResponseText(response);
  if (!outputText) {
    if (debugAgent) {
      console.log(
        "[agent] Responses API raw response:",
        JSON.stringify(response, null, 2),
      );
    }
    throw new Error("Responses API returned no output text");
  }

  return extractJsonFromText(outputText);
}

async function requestAgentJson(prompt, { agentName = AZURE_AGENT_NAME } = {}) {
  if (!agentName) throw new Error("Missing AZURE_AGENT_NAME");

  // Legacy assistant IDs (asst_*) are not allowed.
  if (isLegacyAgentId(agentName)) {
    throw new Error(
      `Legacy agent IDs are not allowed. Update AZURE_AGENT_NAME to a Foundry agent name like "web-deep-search:5".`,
    );
  }

  const isPermissionError = (error) => {
    const status = error?.status || error?.statusCode;
    if (status === 401 || status === 403) return true;
    const message = `${error?.message || ""}`.toLowerCase();
    return (
      message.includes("rbac") ||
      message.includes("access denied") ||
      message.includes("not have permissions") ||
      message.includes("permissions")
    );
  };

  const tryAgent = async () => {
    const result = await azureAgentResponsesApi(prompt, { agentName });
    if (AZURE_AGENT_RESPONSES_COOLDOWN_MS > 0) {
      await sleep(AZURE_AGENT_RESPONSES_COOLDOWN_MS);
    }
    return result;
  };

  try {
    if (AZURE_AGENT_FORCE_RESPONSES) {
      return await tryAgent();
    }
    // New Foundry agents use the Responses API by default.
    return await tryAgent();
  } catch (error) {
    if (AZURE_AGENT_FALLBACK_TO_OPENAI && isPermissionError(error)) {
      if (
        !AZURE_OPENAI_RESEARCH_ENDPOINT ||
        !AZURE_OPENAI_RESEARCH_DEPLOYMENT ||
        !AZURE_OPENAI_RESEARCH_API_KEY
      ) {
        throw error;
      }
      console.warn(
        `[agent] Permission denied (${error?.status || "unknown"}). Falling back to Azure OpenAI.`,
      );
      return await azureOpenAIJson(prompt, {
        endpoint: AZURE_OPENAI_RESEARCH_ENDPOINT,
        deployment: AZURE_OPENAI_RESEARCH_DEPLOYMENT,
        apiVersion: AZURE_OPENAI_RESEARCH_API_VERSION,
        apiKey: AZURE_OPENAI_RESEARCH_API_KEY,
        maxTokens: Math.min(2048, AZURE_OPENAI_DRAFT_MAX_TOKENS),
        system:
          "You are an expert research assistant. Output ONLY a JSON object.",
      });
    }
    throw error;
  }
}

function ensureAzureEnv() {
  const missing = [];
  if (!AZURE_AGENT_ENDPOINT) missing.push("AZURE_AGENT_ENDPOINT");
  if (!AZURE_AGENT_NAME) missing.push("AZURE_AGENT_NAME");
  if (missing.length) {
    throw new Error(
      `Missing required Azure env vars: ${missing.join(", ")}. See README.`,
    );
  }
}

function ensureOpenAIEnv() {
  const missing = [];
  if (!AZURE_OPENAI_ENDPOINT) missing.push("AZURE_OPENAI_ENDPOINT");
  if (!AZURE_OPENAI_API_KEY) missing.push("AZURE_OPENAI_API_KEY");
  if (missing.length) {
    throw new Error(
      `Missing required Azure OpenAI env vars: ${missing.join(", ")}. See README.`,
    );
  }
}

function validateNewArticle(frData, article) {
  if (!article || typeof article !== "object") {
    const err = new Error("Réponse agent invalide: newArticle manquant");
    err.code = "MISSING_ARTICLE";
    throw err;
  }

  const required = [
    "slug",
    "title",
    "description",
    "content",
    "author",
    "date",
  ];
  for (const key of required) {
    if (
      !article[key] ||
      (Array.isArray(article[key]) && !article[key].length)
    ) {
      const err = new Error(`Champ manquant ou vide: ${key}`);
      err.code = "MISSING_FIELD";
      err.field = key;
      throw err;
    }
  }

  const slugs = new Set(
    (Array.isArray(frData.Articles) ? frData.Articles : [])
      .map((a) => a.slug)
      .filter(Boolean),
  );
  if (slugs.has(article.slug)) {
    const err = new Error(`Slug déjà existant: ${article.slug}`);
    err.code = "DUPLICATE_SLUG";
    err.slug = article.slug;
    throw err;
  }

  const titleConflict = findRecentTitleConflict(
    Array.isArray(frData.Articles) ? frData.Articles : [],
    article,
    { windowSize: TOPIC_ROTATION_WINDOW },
  );
  if (titleConflict) {
    const err = new Error(
      titleConflict.code === "DUPLICATE_TITLE"
        ? `Titre déjà utilisé récemment: ${titleConflict.previousTitle}`
        : `Titre trop proche d'un article récent: ${titleConflict.previousTitle}`,
    );
    err.code = titleConflict.code;
    err.previousTitle = titleConflict.previousTitle;
    err.previousSlug = titleConflict.previousSlug;
    throw err;
  }

  if (!Array.isArray(article.references)) {
    console.warn("[validateNewArticle] references field missing or not an array; defaulting to empty");
    article.references = [];
  }

  ensureArticleTaxonomy(article);
  if (!article.category || !Array.isArray(article.tags) || article.tags.length < 3) {
    const err = new Error("Article taxonomy missing: category and at least 3 tags are required");
    err.code = "MISSING_TAXONOMY";
    throw err;
  }
  for (const ref of article.references) {
    if (
      !ref ||
      typeof ref !== "object" ||
      typeof ref.labelKey !== "string" ||
      typeof ref.url !== "string"
    ) {
      const err = new Error("Référence mal formée");
      err.code = "BAD_REFERENCE";
      throw err;
    }
  }

  const outdatedVatRates = extractOutdatedSwissVatRateMatches(article);
  if (outdatedVatRates.length > 0) {
    const staleRates = Array.from(
      new Set(outdatedVatRates.map(({ rate }) => rate)),
    ).join(", ");
    const currentRates = Array.from(
      new Set(outdatedVatRates.map(({ currentRate }) => currentRate)),
    ).join(", ");
    const err = new Error(
      `Article contient des taux de TVA suisses obsolètes (${staleRates}); vérifier les taux actuels (${currentRates})`,
    );
    err.code = "OUTDATED_VAT_RATE";
    err.rates = staleRates;
    throw err;
  }

  const minWords = parseInt(process.env.SEO_MIN_WORDS || "0", 10);
  const enforcedMinWords = Math.max(700, minWords);
  if (enforcedMinWords > 0) {
    const words = countWords(article.content || "");
    if (words < enforcedMinWords) {
      const err = new Error(
        `Article trop court: ${words} mots (min: ${enforcedMinWords})`,
      );
      err.code = "TOO_SHORT";
      err.words = words;
      err.minWords = enforcedMinWords;
      throw err;
    }
  }
  const maxWords = parseInt(process.env.SEO_MAX_WORDS || "0", 10);
  if (maxWords > 0) {
    const words = countWords(article.content || "");
    if (words > maxWords) {
      const err = new Error(
        `Article trop long: ${words} mots (max: ${maxWords})`,
      );
      err.code = "TOO_LONG";
      err.words = words;
      err.maxWords = maxWords;
      throw err;
    }
  }
}

function enforceTopicRotation(frData, newArticle, topicAnalysis = null) {
  if (SKIP_TOPIC_ROTATION) {
    return;
  }
  const articles = Array.isArray(frData?.Articles) ? frData.Articles : [];
  if (!articles.length) return;

  if (topicAnalysis) {
    const preCheck = validateArticleTopicAgainstAvailable(
      newArticle,
      topicAnalysis,
    );
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

function normalizeArticleDates(article) {
  const today = isoDateToday();
  // Always set publication date to "today" for newly generated content.
  article.date = today;
}

function buildRetryPrompt(basePrompt, error, frData) {
  const recentSlugs = (Array.isArray(frData.Articles) ? frData.Articles : [])
    .slice(-12)
    .map((a) => a.slug)
    .filter(Boolean);
  let hint = `⚠️ Correction requise (${error.message}). Génère un nouvel article en respectant les contraintes précédentes.`;

  if (error.code === "DUPLICATE_SLUG") {
    hint =
      `⚠️ Le slug "${error.slug}" existe déjà. Choisis un nouveau sujet et un slug unique.\n` +
      `Slugs récents à éviter: ${recentSlugs.join(", ") || "aucun"}.`;
  } else if (error.code === "DUPLICATE_TITLE") {
    hint =
      `⚠️ Le titre proposé duplique un article récent (${error.previousTitle}).\n` +
      "Choisis un sujet différent avec un titre nettement distinct.";
  } else if (error.code === "DUPLICATE_TITLE_FINGERPRINT") {
    hint =
      `⚠️ Le titre proposé reste trop proche d'un article récent (${error.previousTitle}).\n` +
      "Évite les variantes légères, reformulations et permutations des mêmes mots-clés.";
  } else if (error.code === "TOPIC_DUPLICATE") {
    hint =
      `⚠️ Le dernier article (${
        error.previousTitle
      }) couvrait déjà ${describeTopic(error.topic)}.\n` +
      `Choisis un autre axe stratégique (audit/révision, contrôle interne, reporting, Odoo, financement, M&A, fiscalité, corporate, etc.) différent des ${TOPIC_ROTATION_WINDOW} derniers thèmes.`;
  } else if (error.code === "TOPIC_SIMILAR") {
    hint =
      `⚠️ Le sujet proposé reste trop proche d'un article récent (${error.previousTitle}).\n` +
      `Choisis un angle clairement distinct des ${TOPIC_ROTATION_WINDOW} derniers sujets (pas de variante légère ni reformulation du même thème).`;
  } else if (error.code === "TOO_SHORT") {
    hint = [
      `⚠️ L'article est trop court (${error.words || "?"} mots).`,
      `Vise une longueur nette de ${error.minWords || "800"}+ mots (objectif +25%).`,
      "OBLIGATOIRE: ajoute 10+ sections H2, plusieurs H3, 2 checklists, 2 tableaux, 1 cas pratique chiffré (CHF), 1 section étape-par-étape et une FAQ de 6 questions.",
    ].join(" ");
  } else if (error.code === "TOO_LONG") {
    hint = [
      `⚠️ L'article est trop long (${error.words || "?"} mots).`,
      `Réduis à ${error.maxWords || "3000"} mots max sans perdre en utilité.`,
      "Supprime le blabla, garde les tableaux/checklists/cas pratique, et condense les sections redondantes.",
    ].join(" ");
  } else if (error.code === "MISSING_FIELD" && error.field) {
    hint = `⚠️ Le champ ${error.field} est manquant. Fournis un article complet avec ce champ rempli.`;
  }

  return `${basePrompt}\n\n${hint}`;
}

async function httpOk(
  url,
  timeoutMs = parseInt(process.env.LINK_CHECK_TIMEOUT_MS || "10000", 10),
) {
  if (OFFLINE_MODE) return true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.status === 405 || res.status === 403) {
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), timeoutMs);
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller2.signal,
      });
      clearTimeout(timeout2);
    }
    return res.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Validate and repair article references using the referenceValidator module.
 * Replaces invalid references with verified fallbacks if needed.
 * @param {Object} article - Article with references array
 * @param {string} category - Topic category for fallback selection
 */
async function repairReferences(article, category = "general") {
  if (OFFLINE_MODE) {
    console.log("[refs] Offline mode: skipping reference validation");
    return;
  }

  const validateOpts = {
    timeout: parseInt(process.env.LINK_CHECK_TIMEOUT_MS || "10000", 10),
    minBytes: parseInt(process.env.LINK_CHECK_MIN_BYTES || "600", 10),
  };

  const minCount = Math.max(2, REFERENCE_MIN_COUNT || 3);
  const maxCount = Math.max(minCount, REFERENCE_MAX_COUNT || 6);
  const minTrusted = Math.max(0, REFERENCE_MIN_TRUSTED_DOMAINS || 0);
  const trustedCount = (refs) =>
    (Array.isArray(refs) ? refs : []).filter((r) =>
      r?.url ? isTrustedDomain(r.url) : false,
    ).length;

  console.log(
    `[refs] Validating ${article.references?.length || 0} references...`,
  );

  // First, deduplicate by domain
  const dedupedRefs = deduplicateByDomain(article.references || []);
  if (dedupedRefs.length < (article.references || []).length) {
    console.log(
      `[refs] Removed ${(article.references || []).length - dedupedRefs.length} duplicate domain references`,
    );
    article.references = dedupedRefs;
  }

  // Validate all references
  const validationResult = await validateReferences(
    article.references,
    validateOpts,
  );

  console.log(
    `[refs] Validation results: ${validationResult.stats.valid} valid, ${validationResult.stats.invalid} invalid`,
  );

  // Log rejected references
  for (const ref of validationResult.invalid) {
    const reason = ref._validation?.reason || "unknown";
    const error = ref._validation?.error || "";
    console.warn(`[refs] Rejected: ${ref.url} (${reason}: ${error})`);
  }

  // Keep only valid references (may be empty). This ensures invalid references
  // don't block regeneration/fallback logic.
  article.references = validationResult.valid.map((ref) => {
    const { _validation, ...cleanRef } = ref;
    return cleanRef;
  });

  // Cap references at maxCount, leaving room for trusted fallbacks when needed.
  // Without this, regeneration/fallback loops cannot add trusted references
  // because they check article.references.length < maxCount.
  if (
    article.references.length >= maxCount &&
    trustedCount(article.references) < minTrusted
  ) {
    const trusted = article.references.filter(
      (r) => r?.url && isTrustedDomain(r.url),
    );
    const untrusted = article.references.filter(
      (r) => !r?.url || !isTrustedDomain(r.url),
    );
    // Reserve at least minTrusted slots (or keep existing trusted count) for
    // trusted references; fill the rest with untrusted.
    const reservedForTrusted = Math.max(trusted.length, minTrusted);
    const slotsForUntrusted = Math.max(0, maxCount - reservedForTrusted);
    article.references = [
      ...trusted.slice(0, maxCount),
      ...untrusted.slice(0, slotsForUntrusted),
    ];
  } else if (article.references.length > maxCount) {
    article.references = article.references.slice(0, maxCount);
  }

  // If we don't have enough valid references, try to regenerate
  const maxRetries = parseInt(process.env.AI_REF_RETRIES || "2", 10);
  let attempt = 0;

  while (
    (article.references.length < minCount ||
      trustedCount(article.references) < minTrusted) &&
    attempt < maxRetries
  ) {
    attempt++;
    console.warn(
      `[refs] Need more references (have ${article.references.length}/${minCount}, trusted ${trustedCount(article.references)}/${minTrusted}). Regeneration attempt ${attempt}/${maxRetries}...`,
    );

    const regenPrompt = [
      "Certaines références générées sont inaccessibles ou invalides.",
      'Fournis UNIQUEMENT un JSON de la forme {"references": [ {"labelKey": "...", "url": "https://..."}, ... ]}.',
      "URLs acceptables: sources officielles (admin.ch, ge.ch, vd.ch, fedlex.admin.ch, bsv.admin.ch, estv.admin.ch, seco.admin.ch, finma.ch, etc.), institutions, chambres de commerce, caisses de pension, associations professionnelles, institutions académiques, documentation officielle Odoo.",
      ALLOWED_REFERENCE_DOMAINS_PROMPT,
      "Tu peux t'inspirer de concurrents en recherche privée, mais n'inclus jamais leur URL dans les références publiées.",
      "Interdit: fiduciaires, treuhand, avocats, notaires, comptables, experts-comptables, consultants, intégrateurs Odoo, Big 4 ou autres cabinets concurrents.",
      `Contraintes: au moins ${minCount} références, dont au moins ${minTrusted} source(s) officielle(s).`,
      "Chaque domaine ne doit être représenté qu'une seule fois dans les références (pas de doublons de domaine).",
      `Thème de l'article: ${article.title} (slug: ${article.slug}).`,
      "Fournis au moins 5 références pour maximiser les chances après déduplication/validation.",
    ].join("\n");

    let regen;
    try {
      if (MOCK_DATA?.regenReferences?.[attempt - 1]) {
        regen = MOCK_DATA.regenReferences[attempt - 1];
      } else {
        regen = await requestAgentJson(regenPrompt, {
          agentName: AZURE_AGENT_NAME,
        });
      }
    } catch (error) {
      console.warn(`[refs] Regeneration failed: ${error.message}`);
      break;
    }

    if (regen && Array.isArray(regen.references) && regen.references.length) {
      // Validate the new references
      const newValidation = await validateReferences(
        regen.references,
        validateOpts,
      );
      if (newValidation.valid.length > 0) {
        // Merge with existing valid references
        const existingUrls = new Set(article.references.map((r) => r.url));
        for (const ref of newValidation.valid) {
          if (
            !existingUrls.has(ref.url) &&
            article.references.length < maxCount
          ) {
            const { _validation, ...cleanRef } = ref;
            article.references.push(cleanRef);
          }
        }
      }
    } else {
      console.warn("[refs] Regeneration returned no valid references.");
      break;
    }
  }

  // If still not enough references, use verified fallbacks
  if (
    article.references.length < minCount ||
    trustedCount(article.references) < minTrusted
  ) {
    console.warn(
      `[refs] Using verified fallback references for category: ${category}`,
    );
    const fallbacks = getFallbackReferences(category);
    const existingUrls = new Set(article.references.map((r) => r.url));

    for (const fallback of fallbacks) {
      if (
        !existingUrls.has(fallback.url) &&
        article.references.length < maxCount
      ) {
        article.references.push({ ...fallback });
        existingUrls.add(fallback.url);
      }
    }
  }

  // Final deduplication
  article.references = deduplicateByDomain(article.references);

  // Final validation pass (especially important when fallbacks were used)
  const finalValidation = await validateReferences(
    article.references,
    validateOpts,
  );
  if (finalValidation.invalid.length) {
    for (const ref of finalValidation.invalid) {
      const reason = ref._validation?.reason || "unknown";
      const error = ref._validation?.error || "";
      console.warn(`[refs] Final rejected: ${ref.url} (${reason}: ${error})`);
    }
  }
  article.references = finalValidation.valid.map((ref) => {
    const { _validation, ...cleanRef } = ref;
    return cleanRef;
  });

  // If strict validation removed too many refs, try to top-up with validated fallbacks.
  if (
    article.references.length < minCount ||
    trustedCount(article.references) < minTrusted
  ) {
    const fallbacks = getFallbackReferences(category);
    const existingUrls = new Set(article.references.map((r) => r.url));
    const candidates = fallbacks.filter(
      (r) => r && r.url && !existingUrls.has(r.url),
    );
    const fallbackValidation = await validateReferences(
      candidates,
      validateOpts,
    );
    for (const ref of fallbackValidation.valid) {
      if (article.references.length >= maxCount) break;
      const { _validation, ...cleanRef } = ref;
      article.references.push(cleanRef);
    }
    article.references = deduplicateByDomain(article.references);
  }

  console.log(
    `[refs] Final reference count: ${article.references.length} (trusted: ${trustedCount(article.references)})`,
  );

  const enforceMinimums =
    process.env.REFERENCE_ENFORCE_MINIMUMS === "1" || process.env.CI === "true";
  if (
    enforceMinimums &&
    (article.references.length < minCount ||
      trustedCount(article.references) < minTrusted)
  ) {
    console.warn(
      `[refs] Minimum references not met after repair: have ${article.references.length}/${minCount}, trusted ${trustedCount(article.references)}/${minTrusted}`,
    );
  }
}

function sanitizeContentExternalLinks(article) {
  if (!article || typeof article !== "object") return;
  if (typeof article.content !== "string" || !article.content) return;
  const allowed = new Set(
    (Array.isArray(article.references) ? article.references : [])
      .map((r) => (r && typeof r.url === "string" ? r.url : ""))
      .filter(Boolean),
  );

  // Remove markdown links that aren't in the validated references list.
  // Keep the link text to preserve readability.
  let content = article.content.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    (match, text, url) => (allowed.has(url) ? match : text),
  );

  // Remove bare URLs that aren't validated references.
  content = content.replace(/https?:\/\/[^\s)]+/g, (url) =>
    allowed.has(url) ? url : "",
  );

  // Collapse accidental double spaces introduced by removals.
  content = content.replace(/[ \t]{2,}/g, " ");

  article.content = content;
}

function normalizeMarkdownHeadings(article) {
  if (!article || typeof article !== "object") return;
  if (typeof article.content !== "string" || !article.content) return;
  article.content = article.content.replace(
    /^(#{2,3})\s+H[23]\s+(?=\S)/gm,
    "$1 ",
  );
}

function syncContentReferencesSection(article) {
  if (!article || typeof article !== "object") return;
  if (typeof article.content !== "string" || !article.content) return;
  if (!Array.isArray(article.references) || article.references.length === 0) {
    return;
  }

  const refs = article.references
    .filter(
      (r) => r && typeof r.url === "string" && typeof r.labelKey === "string",
    )
    .map((r) => ({ labelKey: r.labelKey.trim(), url: r.url.trim() }))
    .filter((r) => r.labelKey && r.url);

  if (refs.length === 0) return;

  let content = article.content;

  // Match reference sections in various formats and languages:
  // French: "Références", "Sources"
  // English: "References", "Sources"
  // German: "Referenzen", "Quellen"
  // Spanish: "Referencias", "Fuentes"
  // Portuguese: "Referências", "Fontes"
  // With various formatting: headings (###), bold (**), with/without colons
  const headingRe =
    /^(?:#{2,3}\s*|\*\*)?(?:référence?s?|references?|referenzen?|referencias?|sources?|quellen?|fuentes?|fontes?)\s*:?\s*(?:\*\*)?\s*$/gim;

  // Find all reference section markers
  const indices = [];
  for (const m of content.matchAll(headingRe)) {
    if (typeof m.index === "number") {
      // Only consider it a reference section if it's at the start of a line
      // and followed by a list or another reference marker
      const beforeMatch = content.slice(0, m.index);
      const afterMatch = content.slice(m.index);

      // Check if this looks like a reference section
      // (e.g., followed by a list or at end of document)
      const nextLines = afterMatch.split('\n').slice(1, 5).join('\n');
      if (nextLines.match(/^\s*-\s+/m) || afterMatch.length < 500) {
        indices.push(m.index);
      }
    }
  }

  if (indices.length) {
    // Remove everything from the first reference heading onwards
    content = content.slice(0, indices[0]).trimEnd();
  } else {
    content = content.trimEnd();
  }

  // Remove trailing separators if present
  content = content.replace(/(\n---\s*)+$/, '').trimEnd();

  const list = refs.map((r) => `- [${r.labelKey}](${r.url})`).join("\n");
  article.content = `${content}\n\n---\n### Références\n${list}\n`;
}

function countWords(text) {
  if (typeof text !== "string") return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function logArticleMetrics(article, label = "article") {
  if (!article) return;
  const words = countWords(article.content || "");
  const chars =
    typeof article.content === "string" ? article.content.length : 0;
  const refCount = Array.isArray(article.references)
    ? article.references.length
    : 0;
  console.log(`[seo] ${label} word count: ${words} (chars: ${chars})`);
  console.log(`[refs] ${label} references: ${refCount}`);
  if (refCount) {
    for (const ref of article.references) {
      if (ref?.url) console.log(`[refs]   - ${ref.url}`);
    }
  }
}

async function generateArticleWithRetries(
  frData,
  attempts,
  trendData = null,
  topicAnalysis = null,
) {
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

function validateResearchPayload(frData, payload) {
  const research = payload?.research;
  if (!research || typeof research !== "object") {
    const err = new Error("Réponse agent invalide: research manquant");
    err.code = "MISSING_RESEARCH";
    throw err;
  }
  const required = [
    "slug",
    "title",
    "description",
    "category",
    "primaryKeyword",
    "outline",
    "references",
  ];
  for (const key of required) {
    if (
      !research[key] ||
      (Array.isArray(research[key]) && research[key].length === 0)
    ) {
      const err = new Error(`Champ research manquant ou vide: ${key}`);
      err.code = "MISSING_FIELD";
      err.field = key;
      throw err;
    }
  }
  if (!Array.isArray(research.outline)) {
    const err = new Error("research.outline doit être un tableau");
    err.code = "BAD_RESEARCH";
    throw err;
  }
  if (!Array.isArray(research.references) || research.references.length === 0) {
    const err = new Error("research.references doit être un tableau non vide");
    err.code = "BAD_RESEARCH";
    throw err;
  }
  for (const ref of research.references) {
    if (
      !ref ||
      typeof ref !== "object" ||
      typeof ref.labelKey !== "string" ||
      typeof ref.url !== "string"
    ) {
      const err = new Error("Référence mal formée dans research.references");
      err.code = "BAD_REFERENCE";
      throw err;
    }
  }

  const slugs = new Set(
    (Array.isArray(frData.Articles) ? frData.Articles : [])
      .map((a) => a.slug)
      .filter(Boolean),
  );
  if (slugs.has(research.slug)) {
    const err = new Error(`Slug déjà existant: ${research.slug}`);
    err.code = "DUPLICATE_SLUG";
    err.slug = research.slug;
    throw err;
  }

  const titleConflict = findRecentTitleConflict(
    Array.isArray(frData.Articles) ? frData.Articles : [],
    research,
    { windowSize: TOPIC_ROTATION_WINDOW },
  );
  if (titleConflict) {
    const err = new Error(
      titleConflict.code === "DUPLICATE_TITLE"
        ? `Titre déjà utilisé récemment: ${titleConflict.previousTitle}`
        : `Titre trop proche d'un article récent: ${titleConflict.previousTitle}`,
    );
    err.code = titleConflict.code;
    err.previousTitle = titleConflict.previousTitle;
    err.previousSlug = titleConflict.previousSlug;
    throw err;
  }

  return research;
}

async function generateResearchWithRetries(
  frData,
  attempts,
  trendData,
  seoSuggestions,
  topicAnalysis = null,
) {
  const basePrompt = buildResearchPrompt(
    frData,
    trendData,
    seoSuggestions,
    topicAnalysis,
  );
  let prompt = basePrompt;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(
      `Requesting Azure Agent for topic+references research... (attempt ${attempt}/${attempts})`,
    );
    try {
      const payload = await requestAgentJson(prompt, {
        agentName: AZURE_AGENT_RESEARCH_NAME,
      });
      const research = validateResearchPayload(frData, payload);
      if (topicAnalysis) {
        const preCheck = validateArticleTopicAgainstAvailable(
          research,
          topicAnalysis,
        );
        if (!preCheck.valid) {
          const err = new Error(preCheck.error);
          err.code = "TOPIC_NOT_IN_AVAILABLE_POOL";
          err.topic = preCheck.detectedTopic;
          throw err;
        }
      }
      return { research, trendData };
    } catch (error) {
      lastError = error;
      console.warn(`Research invalid: ${error.message}`);
      prompt = `${basePrompt}\n\n⚠️ Correction requise: ${error.message}. Retourne STRICTEMENT le JSON demandé.`;
    }
  }

  throw (
    lastError ||
    new Error("Échec génération research après plusieurs tentatives")
  );
}

async function draftArticleFromResearch(
  frData,
  research,
  validatedReferences,
  topicAnalysis = null,
) {
  const maxRetries = parseInt(process.env.AI_DRAFT_RETRIES || "2", 10);
  const minWords = parseInt(process.env.SEO_MIN_WORDS || "1500", 10);
  let lastError = null;
  const basePrompt = buildDraftPromptFromResearch(
    research,
    validatedReferences,
  );
  let draftArticle = null;
  let accumulatedLabels = {};
  let appendAttempt = 0;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    console.log(
      `Requesting Azure OpenAI draft... (attempt ${attempt}/${maxRetries + 1})`,
    );
    let attemptMetrics = null;
    try {
      if (draftArticle && lastError && lastError.code === "TOO_SHORT") {
        appendAttempt += 1;
        const beforeWords = countWords(draftArticle?.content || "");
        const recoveryPlan = buildLengthRecoveryPlan({
          currentWords: beforeWords,
          minWords: lastError.minWords,
          maxTokens: AZURE_OPENAI_DRAFT_MAX_TOKENS,
          attempt: appendAttempt,
        });
        const appendPayload = await azureOpenAIJson(
          buildDraftAppendPromptFromExistingArticle(draftArticle, {
            minWords: lastError.minWords,
            appendAttempt,
          }),
          {
            endpoint: AZURE_OPENAI_DRAFT_ENDPOINT,
            deployment: AZURE_OPENAI_DRAFT_DEPLOYMENT,
            apiVersion: AZURE_OPENAI_DRAFT_API_VERSION,
            temperature: 0.2,
            topP: 0.9,
            maxTokens: recoveryPlan.requestedMaxTokens,
            debugLabel: `draft append attempt ${attempt}/${maxRetries + 1}`,
            onMetrics: (metrics) => {
              attemptMetrics = metrics;
            },
            system:
              "You are an expert French SEO writer. Output ONLY a JSON object.",
          },
        );
        const appendContent = appendPayload?.appendContent;
        if (!appendContent || typeof appendContent !== "string") {
          throw new Error("Append payload missing appendContent");
        }
        if (/https?:\/\//i.test(appendContent)) {
          const err = new Error("Append content contains URLs (forbidden)");
          err.code = "APPEND_HAS_URLS";
          throw err;
        }
        accumulatedLabels = {
          ...accumulatedLabels,
          ...(appendPayload?.newLabels || {}),
        };
        draftArticle.content = `${String(draftArticle.content || "").trim()}\n\n${appendContent.trim()}`;
        const afterWords = countWords(draftArticle.content || "");
        console.log(
          formatWordProgressLog("append", {
            beforeWords,
            afterWords,
            minWords: lastError.minWords,
          }),
        );
      } else {
        const isCondenseAttempt =
          draftArticle && lastError && lastError.code === "TOO_LONG";
        const prompt =
          isCondenseAttempt
            ? buildDraftRepairPromptFromExistingArticle(draftArticle, {
                mode: "condense",
                minWords: process.env.SEO_MIN_WORDS || "1500",
                maxWords: lastError.maxWords,
              })
            : basePrompt;

        const payload = await azureOpenAIJson(prompt, {
          endpoint: AZURE_OPENAI_DRAFT_ENDPOINT,
          deployment: AZURE_OPENAI_DRAFT_DEPLOYMENT,
          apiVersion: AZURE_OPENAI_DRAFT_API_VERSION,
          temperature:
            isCondenseAttempt ? 0.2 : 0.3,
          topP: 0.9,
          maxTokens: AZURE_OPENAI_DRAFT_MAX_TOKENS,
          debugLabel: `${isCondenseAttempt ? "draft condense" : "draft"} attempt ${attempt}/${maxRetries + 1}`,
          onMetrics: (metrics) => {
            attemptMetrics = metrics;
          },
          system:
            "You are an expert French SEO writer. Output ONLY a JSON object.",
        });

        const newArticle = payload?.newArticle;
        const newLabels = payload?.newLabels || {};
        if (!newArticle || typeof newArticle !== "object") {
          throw new Error("Draft payload missing newArticle");
        }
        appendAttempt = 0;
        accumulatedLabels = { ...accumulatedLabels, ...newLabels };
        draftArticle = newArticle;
        console.log(
          formatWordProgressLog(
            isCondenseAttempt ? "condense" : "draft",
            {
              beforeWords: 0,
              afterWords: countWords(draftArticle.content || ""),
              minWords,
            },
          ),
        );
      }

      // Lock references to the already validated list.
      draftArticle.references = validatedReferences;
      validateNewArticle(frData, draftArticle);
      enforceTopicRotation(frData, draftArticle, topicAnalysis);
      normalizeArticleDates(draftArticle);
      return { newArticle: draftArticle, newLabels: accumulatedLabels };
    } catch (error) {
      const currentWords = countWords(draftArticle?.content || "");
      const metricsSuffix = error?.code && attemptMetrics
        ? ` [words=${currentWords} finish_reason=${attemptMetrics.finishReason || "unknown"} completion_tokens=${attemptMetrics.completionTokens ?? "?"} requested_max_tokens=${attemptMetrics.requestedMaxTokens ?? "default"}]`
        : "";
      lastError = error;
      console.warn(`Draft invalid: ${error.message}${metricsSuffix}`);
    }
  }

  throw lastError || new Error("Échec génération draft Azure OpenAI");
}

function mergeLabels(target, labels) {
  if (!labels || typeof labels !== "object") return;
  for (const [key, value] of Object.entries(labels)) {
    if (value && typeof value === "string" && !(key in target)) {
      target[key] = value;
    }
  }
}

function assertTranslationPayload(translations, locales) {
  if (!translations || typeof translations !== "object") {
    throw new Error(
      `Translation payload missing or invalid. Received: ${typeof translations}`,
    );
  }
  const missing = [];
  for (const locale of locales) {
    const payload = translations[locale];
    if (!payload || !payload.Article) {
      missing.push(`${locale}.Article`);
      continue;
    }
    if (!payload.Article.title) missing.push(`${locale}.title`);
    if (!payload.Article.description) missing.push(`${locale}.description`);
    if (!payload.Article.content) missing.push(`${locale}.content`);
  }
  if (missing.length) {
    throw new Error(`Translation payload incomplete: ${missing.join(", ")}`);
  }
}

async function main() {
  if (!fs.existsSync(FR_PATH)) {
    throw new Error(`Canonical FR ressources file not found: ${FR_PATH}`);
  }
  if (!MOCK_DATA) {
    ensureAzureEnv();
  }

  const frData = loadJSON(FR_PATH);

  // Get existing slugs and topic analysis for trend selection
  const existingSlugs = (Array.isArray(frData.Articles) ? frData.Articles : [])
    .map((a) => a.slug)
    .filter(Boolean);
  const topicAnalysis = analyzeRecentTopics(frData, 15);
  const availableTopicsAnalysis = getAvailableTopics(
    frData,
    topicAnalysis.avoidTopics,
    TOPIC_ROTATION_WINDOW,
  );
  console.log(
    `\n📋 Available topics for selection: ${availableTopicsAnalysis.availableTopics
      .map((topic) => topic.label)
      .join(", ")}`,
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
    // Fetch trend-based topic suggestions
    console.log("\n📊 Fetching trend signals for topic selection...");
    trendData = await getTopicSuggestions({
      existingSlugs,
      avoidTopics: topicAnalysis.avoidTopics,
      recentTopicCategories: topicAnalysis.lastRotationTopics,
      topicCounts: topicAnalysis.topicCounts,
    });
  }

  // Log trend information (keywords only, not sensitive)
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

  // Build SEO suggestions
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
      availableTopicsAnalysis,
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
      availableTopicsAnalysis,
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

  // Detect the article category for reference fallback
  const articleCategory =
    seoSuggestions?.category || detectTopic(newArticle) || "general";
  ensureArticleTaxonomy(newArticle, articleCategory);
  await repairReferences(newArticle, articleCategory);
  syncContentReferencesSection(newArticle);
  sanitizeContentExternalLinks(newArticle);
  normalizeMarkdownHeadings(newArticle);
  normalizeArticleUiLabelsInPlace(newArticle, frData.ArticleUiLabels);
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
      category: newArticle.category,
      tags: newArticle.tags,
      references: newArticle.references,
    };
    normalizeArticleUiLabelsInPlace(localizedArticle, data.ArticleUiLabels);

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
      // Translate only missing/untranslated items. Forcing full retranslation
      // every run is expensive and increases 429/timeout risk in CI.
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
