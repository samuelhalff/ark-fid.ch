"use strict";

const fs = require("fs");
const path = require("path");

// Import trend and reference validation modules
const { getTopicSuggestions, buildSEOSuggestions } = require("./lib/trends");
const { validateReferences, deduplicateByDomain, getFallbackReferences } = require("./lib/referenceValidator");

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
      `Failed to load mock data from ${filePath}: ${error.message}`
    );
  }
}

const MOCK_DATA = MOCK_PATH ? loadMockData(MOCK_PATH) : null;
const OFFLINE_MODE = process.env.OFFLINE_MODE === "1";
const REQUIRE_TRANSLATIONS =
  process.env.REQUIRE_TRANSLATIONS === "1" || process.env.CI === "true";

const AZURE_AGENT_ENDPOINT = process.env.AZURE_AGENT_ENDPOINT;
// Support both AZURE_AGENT_NAME (new) and AZURE_AGENT_ID (legacy)
const AZURE_AGENT_NAME = process.env.AZURE_AGENT_NAME || process.env.AZURE_AGENT_ID;
const AZURE_TRANSLATE_AGENT_NAME =
  process.env.AZURE_TRANSLATE_AGENT_NAME || process.env.AZURE_TRANSLATE_AGENT_ID || AZURE_AGENT_NAME;
const AZURE_AGENT_API_VERSION = process.env.AZURE_AGENT_API_VERSION || "v1";
const AZURE_AGENT_API_VERSIONS = Array.from(
  new Set([AZURE_AGENT_API_VERSION, "v1"].filter(Boolean))
);

const ROOT = process.cwd();
const TRANSLATIONS_DIR = path.join(ROOT, "src", "translations");
const FR_PATH = path.join(TRANSLATIONS_DIR, "fr", "ressources.json");
const LOCALES = ["en", "de", "es", "pt"];

const SERVICES = [
  "comptabilité (PME, indépendants, Swiss GAAP FER)",
  "fiscalité (TVA, impôt cantonal et fédéral, BEPS 2.0)",
  "corporate (gouvernance, PV, AG, conseils d'administration)",
  "paie (swissdec, LPP, LAA, AC, payroll externalisé)",
  "domiciliation et direction",
  "outsourcing administratif et financier",
  "implémentation Odoo et intégrations ERP",
  "fusions et acquisitions (M&A)",
  "family office (gestion de patrimoine, HNI)",
  "constitution et incorporation d'entreprise",
  "conformité réglementaire (SRO/OAR, LBA/AML, FINMA)",
];

const TOPIC_KEYWORDS = [
  {
    topic: "odoo",
    label: "Odoo / ERP",
    patterns: [/odoo/i, /\berp\b/i, /erp 17/i, /erp 18/i],
  },
  {
    topic: "payroll",
    label: "Paie & salaires",
    patterns: [
      /paie/i,
      /payroll/i,
      /salaire/i,
      /swissdec/i,
      /cotisation/i,
      /\bLPP\b/i,
      /\bLAA\b/i,
      /\bAVS\b/i,
    ],
  },
  {
    topic: "tax",
    label: "Fiscalité & TVA",
    patterns: [
      /fisc/i,
      /imp[oô]t/i,
      /\btax/i,
      /\bTVA\b/i,
      /\bVAT\b/i,
      /\bIFD\b/i,
    ],
  },
  {
    topic: "accounting",
    label: "Comptabilité & reporting",
    patterns: [/comptabil/i, /closing/i, /reporting/i, /bilan/i, /FER/i],
  },
  {
    topic: "corporate",
    label: "Corporate & gouvernance",
    patterns: [
      /corporate/i,
      /gouvernance/i,
      /assembl[ée]/i,
      /\bAG\b/i,
      /PV/i,
      /conseil d'administration/i,
    ],
  },
  {
    topic: "domiciliation",
    label: "Domiciliation & siège",
    patterns: [/domicil/i],
  },
  {
    topic: "outsourcing",
    label: "Outsourcing & BPO",
    patterns: [/outsourcing/i, /externalisation/i, /\bBPO\b/i],
  },
  {
    topic: "ma",
    label: "Fusions & acquisitions",
    patterns: [/fusion/i, /acquisition/i, /\bM&A\b/i, /m&a/i, /due diligence/i],
  },
  {
    topic: "family-office",
    label: "Family office & patrimoine",
    patterns: [
      /family.?office/i,
      /patrimoine/i,
      /\bHNI\b/i,
      /fortune/i,
      /wealth/i,
    ],
  },
  {
    topic: "incorporation",
    label: "Incorporation & constitution",
    patterns: [
      /incorporation/i,
      /constitution/i,
      /créer/i,
      /fondation/i,
      /création d'entreprise/i,
    ],
  },
  {
    topic: "finance",
    label: "Conseil financier",
    patterns: [/tr[eé]sorerie/i, /treasury/i, /finance/i, /cash[- ]?flow/i],
  },
  {
    topic: "regulatory",
    label: "Conformité réglementaire (SRO/OAR, LBA/AML, FINMA)",
    patterns: [
      /\bSRO\b/i,
      /\bOAR\b/i,
      /\bLBA\b/i,
      /\bAML\b/i,
      /\bFINMA\b/i,
      /blanchiment/i,
      /anti[- ]?money/i,
      /conformit[ée]/i,
      /r[ée]glement/i,
      /licence/i,
      /autorisation/i,
      /agr[ée]ment/i,
      /surveillance/i,
      /self[- ]?regul/i,
      /organisme.*auto/i,
    ],
  },
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
  const sameContent =
    (localized.content || "") === (canonical.content || "");
  return sameTitle && sameDesc && sameContent;
}

function detectTopic(article) {
  if (!article) return "general";
  const base = `${article.slug || ""} ${article.title || ""} ${
    article.description || ""
  }`.toLowerCase();
  for (const entry of TOPIC_KEYWORDS) {
    if (entry.patterns.some((rx) => rx.test(base))) {
      return entry.topic;
    }
  }
  return "general";
}

function describeTopic(topic) {
  const entry = TOPIC_KEYWORDS.find((t) => t.topic === topic);
  return entry ? entry.label : "Thème général";
}

function getLastArticle(frData) {
  const articles = Array.isArray(frData?.Articles) ? frData.Articles : [];
  if (!articles.length) return null;
  const sorted = [...articles].sort((a, b) =>
    (a.date || "").localeCompare(b.date || "")
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
    (b.date || "").localeCompare(a.date || "")
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
  const underrepresented = TOPIC_KEYWORDS
    .filter((t) => (topicCounts[t.topic] || 0) <= 1)
    .map((t) => t.label);

  // Get last 5 topics to avoid immediate repetition
  const lastFiveTopics = recent.slice(0, 5).map((a) => detectTopic(a));

  return {
    topicCounts,
    overrepresented,
    underrepresented,
    lastFiveTopics,
    avoidTopics: [...new Set(lastFiveTopics.filter((t) => t !== "general"))],
  };
}

function buildSystemPrompt(frJson, trendData = null) {
  const today = isoDateToday();
  const sixMonthsAgo = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  })();
  const lastArticle = getLastArticle(frJson);
  const lastTopic = detectTopic(lastArticle);
  const recentSlugs = (Array.isArray(frJson.Articles) ? frJson.Articles : [])
    .slice(-12)
    .map((a) => a.slug)
    .filter(Boolean);

  // Analyze topic distribution for better variety
  const topicAnalysis = analyzeRecentTopics(frJson, 15);
  
  // Build topic guidance based on analysis
  const avoidTopicsLabels = topicAnalysis.avoidTopics.map(describeTopic);
  const suggestedTopics = topicAnalysis.underrepresented.slice(0, 4);
  
  const topicNote = lastArticle
    ? `Dernier article publié le ${lastArticle.date}: "${
        lastArticle.title
      }". Thème identifié: ${describeTopic(
        lastTopic
      )}. Choisis un nouveau sujet CLAIREMENT DIFFÉRENT pour maintenir l'alternance éditoriale.`
    : "Aucun article récent identifié. Choisis un sujet à forte valeur pour dirigeants PME genevois.";

  // Build topic diversity guidance
  const diversityGuidance = [];
  if (avoidTopicsLabels.length > 0) {
    diversityGuidance.push(
      `⚠️ THÈMES À ÉVITER (traités récemment dans les 5 derniers articles): ${avoidTopicsLabels.join(", ")}.`
    );
  }
  if (suggestedTopics.length > 0) {
    diversityGuidance.push(
      `✅ THÈMES SUGGÉRÉS (peu couverts récemment, à privilégier): ${suggestedTopics.join(", ")}.`
    );
  }
  if (topicAnalysis.overrepresented.length > 0) {
    const overLabels = topicAnalysis.overrepresented.map(
      (t) => `${t.label} (${t.count} articles)`
    );
    diversityGuidance.push(
      `📊 Thèmes surreprésentés (éviter absolument): ${overLabels.join(", ")}.`
    );
  }

  // Build trend-based keyword guidance
  const trendGuidance = [];
  if (trendData && trendData.selectedTopic) {
    const { suggestedTopic, keywords, outline, category } = trendData.selectedTopic;
    trendGuidance.push(
      "",
      "=== SIGNAUX TENDANCE SEO (à intégrer si pertinent) ===",
      `📈 Sujet suggéré par tendance: "${suggestedTopic}"`,
      `🔑 Mots-clés SEO cibles: ${keywords.join(", ")}`
    );
    if (outline && outline.length > 0) {
      trendGuidance.push(`📋 Plan suggéré: ${outline.join(" → ")}`);
    }
    if (category) {
      trendGuidance.push(`📁 Catégorie thématique: ${category}`);
    }
    if (trendData.usedFallback) {
      trendGuidance.push("ℹ️ (Sujet basé sur liste evergreen - tendances indisponibles)");
    }
    trendGuidance.push(
      "",
      "⚠️ IMPORTANT: Intègre ces mots-clés naturellement dans le titre, la description et le contenu pour optimiser le SEO.",
      "⚠️ Le sujet suggéré est une indication, adapte-le selon nos services fiduciaires genevois."
    );
  }

  return [
    "Tu es un assistant éditorial SEO expert pour Ark Fiduciaire (Genève, Suisse romande).",
    `Date actuelle: ${today}. N'intègre que des éléments publiés ou mis à jour entre ${sixMonthsAgo} et ${today}.`,
    topicNote,
    "",
    "=== DIVERSITÉ THÉMATIQUE (CRITIQUE) ===",
    ...diversityGuidance,
    ...trendGuidance,
    "",
    "Objectif: proposer EXACTEMENT 1 nouvel article (section « Articles ») en français, avec des conseils pratiques et utiles pour les visiteurs PME/indépendants.",
    "",
    "Contraintes impératives:",
    "- FOCUS sur des conseils pratiques, astuces concrètes, erreurs courantes à éviter, guides étape-par-étape, taux/rates actuels par canton/activité.",
    "- Exemples souhaités: omissions courantes dans déclarations fiscales, taux sociaux par canton, taux TVA par activité, conformité LBA/AML, obtention de licences FINMA, affiliation SRO/OAR, quand/déclarer comment, pièges à éviter, optimisations légales.",
    "- ÉVITER les articles généraux ou théoriques; privilégier le concret et l'actionnable.",
    "- Sujet cohérent avec nos services (liste ci-dessous) et DIFFÉRENT des articles récents.",
    "- Aucun doublon de slug, ni de sujet déjà traité récemment.",
    "- Article format pratique (800 à 1500 mots), structuré avec sections claires, listes, exemples chiffrés.",
    "- Style professionnel, humain, sans capitales superflues.",
    "- Inclure au moins deux références officielles ou sources fiables sur le sujet, vérifier que l'url n'est pas inventée, trouver le lien vers l'article ou le document sur un site spécialisé sur le sujet, typiquement un site gouvernemental, un site cantonal, ou un site reconnu dans le domaine concerné et qui référence le lien en support de contenu idoine.",
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

function extractJsonFromText(raw) {
  if (!raw || typeof raw !== "string") {
    throw new Error("Empty Azure Agent response");
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    // Look for fenced code block
    const fence = raw.match(/```(?:json)?\n([\s\S]*?)```/i);
    if (fence) {
      const inner = fence[1].trim();
      return JSON.parse(inner);
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
            return JSON.parse(candidate);
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

/**
 * Legacy Azure Agent API using the AIProjectClient.
 * This is kept for backwards compatibility when Responses API fails.
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

  const agentMeta = await client.agents.getAgent(agentId);
  if (debugAgent) {
    console.log(
      `[agent] Using agentId=${agentId} name=${agentMeta.name || ""}`
    );
  }

  const thread = await client.agents.threads.create();
  await client.agents.messages.create(thread.id, "user", prompt);

  let run = await client.agents.runs.create(thread.id, agentId);
  const timeoutMs = parseInt(
    process.env.AZURE_AGENT_RUN_TIMEOUT_MS || "180000",
    10
  );
  const started = Date.now();
  while (["queued", "in_progress", "cancelling"].includes(run.status)) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(
        `Azure Agent run timeout after ${timeoutMs} ms (status=${run.status})`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    run = await client.agents.runs.get(thread.id, run.id);
  }
  if (run.status === "failed") {
    throw new Error(
      "Azure Agent run failed: " +
        (run.lastError?.message || JSON.stringify(run.lastError))
    );
  }

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
 * Call Azure AI Foundry Agent using the Responses API with agent reference.
 * This is the new preferred method that uses agent name instead of agent ID.
 * @param {string} prompt - The user prompt
 * @param {Object} options - Options including agentName
 * @returns {Promise<Object>} Parsed JSON response
 */
async function azureAgentResponsesApi(prompt, { agentName = AZURE_AGENT_NAME } = {}) {
  if (!AZURE_AGENT_ENDPOINT) throw new Error("Missing AZURE_AGENT_ENDPOINT");
  if (!agentName) throw new Error("Missing AZURE_AGENT_NAME");

  const { DefaultAzureCredential } = require("@azure/identity");
  const credential = new DefaultAzureCredential();
  const debugAgent = !!process.env.DEBUG_AGENT;

  // Get access token for Azure AI Foundry
  const tokenResponse = await credential.getToken("https://ai.azure.com/.default");
  const accessToken = tokenResponse.token;

  // Build the responses API URL
  // AZURE_AGENT_ENDPOINT should be: https://<resource>.services.ai.azure.com/api/projects/<project>
  const baseUrl = AZURE_AGENT_ENDPOINT.replace(/\/$/, "");

  if (debugAgent) {
    console.log(`[agent] Using Responses API with agent name: ${agentName}`);
  }

  const timeoutMs = parseInt(process.env.AZURE_AGENT_RUN_TIMEOUT_MS || "180000", 10);
  
  const requestBody = {
    input: prompt,
    extra_body: {
      agent: buildAgentReference(agentName),
    },
  };

  const callResponsesApi = async (apiVersion) => {
    const responsesUrl = `${baseUrl}/agents/responses?api-version=${encodeURIComponent(
      apiVersion
    )}`;
    if (debugAgent) {
      console.log(`[agent] Endpoint: ${responsesUrl}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(responsesUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        let errorPayload;
        try {
          errorPayload = JSON.parse(errorText);
        } catch {
          errorPayload = null;
        }
        const error = new Error(
          `Azure Responses API HTTP ${response.status}: ${errorText.slice(0, 500)}`
        );
        const errorCode = errorPayload?.error?.code;
        if (errorCode === "UnsupportedApiVersion" || errorText.includes("UnsupportedApiVersion")) {
          error.code = "UnsupportedApiVersion";
        }
        throw error;
      }

      const result = await response.json();
      
      // Extract text content from the response
      let outputText = "";
      if (result.output) {
        if (typeof result.output === "string") {
          outputText = result.output;
        } else if (Array.isArray(result.output)) {
          // Handle array of content items
          for (const item of result.output) {
            if (item.type === "text" && item.text) {
              outputText = typeof item.text === "string" ? item.text : item.text.value || "";
            } else if (item.type === "message" && item.content) {
              for (const c of item.content) {
                if (c.type === "text" && c.text) {
                  outputText = typeof c.text === "string" ? c.text : c.text.value || "";
                }
              }
            }
          }
        } else if (result.output.content) {
          // Handle single message with content
          for (const c of result.output.content) {
            if (c.type === "text" && c.text) {
              outputText = typeof c.text === "string" ? c.text : c.text.value || "";
            }
          }
        }
      }
      
      if (!outputText && result.choices?.[0]?.message?.content) {
        outputText = result.choices[0].message.content;
      }

      if (!outputText) {
        if (debugAgent) {
          console.log("[agent] Full response:", JSON.stringify(result, null, 2));
        }
        throw new Error("Azure Responses API returned no output text");
      }

      return extractJsonFromText(outputText);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error(`Azure Responses API timeout after ${timeoutMs}ms`);
      }
      throw err;
    }
  };

  let lastError;
  for (const apiVersion of AZURE_AGENT_API_VERSIONS) {
    try {
      return await callResponsesApi(apiVersion);
    } catch (err) {
      if (err.code === "UnsupportedApiVersion" && apiVersion !== "v1") {
        lastError = err;
        if (debugAgent) {
          console.warn(
            `[agent] Responses API version ${apiVersion} unsupported, retrying with fallback...`
          );
        }
        continue;
      }
      throw err;
    }
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error("Azure Responses API failed for all configured versions.");
}

function ensureAzureEnv() {
  const missing = [];
  if (!AZURE_AGENT_ENDPOINT) missing.push("AZURE_AGENT_ENDPOINT");
  if (!AZURE_AGENT_NAME) missing.push("AZURE_AGENT_NAME (or AZURE_AGENT_ID)");
  if (missing.length) {
    throw new Error(
      `Missing required Azure env vars: ${missing.join(", ")}. See README.`
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
    "references",
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
      .filter(Boolean)
  );
  if (slugs.has(article.slug)) {
    const err = new Error(`Slug déjà existant: ${article.slug}`);
    err.code = "DUPLICATE_SLUG";
    err.slug = article.slug;
    throw err;
  }

  if (!Array.isArray(article.references) || !article.references.length) {
    const err = new Error("Au moins une référence est requise");
    err.code = "MISSING_REFERENCES";
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
}

function enforceTopicRotation(frData, newArticle) {
  const articles = Array.isArray(frData?.Articles) ? frData.Articles : [];
  if (!articles.length) return;
  
  // Get last 5 articles sorted by date
  const sorted = [...articles].sort((a, b) =>
    (b.date || "").localeCompare(a.date || "")
  );
  const recentArticles = sorted.slice(0, 5);
  
  const nextTopic = detectTopic(newArticle);
  if (nextTopic === "general") return; // General topics are always allowed
  
  // Check if this topic appears in any of the last 5 articles
  for (const article of recentArticles) {
    const articleTopic = detectTopic(article);
    if (articleTopic === nextTopic) {
      const err = new Error(
        `Le thème "${describeTopic(nextTopic)}" a déjà été traité récemment (article: "${article.title}")`
      );
      err.code = "TOPIC_DUPLICATE";
      err.topic = nextTopic;
      err.previousTitle = article.title;
      throw err;
    }
  }
}

function normalizeArticleDates(article) {
  const today = isoDateToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.date || "")) {
    article.date = today;
  }
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
  } else if (error.code === "TOPIC_DUPLICATE") {
    hint =
      `⚠️ Le dernier article (${
        error.previousTitle
      }) couvrait déjà ${describeTopic(error.topic)}.\n` +
      "Choisis un autre axe stratégique (paie, fiscalité, corporate, domiciliation, outsourcing, etc.).";
  } else if (error.code === "MISSING_FIELD" && error.field) {
    hint = `⚠️ Le champ ${error.field} est manquant. Fournis un article complet avec ce champ rempli.`;
  }

  return `${basePrompt}\n\n${hint}`;
}

async function httpOk(
  url,
  timeoutMs = parseInt(process.env.LINK_CHECK_TIMEOUT_MS || "10000", 10)
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

  console.log(`[refs] Validating ${article.references?.length || 0} references...`);

  // First, deduplicate by domain
  const dedupedRefs = deduplicateByDomain(article.references || []);
  if (dedupedRefs.length < (article.references || []).length) {
    console.log(`[refs] Removed ${(article.references || []).length - dedupedRefs.length} duplicate domain references`);
    article.references = dedupedRefs;
  }

  // Validate all references
  const validationResult = await validateReferences(article.references, {
    timeout: parseInt(process.env.LINK_CHECK_TIMEOUT_MS || "10000", 10),
    minBytes: parseInt(process.env.LINK_CHECK_MIN_BYTES || "600", 10)
  });

  console.log(`[refs] Validation results: ${validationResult.stats.valid} valid, ${validationResult.stats.invalid} invalid`);

  // Log rejected references
  for (const ref of validationResult.invalid) {
    const reason = ref._validation?.reason || "unknown";
    const error = ref._validation?.error || "";
    console.warn(`[refs] Rejected: ${ref.url} (${reason}: ${error})`);
  }

  // If we have some valid references, use them
  if (validationResult.valid.length > 0) {
    // Remove _validation metadata before saving
    article.references = validationResult.valid.map(ref => {
      const { _validation, ...cleanRef } = ref;
      return cleanRef;
    });
  }

  // If we don't have enough valid references (need at least 2), try to regenerate
  const maxRetries = parseInt(process.env.AI_REF_RETRIES || "2", 10);
  let attempt = 0;

  while (article.references.length < 2 && attempt < maxRetries) {
    attempt++;
    console.warn(
      `[refs] Need more references (have ${article.references.length}, need 2). Regeneration attempt ${attempt}/${maxRetries}...`
    );

    const regenPrompt = [
      "Certaines références générées sont inaccessibles ou invalides.",
      'Fournis UNIQUEMENT un JSON de la forme {"references": [ {"labelKey": "...", "url": "https://..."}, ... ]}.',
      "URLs acceptables: sources officielles (admin.ch, ge.ch, vd.ch, fedlex.admin.ch, odoo.com/docs, etc.).",
      "Chaque domaine ne doit être représenté qu'une seule fois dans les références (pas de doublons de domaine).",
      `Thème de l'article: ${article.title} (slug: ${article.slug}).`,
      "Fournis au moins 3 références de sources fiables et vérifiées.",
    ].join("\n");

    let regen;
    try {
      // Try SDK-based API first (more reliable), then Responses API as fallback
      regen =
        MOCK_DATA?.regenReferences?.[attempt - 1] ||
        (await azureAgentJson(regenPrompt, { agentId: AZURE_AGENT_NAME }).catch(
          (sdkErr) => {
            console.warn(`[refs] SDK API failed (${sdkErr.message}), trying Responses API...`);
            return azureAgentResponsesApi(regenPrompt, { agentName: AZURE_AGENT_NAME }).catch(
              () => {
                // Both methods failed, throw the original SDK error
                throw sdkErr;
              }
            );
          }
        ));
    } catch (error) {
      console.warn(`[refs] Regeneration failed: ${error.message}`);
      break;
    }

    if (regen && Array.isArray(regen.references) && regen.references.length) {
      // Validate the new references
      const newValidation = await validateReferences(regen.references);
      if (newValidation.valid.length > 0) {
        // Merge with existing valid references
        const existingUrls = new Set(article.references.map(r => r.url));
        for (const ref of newValidation.valid) {
          if (!existingUrls.has(ref.url)) {
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
  if (article.references.length < 2) {
    console.warn(`[refs] Using verified fallback references for category: ${category}`);
    const fallbacks = getFallbackReferences(category);
    const existingUrls = new Set(article.references.map(r => r.url));
    
    for (const fallback of fallbacks) {
      if (!existingUrls.has(fallback.url) && article.references.length < 3) {
        article.references.push({ ...fallback });
        existingUrls.add(fallback.url);
      }
    }
  }

  // Final deduplication
  article.references = deduplicateByDomain(article.references);
  
  console.log(`[refs] Final reference count: ${article.references.length}`);
}

async function generateArticleWithRetries(frData, attempts, trendData = null) {
  const basePrompt = buildSystemPrompt(frData, trendData);
  let prompt = basePrompt;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(
      `Requesting Azure Agent for new FR article... (attempt ${attempt}/${attempts})`
    );
    
    let draft;
    if (MOCK_DATA?.draft) {
      draft = MOCK_DATA.draft;
    } else {
      // Try SDK-based API first (more reliable), then Responses API as fallback
      try {
        draft = await azureAgentJson(prompt, { agentId: AZURE_AGENT_NAME });
      } catch (sdkErr) {
        console.warn(
          `[agent] SDK API failed (${sdkErr.message}), trying Responses API...`
        );
        try {
          draft = await azureAgentResponsesApi(prompt, { agentName: AZURE_AGENT_NAME });
        } catch (responsesErr) {
          // Both methods failed, throw the original SDK error as it's more informative
          throw sdkErr;
        }
      }
    }
    
    try {
      const newArticle = draft.newArticle;
      const newLabels = draft.newLabels || {};
      validateNewArticle(frData, newArticle);
      enforceTopicRotation(frData, newArticle);
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
      `Translation payload missing or invalid. Received: ${typeof translations}`
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
    .map(a => a.slug)
    .filter(Boolean);
  const topicAnalysis = analyzeRecentTopics(frData, 15);

  // Fetch trend-based topic suggestions
  console.log("\n📊 Fetching trend signals for topic selection...");
  const trendData = await getTopicSuggestions({
    existingSlugs,
    avoidTopics: topicAnalysis.avoidTopics,
    recentTopicCategories: topicAnalysis.lastFiveTopics
  });

  // Log trend information (keywords only, not sensitive)
  if (trendData.selectedTopic) {
    console.log(`[trends] Provider: ${trendData.provider}`);
    console.log(`[trends] Trends checked: ${trendData.trendsChecked}`);
    console.log(`[trends] Used fallback: ${trendData.usedFallback}`);
    console.log(`[trends] Selected topic: "${trendData.selectedTopic.suggestedTopic}"`);
    console.log(`[trends] Target keywords: ${trendData.selectedTopic.keywords?.join(", ")}`);
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

  const { newArticle, newLabels } = await generateArticleWithRetries(
    frData,
    parseInt(process.env.AI_ARTICLE_RETRIES || "3", 10),
    trendData
  );

  // Detect the article category for reference fallback
  const articleCategory = seoSuggestions?.category || detectTopic(newArticle) || "general";
  await repairReferences(newArticle, articleCategory);
  normalizeArticleDates(newArticle);

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

  console.log("Requesting Azure Agent for translations (EN/DE/ES/PT)...");
  let translations;
  if (MOCK_DATA?.translations) {
    translations = MOCK_DATA.translations;
  } else {
    // Try SDK-based API first (more reliable), then Responses API as fallback
    try {
      translations = await azureAgentJson(
        buildTranslatePrompt(newArticle, newLabels),
        { agentId: AZURE_TRANSLATE_AGENT_NAME }
      );
    } catch (sdkErr) {
      console.warn(
        `[agent] Translation SDK API failed (${sdkErr.message}), trying Responses API...`
      );
      try {
        translations = await azureAgentResponsesApi(
          buildTranslatePrompt(newArticle, newLabels),
          { agentName: AZURE_TRANSLATE_AGENT_NAME }
        );
      } catch (responsesErr) {
        // Both methods failed, throw the original SDK error as it's more informative
        throw sdkErr;
      }
    }
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
        `[ERROR] ${locale} translation matches FR content for ${newArticle.slug}.`
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

  if (TRANSLATE_EXISTING) {
    const spawnSync = require("child_process").spawnSync;
    console.log("Regenerating translations for existing articles...");
    const result = spawnSync(
      "node",
      ["scripts/translate-articles.js", "--apply", "--force"],
      {
        stdio: "inherit",
        env: process.env,
      }
    );
    if (result.status !== 0) {
      throw new Error(
        `translate-articles.js failed with exit code ${result.status}`
      );
    }
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
