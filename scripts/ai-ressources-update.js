"use strict";

const fs = require("fs");
const path = require("path");

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const APPLY = args.has("--apply");
const DRY = args.has("--dry-run");
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
    throw new Error(`Failed to load mock data from ${filePath}: ${error.message}`);
  }
}

const MOCK_DATA = MOCK_PATH ? loadMockData(MOCK_PATH) : null;
const OFFLINE_MODE = process.env.OFFLINE_MODE === "1";

const AZURE_AGENT_ENDPOINT = process.env.AZURE_AGENT_ENDPOINT;
const AZURE_AGENT_ID = process.env.AZURE_AGENT_ID;
const AZURE_TRANSLATE_AGENT_ID =
  process.env.AZURE_TRANSLATE_AGENT_ID || AZURE_AGENT_ID;

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
    patterns: [/paie/i, /payroll/i, /salaire/i, /swissdec/i, /cotisation/i, /\bLPP\b/i, /\bLAA\b/i, /\bAVS\b/i],
  },
  {
    topic: "tax",
    label: "Fiscalité & TVA",
    patterns: [/fisc/i, /imp[oô]t/i, /\btax/i, /\bTVA\b/i, /\bVAT\b/i, /\bIFD\b/i],
  },
  {
    topic: "accounting",
    label: "Comptabilité & reporting",
    patterns: [/comptabil/i, /closing/i, /reporting/i, /bilan/i, /FER/i],
  },
  {
    topic: "corporate",
    label: "Corporate & gouvernance",
    patterns: [/corporate/i, /gouvernance/i, /assembl[ée]/i, /\bAG\b/i, /PV/i, /conseil d'administration/i],
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
    topic: "finance",
    label: "Conseil financier",
    patterns: [/tr[eé]sorerie/i, /treasury/i, /finance/i, /cash[- ]?flow/i],
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

function detectTopic(article) {
  if (!article) return "general";
  const base = `${article.slug || ""} ${article.title || ""} ${article.description || ""}`.toLowerCase();
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

function buildSystemPrompt(frJson) {
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

  const topicNote = lastArticle
    ? `Dernier article publié le ${lastArticle.date}: "${lastArticle.title}". Thème identifié: ${describeTopic(lastTopic)}. Choisis un nouveau sujet clairement différent pour maintenir l'alternance éditoriale.`
    : "Aucun article récent identifié. Choisis un sujet à forte valeur pour dirigeants PME genevois.";

  return [
    "Tu es un assistant éditorial SEO expert pour Ark Fiduciaire (Genève, Suisse romande).",
    `Date actuelle: ${today}. N'intègre que des éléments publiés ou mis à jour entre ${sixMonthsAgo} et ${today}.`,
    topicNote,
    "Objectif: proposer EXACTEMENT 1 nouvel article (section « Articles ») en français, utile et concret pour prospects Ark Fiduciaire.",
    "Contraintes impératives:",
    "- Sujet cohérent avec nos services (liste ci-dessous) et différent du dernier article.",
    "- Aucun doublon de slug, ni de sujet déjà traité récemment.",
    "- Article long format (1500 à 3000 mots), structuré, concret, orienté solutions.",
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
    "Respecte les minuscules/majuscules d'origine et garde \"Ark Fiduciaire\" tel quel.",
    "Fourni uniquement le JSON demandé, sans commentaire.",
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

async function azureAgentJson(prompt, { agentId = AZURE_AGENT_ID } = {}) {
  if (!AZURE_AGENT_ENDPOINT) throw new Error("Missing AZURE_AGENT_ENDPOINT");
  if (!agentId) throw new Error("Missing AZURE_AGENT_ID");

  const { AIProjectClient } = require("@azure/ai-projects");
  const { DefaultAzureCredential } = require("@azure/identity");
  const credential = new DefaultAzureCredential();
  const client = new AIProjectClient(AZURE_AGENT_ENDPOINT, credential);
  const debugAgent = !!process.env.DEBUG_AGENT;

  const agentMeta = await client.agents.getAgent(agentId);
  if (debugAgent) {
    console.log(`[agent] Using agentId=${agentId} name=${agentMeta.name || ""}`);
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

function ensureAzureEnv() {
  const missing = [];
  if (!AZURE_AGENT_ENDPOINT) missing.push("AZURE_AGENT_ENDPOINT");
  if (!AZURE_AGENT_ID) missing.push("AZURE_AGENT_ID");
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
    if (!article[key] || (Array.isArray(article[key]) && !article[key].length)) {
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
  const lastArticle = getLastArticle(frData);
  if (!lastArticle) return;
  const previousTopic = detectTopic(lastArticle);
  const nextTopic = detectTopic(newArticle);
  if (
    previousTopic &&
    nextTopic &&
    previousTopic === nextTopic &&
    nextTopic !== "general"
  ) {
    const err = new Error(
      `Le dernier article traitait déjà du thème ${describeTopic(nextTopic)}`
    );
    err.code = "TOPIC_DUPLICATE";
    err.topic = nextTopic;
    err.previousTitle = lastArticle.title;
    throw err;
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
      `⚠️ Le dernier article (${error.previousTitle}) couvrait déjà ${describeTopic(error.topic)}.\n` +
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

async function unreachableReferences(refs) {
  if (OFFLINE_MODE) return [];
  const bad = [];
  for (const ref of refs) {
    if (!ref || !ref.url) continue;
    const ok = await httpOk(ref.url);
    if (!ok) {
      bad.push(ref);
    }
  }
  return bad;
}

async function repairReferences(article) {
  if (OFFLINE_MODE) return;
  let bad = await unreachableReferences(article.references);
  const maxRetries = parseInt(process.env.AI_REF_RETRIES || "2", 10);
  let attempt = 0;

  while (bad.length && attempt < maxRetries) {
    attempt++;
    console.warn(
      `Références inaccessibles détectées (${bad
        .map((r) => r.url)
        .join(", ")}). Tentative de régénération ${attempt}/${maxRetries}...`
    );
    const regenPrompt = [
      "Certaines références générées sont inaccessibles.",
      "Fournis UNIQUEMENT un JSON de la forme {\"references\": [ {\"labelKey\": \"...\", \"url\": \"https://...\"}, ... ]}.",
      "URLs acceptables: sources officielles (admin.ch, ge.ch, vd.ch, fedlex.admin.ch, odoo.com/docs, etc.).",
      "Chaque domaine ne doit être représenté qu'une seule fois dans les références (pas de doublons de domaine).",
      `Thème de l'article: ${article.title} (slug: ${article.slug}).`,
      "URLs à éviter absolument:",
      ...bad.map((ref) => `- ${ref.url}`),
    ].join("\n");

    let regen;
    try {
      regen =
        MOCK_DATA?.regenReferences?.[attempt - 1] ||
        (await azureAgentJson(regenPrompt, { agentId: AZURE_AGENT_ID }));
    } catch (error) {
      console.warn(`Échec régénération références: ${error.message}`);
      break;
    }

    if (regen && Array.isArray(regen.references) && regen.references.length) {
      article.references = regen.references;
      bad = await unreachableReferences(article.references);
    } else {
      console.warn("La régénération n'a pas retourné de références valides.");
      break;
    }
  }

  if (bad.length) {
    if (process.env.FAIL_ON_BAD_REFERENCE) {
      throw new Error(
        `Références inaccessibles: ${bad.map((r) => r.url).join(", ")}`
      );
    }
    console.warn(
      `Suppression des références inaccessibles: ${bad
        .map((r) => r.url)
        .join(", ")}`
    );
    const badSet = new Set(bad.map((r) => r.url));
    article.references = article.references.filter(
      (ref) => !badSet.has(ref.url)
    );
  }
}

async function generateArticleWithRetries(frData, attempts) {
  const basePrompt = buildSystemPrompt(frData);
  let prompt = basePrompt;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    console.log(
      `Requesting Azure Agent for new FR article... (attempt ${attempt}/${attempts})`
    );
    const draft =
      MOCK_DATA?.draft || (await azureAgentJson(prompt, { agentId: AZURE_AGENT_ID }));
    try {
      const newArticle = draft.newArticle;
      const newLabels = draft.newLabels || {};
      validateNewArticle(frData, newArticle);
      enforceTopicRotation(frData, newArticle);
      normalizeArticleDates(newArticle);
      return { newArticle, newLabels };
    } catch (error) {
      lastError = error;
      console.warn(`Draft invalid: ${error.message}`);
      prompt = buildRetryPrompt(basePrompt, error, frData);
    }
  }

  throw lastError || new Error("Échec génération article après plusieurs tentatives");
}

function mergeLabels(target, labels) {
  if (!labels || typeof labels !== "object") return;
  for (const [key, value] of Object.entries(labels)) {
    if (value && typeof value === "string" && !(key in target)) {
      target[key] = value;
    }
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
  const { newArticle, newLabels } = await generateArticleWithRetries(
    frData,
    parseInt(process.env.AI_ARTICLE_RETRIES || "3", 10)
  );

  await repairReferences(newArticle);
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
  const translations =
    MOCK_DATA?.translations ||
    (await azureAgentJson(buildTranslatePrompt(newArticle, newLabels), {
      agentId: AZURE_TRANSLATE_AGENT_ID,
    }));

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
      console.warn(`[WARN] Missing translation payload for ${locale}; skipping.`);
      continue;
    }
    const articleTr = payload.Article;
    const labelsTr = payload.labels || {};
    const localizedArticle = {
      slug: newArticle.slug,
      title: articleTr.title || newArticle.title,
      description: articleTr.description || newArticle.description,
      content: articleTr.content || newArticle.content,
      author: newArticle.author,
      date: newArticle.date,
      references: newArticle.references,
    };

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

  console.log("Done.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
