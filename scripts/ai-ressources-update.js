"use strict";
/**
 * Every 48 h AI-driven ressources update (Azure Agent ONLY)
 * - Uses Azure AI Project Agent to propose EXACTLY 1 new File and 1 new Article (FR canonical)
 * - Validates: schema, uniqueness, links (HTTP 2xx), capitalization
 * - Appends to src/translations/fr/ressources.json (no modifications to existing entries)
 * - Second Azure Agent call translates ONLY the two new entries into EN/DE/ES/PT (+ new label keys)
 * - Appends translated entries per locale and merges new label keys
 * - Optionally downloads the new PDF (see download-missing-pdfs.js)
 *
 * Required env:
 *   AZURE_AGENT_ENDPOINT  (https://<name>.services.ai.azure.com/api/projects/<project>)
 *   AZURE_AGENT_ID        (asst_xxx for drafting FR)
 * Optional:
 *   AZURE_TRANSLATE_AGENT_ID (distinct agent for translation, falls back to AZURE_AGENT_ID)
 *   AZURE_AGENT_RUN_TIMEOUT_MS (default 120000)
 *
 * Authentication: ONLY Azure AD identities are supported (DefaultAzureCredential chain).
 *  Provide one of:
 *    - az login (developer environment)
 *    - Federated OIDC (GitHub Actions) mapped to a Service Principal with access
 *    - Service Principal env vars: AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET
 *    - Managed Identity (in Azure hosting environment)
 *  Project (Agent) API keys are NOT currently supported by this script.
 *
 * Run (dry):  node scripts/ai-ressources-update.js --dry-run
 * Run (apply): AZURE_AGENT_ENDPOINT=... AZURE_AGENT_ID=... node scripts/ai-ressources-update.js --apply
 */

const fs = require("fs");
const path = require("path");

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const DRY = args.has("--dry-run");
const SKIP_DL = args.has("--skip-download");

const PROVIDER = "azure-agent";

// Azure Agent configuration (alternative provider)
// Using official @azure/ai-projects SDK flow:
//  Required env:
//   - AZURE_AGENT_ENDPOINT  (Project URL, e.g. https://<name>.services.ai.azure.com/api/projects/<project-name>)
//   - AZURE_AGENT_ID        (Agent / Assistant ID: asst_xxx)
//  Optional env:
//   - AZURE_TRANSLATE_AGENT_ID (If you want a separate agent for translation; falls back to AZURE_AGENT_ID)
//   - AZURE_IDENTITY_LOGGING_ENABLED=1 to help debug credential chain
// (No API key path; DefaultAzureCredential only)
const AZURE_AGENT_ENDPOINT = process.env.AZURE_AGENT_ENDPOINT;
const AZURE_AGENT_ID = process.env.AZURE_AGENT_ID;
const AZURE_TRANSLATE_AGENT_ID =
  process.env.AZURE_TRANSLATE_AGENT_ID || AZURE_AGENT_ID;
// Legacy chat URL + direct HTTP fallback removed (AAD auth only)

const ROOT = process.cwd();
const TRANSLATIONS = path.join(ROOT, "src", "translations");
const FR_PATH = path.join(TRANSLATIONS, "fr", "ressources.json");
const LOCALES = ["en", "de", "es", "pt"];

if (!fs.existsSync(FR_PATH)) {
  console.error(`Canonical FR file not found: ${FR_PATH}`);
  process.exit(2);
}

function loadJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`Failed to parse ${p}: ${e.message}`);
  }
}

function saveJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function isoDateToday() {
  return new Date().toISOString().slice(0, 10);
}

// Basic PDF heuristics (duplicated lightweight subset of download-missing-pdfs.js)
function isPdfLikeResponse(res) {
  const ct = res.headers.get("content-type") || "";
  const cd = res.headers.get("content-disposition") || "";
  const url = res.url || "";
  const ctPdf = /application\/(pdf|octet-stream)/i.test(ct) && !/html/i.test(ct);
  const urlPdf = /\.pdf(\?|#|$)/i.test(url);
  const cdPdf = /filename\*=?.*\.pdf/i.test(cd) || /filename=.*\.pdf/i.test(cd);
  return ctPdf || urlPdf || cdPdf;
}

async function downloadPdf(url, destPath) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      Accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  if (!isPdfLikeResponse(res)) throw new Error("Response not recognized as PDF");
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  const fileStream = fs.createWriteStream(destPath);
  // Node 18 fetch body is a web stream
  await new Promise((resolve, reject) => {
    require("stream").Readable.fromWeb(res.body).pipe(fileStream);
    fileStream.on("finish", resolve);
    fileStream.on("error", reject);
  });
}

// NOTE: Previous capitalization enforcement (blocking or auto-fixing ALL CAPS words)
// has been removed to allow arbitrary acronyms without maintenance overhead.
function hasUnnecessaryCaps() {
  return false;
}

async function httpOk(
  url,
  timeoutMs = parseInt(process.env.LINK_CHECK_TIMEOUT_MS || "10000", 10)
) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(t);
    if (res.status === 405 || res.status === 403) {
      const controller2 = new AbortController();
      const t2 = setTimeout(() => controller2.abort(), timeoutMs);
      res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller2.signal,
      });
      clearTimeout(t2);
    }
    if (res.ok) return true;
    // Second pass ("check twice")
    await new Promise((r) => setTimeout(r, 300));
    const controller3 = new AbortController();
    const t3 = setTimeout(() => controller3.abort(), timeoutMs);
    res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller3.signal,
    });
    clearTimeout(t3);
    return res.ok;
  } catch (e) {
    return false;
  }
}

function indexBy(arr, key) {
  const m = new Map();
  for (const it of arr) m.set(it[key], it);
  return m;
}

function uniqueBy(arr, key) {
  const seen = new Set();
  return arr.filter((it) => {
    if (!it || typeof it !== "object") return false;
    const v = it[key];
    if (!v) return false;
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

function buildSystemPrompt(frJson) {
  const services = [
    "comptabilité (PME, indépendants, Swiss GAAP FER)",
    "fiscalité (personnes physiques et morales, TVA)",
    "corporate (conseil, gouvernance, PV, AG)",
    "paie (swissdec, LPP, LAA, AC)",
    "domiciliation",
    "directorship",
    "implémentation Odoo et intégrations",
    "outsourcing administratif et financier",
  ];

  // Dynamic date + freshness window (6 months) to enforce recency in generated suggestions.
  const today = new Date();
  const isoToday = today.toISOString().slice(0, 10);
  const sixMonthsAgo = new Date(today);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const isoSixMonthsAgo = sixMonthsAgo.toISOString().slice(0, 10);

  // Small helper sentence reused in instructions.
  const recencyInstruction = `Ne proposer que des contenus (PDF ou thèmes d'article) publiés ou mis à jour dans les 6 derniers mois (>= ${isoSixMonthsAgo}) et <= ${isoToday}. Si aucune ressource PDF réellement pertinente ET dans cette fenêtre n'est trouvée, mets newFile.source_url: null.`;

  return [
    "Tu es un assistant éditorial spécialisé en SEO pour la Suisse (Genève, Suisse romande).",
    "Objectif: proposer EXACTEMENT 1 nouveau fichier téléchargeable (Files) et 1 nouvel article (Articles) en français, pertinents pour des prospects de nos services.",
    "Un outil de recherche web est disponible, UTILISE-LE pour vérifier l'existence réelle des PDFs et des références avant de décider des URLs. Ne renvoie JAMAIS d'URL inventée ou spéculative.",
    `Date actuelle: ${isoToday}.`,
    recencyInstruction,
    "Privilégier les sujets fiscalité/TVA/paie/entreprise ayant une utilité immédiate ou impact Q3–Q4 2025 et préparation 2026, tant qu'ils respectent la contrainte de fraîcheur.",
    "Si aucune ressource PDF existante pertinente n'est trouvée, mets newFile.source_url à null et indique un filename plausible (nous l'ajouterons plus tard).",
    "Contraintes de qualité et SEO (IMPÉRATIVES):",
    "- Ne pas modifier, renommer ni supprimer les entrées existantes. Ajouter seulement 2 nouvelles entrées (1 File, 1 Article).",
    "- Éviter les répétitions de sujets déjà couverts. Vérifier les titrages et slugs pour éviter les doublons.",
    "- Les articles doivent être concis, utiles et concrets, attirer des prospects grace aux mots clés du texte, et faire entre 1500 et 3000 mots.",
    "- Style: pas de capitales superflues (seulement initiale, acronymes, noms propres).",
    "- Focus géographique: Genève d’abord, Suisse romande ensuite mais de manière accessoire, Suisse générale enfin, puis sujets internationaux (fiscalité en particulier) exceptionnellement.",
    "- Inclure des mots‑clés Google Trends récents et/ou actualités pertinentes en rapport direct avec nos services.",
    "- Tous les liens DOIVENT être pertinents et répondre HTTP 200 (pas de 404). Vérifie deux fois.",
    "- Les dates des contenus existants doivent rester inchangées. Pour les nouvelles entrées, utilise la date du jour ISO (YYYY-MM-DD).",
    "Services à promouvoir (intègres ces informations dans les choix des sujets): " +
      services.join(", ") +
      ".",
    "Format de sortie STRICT (application/json):",
    "{",
    '  "newFile": {',
    '    "filename": "<nom-de-fichier.pdf>",',
    '    "title": "<titre FR>",',
    '    "description": "<description FR>",',
    '    "date": "YYYY-MM-DD",',
    '    "source_url": "https://...pdf"',
    "  },",
    '  "newArticle": {',
    '    "slug": "<slug-nouveau-unique>",',
    '    "title": "<titre FR>",',
    '    "description": "<description FR>",',
    '    "content": "<contenu FR concis, utile, concret>",',
    '    "author": "Ark Fiduciaire",',
    '    "date": "YYYY-MM-DD",',
    '    "references": [ { "labelKey": "<labelKey>", "url": "https://..." } ]',
    "  },",
    '  "newLabels": {',
    '    "optionalLabelKey1": "Texte FR lisible (si de nouveaux labelKey sont introduits)"',
    "  }",
    "}",
    "",
    "Rappels importants:",
    "- filename doit finir par .pdf et pointer vers une ressource PDF réelle.",
    "- Si tu n'es PAS certain à 100% qu'un PDF est réellement accessible, mets source_url: null.",
    "- slug doit être unique (pas déjà présent).",
    "- references[].url doivent être officiels/sérieux (AFC, ch.ch, cantons, fedlex, odoo doc, etc.).",
    "- Vérifie deux fois qu’aucun lien n’est 404 et qu’il est pertinent.",
    "- Les labels keys doivent contenir 2-3 mots, sans répétition, majuscule en début de phrase et en texte normal avec espaces, non en camelCase.",
  ].join("\n");
}

function buildTranslatePrompt(newFile, newArticle) {
  return [
    "Tu es un traducteur professionnel. Traduis en conservant slugs, filenames, URLs et structures.",
    "Ne mets pas de capitales superflues (juste première lettre, acronymes, noms propres).",
    "Ne modifie aucun contenu existant. Fournis UNIQUEMENT les versions traduites pour ces deux nouvelles entrées et les labels.",
    "Format de sortie STRICT (application/json):",
    "{",
    '  "en": { "File": {"title": "...", "description": "..."}, "Article": {"title": "...", "description": "...", "content": "..."}, "labels": {"labelKeyFR": "English label"} },',
    '  "de": { "File": {"title": "...", "description": "..."}, "Article": {"title": "...", "description": "...", "content": "..."}, "labels": {"labelKeyFR": "Deutsches Label"} },',
    '  "es": { "File": {"title": "...", "description": "..."}, "Article": {"title": "...", "description": "...", "content": "..."}, "labels": {"labelKeyFR": "Etiqueta ES"} },',
    '  "pt": { "File": {"title": "...", "description": "..."}, "Article": {"title": "...", "description": "...", "content": "..."}, "labels": {"labelKeyFR": "Etiqueta PT"} }',
    "}",
    "",
    "Entrées FR (source immuable):",
    JSON.stringify({ newFile, newArticle }, null, 2),
  ].join("\n");
}


function extractJsonFromText(raw) {
  if (!raw || typeof raw !== "string")
    throw new Error("Empty Azure Agent response");
  // Direct parse first
  try {
    return JSON.parse(raw);
  } catch {}
  // Look for fenced code blocks ```json ... ```
  const fenceMatch = raw.match(/```(?:json)?\n([\s\S]*?)```/i);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    try {
      return JSON.parse(inner);
    } catch {}
  }
  // Attempt to find the first top-level JSON object by brace balancing
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
          } catch {}
        }
      }
    }
  }
  throw new Error("Failed to extract JSON from Azure Agent output");
}

async function azureAgentJson(prompt, { agentId = AZURE_AGENT_ID } = {}) {
  if (!AZURE_AGENT_ENDPOINT) throw new Error("Missing AZURE_AGENT_ENDPOINT");
  if (!agentId) throw new Error("Missing AZURE_AGENT_ID");
  const { AIProjectClient } = require("@azure/ai-projects");
  const { DefaultAzureCredential } = require("@azure/identity");
  const credential = new DefaultAzureCredential();
  const client = new AIProjectClient(AZURE_AGENT_ENDPOINT, credential);
  const dbg = !!process.env.DEBUG_AGENT;
  const agentMeta = await client.agents.getAgent(agentId); // existence check
  if (dbg) {
    console.log(`[agent] Using agentId=${agentId} name=${agentMeta.name || ''}`);
  }
  const thread = await client.agents.threads.create();
  if (dbg) console.log(`[agent] Created thread ${thread.id}`);
  await client.agents.messages.create(thread.id, "user", prompt);
  if (dbg) console.log(`[agent] Posted user message (${prompt.length} chars)`);
  let run = await client.agents.runs.create(thread.id, agentId);
  if (dbg) console.log(`[agent] Run created id=${run.id} status=${run.status}`);
  const started = Date.now();
  const timeoutMs = parseInt(process.env.AZURE_AGENT_RUN_TIMEOUT_MS || "120000", 10);
  while (["queued", "in_progress", "cancelling"].includes(run.status)) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`Azure Agent run timeout after ${timeoutMs} ms (status=${run.status})`);
    }
    await new Promise(r => setTimeout(r, 1500));
    run = await client.agents.runs.get(thread.id, run.id);
    if (dbg) console.log(`[agent] Run poll status=${run.status}`);
  }
  if (run.status === "failed") {
    throw new Error("Azure Agent run failed: " + (run.lastError?.message || JSON.stringify(run.lastError)));
  }
  if (dbg) console.log(`[agent] Run completed status=${run.status} elapsedMs=${Date.now()-started}`);
  const messages = await client.agents.messages.list(thread.id, { order: "asc" });
  let lastAssistantText = "";
  for await (const m of messages) {
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    for (const c of m.content) {
      if (c.type === "text" && c.text && typeof c.text.value === "string") {
        lastAssistantText = c.text.value;
      }
    }
  }
  if (!lastAssistantText) throw new Error("Azure Agent returned no assistant text content");
  // Optional: attempt to log step count (if future SDK exposes). Placeholder for future enhancement.
  return extractJsonFromText(lastAssistantText);
}

function validateNewFileArticle(fr, nf, na) {
  if (!nf || !na) throw new Error("Missing newFile or newArticle");
  const files = Array.isArray(fr.Files) ? fr.Files : [];
  const articles = Array.isArray(fr.Articles) ? fr.Articles : [];
  // Uniqueness
  const fileNames = new Set(files.map((f) => f.filename));
  if (fileNames.has(nf.filename))
    throw new Error(`filename already exists: ${nf.filename}`);
  const slugs = new Set(articles.map((a) => a.slug));
  if (slugs.has(na.slug)) throw new Error(`slug already exists: ${na.slug}`);
  // Required fields
  for (const k of ["filename", "title", "description", "date", "source_url"]) {
    if (!nf[k]) throw new Error(`newFile missing ${k}`);
  }
  for (const k of [
    "slug",
    "title",
    "description",
    "content",
    "author",
    "date",
    "references",
  ]) {
    if (!na[k]) throw new Error(`newArticle missing ${k}`);
  }
  // No capitalization restriction anymore.
  // References shape
  if (!Array.isArray(na.references) || na.references.length === 0) {
    throw new Error("newArticle requires at least one reference");
  }
}

function ensureAzureEnv() {
  const missing = [];
  if (!AZURE_AGENT_ENDPOINT) missing.push("AZURE_AGENT_ENDPOINT");
  if (!AZURE_AGENT_ID) missing.push("AZURE_AGENT_ID");
  if (missing.length) {
    throw new Error(
      `Missing required Azure env vars: ${missing.join(", ")}. See header comment.`
    );
  }
}

async function main() {
  ensureAzureEnv();
  const fr = loadJSON(FR_PATH);
  const basePrompt = buildSystemPrompt(fr);

  async function generateDraftWithRetries(frData, attempts = 3) {
    const existingFileNames = new Set((frData.Files || []).map(f => f.filename));
    const existingSlugs = new Set((frData.Articles || []).map(a => a.slug));
    let prompt = basePrompt;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      console.log(`Requesting Azure Agent for new FR entries... (attempt ${attempt}/${attempts})`);
      const draft = await azureAgentJson(prompt, { agentId: AZURE_AGENT_ID });
      try {
        validateNewFileArticle(frData, draft.newFile, draft.newArticle);
        return draft;
      } catch (e) {
        const msg = String(e.message || e);
        if (/filename already exists|slug already exists/i.test(msg) && attempt < attempts) {
          console.warn(`Duplicate detected (${msg}). Regenerating with explicit exclusion list...`);
          // Augment prompt with explicit exclusions and a requirement to pick something else.
            prompt = basePrompt + "\nIMPORTANT: N'utilise aucun des filenames suivants: " + Array.from(existingFileNames).join(", ") +
            "\nIMPORTANT: N'utilise aucun des slugs suivants: " + Array.from(existingSlugs).join(", ") +
            "\nSi le PDF le plus pertinent est déjà présent, cherche un AUTRE PDF réel distinct (ou mets source_url:null).";
          continue;
        }
        throw e;
      }
    }
    throw new Error(`Failed to generate unique draft after ${attempts} attempts.`);
  }

  const draft = await generateDraftWithRetries(fr, 4);
  let newFile = draft.newFile;
  const newArticle = draft.newArticle;
  const newLabels = draft.newLabels || {};

  // Validate article references (file reachability handled separately with retries)
  console.log("Validating reference URLs...");
  async function unreachableReferences(refs) {
    const bad = [];
    for (const ref of refs) {
      if (!ref || !ref.url) continue;
      const ok = await httpOk(ref.url);
      if (!ok) bad.push(ref);
    }
    return bad;
  }
  let badRefs = await unreachableReferences(newArticle.references);
  const refMax = parseInt(process.env.AI_REF_RETRIES || '2', 10);
  let refAttempt = 0;
  while (badRefs.length && refAttempt < refMax) {
    refAttempt++;
    console.warn(`Detected ${badRefs.length} unreachable reference(s). Regenerating references (attempt ${refAttempt}/${refMax})...`);
    const regenRefPrompt = [
      `Les références suivantes sont inaccessibles:`,
      ...badRefs.map(r => `- ${r.url}`),
      `Ne propose plus ces URLs ou variantes proches.`,
      `Fournis UNIQUEMENT un JSON {"references": [ { "labelKey": "...", "url": "https://..." } ]} avec des sources officielles vivantes (AFC, ch.ch, fedlex.admin.ch, admin.ch, ge.ch, odoo.com/docs).`,
      `N'inclus pas d'autre clé. Conserve le thème de l'article (slug: ${newArticle.slug}).`
    ].join('\n');
    try {
      const regen = await azureAgentJson(regenRefPrompt, { agentId: AZURE_AGENT_ID });
      if (regen && Array.isArray(regen.references) && regen.references.length) {
        newArticle.references = regen.references;
        badRefs = await unreachableReferences(newArticle.references);
      } else {
        console.warn('Réponse de régénération des références invalide.');
        break;
      }
    } catch (e) {
      console.warn(`Erreur régénération références: ${e.message}`);
      break;
    }
  }
  if (badRefs.length) {
    if (process.env.FAIL_ON_BAD_REFERENCE) {
      throw new Error(`Références encore inaccessibles après retries: ${badRefs.map(r=>r.url).join(', ')}`);
    }
    console.warn(`Suppression des références inaccessibles (${badRefs.length}).`);
    const badSet = new Set(badRefs.map(r => r.url));
    newArticle.references = newArticle.references.filter(r => !badSet.has(r.url));
    if (!newArticle.references.length) {
      console.warn('Toutes les références ont été supprimées => article sera conservé sans références (ajoutera peut-être moins de valeur SEO).');
    }
  }

  async function urlReachableTwice(u) {
    if (!u) return false;
    const once = await httpOk(u);
    if (!once) return false;
    await new Promise(r => setTimeout(r, 500));
    return await httpOk(u);
  }

  let fileReachable = await urlReachableTwice(newFile.source_url);
  const maxRetries = parseInt(process.env.AI_FILE_RETRIES || '2', 10);
  for (let attempt = 1; attempt <= maxRetries && !fileReachable; attempt++) {
    console.warn(`newFile.source_url not reachable. Regenerating file only (attempt ${attempt}/${maxRetries})...`);
    const regenPrompt = [
      `Le fichier proposé a une URL introuvable (${newFile.source_url}).`,
      `Propose UNIQUEMENT un JSON {"newFile": {...}} avec une source_url qui existe réellement (PDF accessible).`,
      `Conserve un thème cohérent avec l'article (slug: ${newArticle.slug}).`,
      `Ne modifie pas l'article existant.`,
      `Respecte le format exact.`
    ].join('\n');
    try {
      const regen = await azureAgentJson(regenPrompt, { agentId: AZURE_AGENT_ID });
      if (regen && regen.newFile) {
        newFile = regen.newFile;
        try {
          validateNewFileArticle(fr, newFile, newArticle);
          fileReachable = await urlReachableTwice(newFile.source_url);
        } catch (ve) {
          console.warn(`Validation échec pour le fichier régénéré: ${ve.message}`);
        }
      } else {
        console.warn("Regeneration did not return newFile");
      }
    } catch (e) {
      console.warn(`Erreur pendant la régénération du fichier: ${e.message}`);
    }
  }

  if (!fileReachable) {
    console.warn("Fichier toujours introuvable après les tentatives. Il sera ignoré (article seulement). Set FAIL_ON_MISSING_FILE=1 pour forcer l'échec.");
    if (process.env.FAIL_ON_MISSING_FILE) {
      throw new Error("Abandon: fichier introuvable après retries");
    }
    newFile = null;
  }

  // Attempt immediate PDF download for valid newFile before modifying FR (unless dry-run or skipped)
  let downloadedPdfPath = null;
  if (newFile) {
    const downloadsDir = path.join(process.cwd(), "public", "assets", "downloads");
    const dest = path.join(downloadsDir, newFile.filename);
    try {
      if (DRY || !APPLY) {
        console.log(`[dry-run] Would download PDF to ${path.relative(process.cwd(), dest)} from ${newFile.source_url}`);
      } else {
        if (fs.existsSync(dest)) {
          console.log(`PDF already exists locally: ${path.relative(process.cwd(), dest)}`);
        } else {
          console.log(`Downloading PDF ${newFile.filename} ...`);
          await downloadPdf(newFile.source_url, dest);
          console.log(`Saved PDF -> ${path.relative(process.cwd(), dest)}`);
        }
      }
      downloadedPdfPath = dest;
    } catch (e) {
      console.warn(`PDF download failed (${e.message}).`);
      if (process.env.REQUIRE_PDF_DOWNLOAD) {
        throw new Error("Required PDF download failed; aborting.");
      }
    }
  }

  // Enforce today date if missing or invalid
  const today = isoDateToday();
  newFile.date = /^\d{4}-\d{2}-\d{2}$/.test(newFile.date)
  if (newFile) {
    newFile.date = /^\d{4}-\d{2}-\d{2}$/.test(newFile.date)
      ? newFile.date
      : today;
  }
  newArticle.date = /^\d{4}-\d{2}-\d{2}$/.test(newArticle.date)
    ? newArticle.date
    : today;

  if (DRY || !APPLY) {
    console.log("[dry-run] Would append to FR:", {
      newFile: newFile || '(skipped)',
      newArticle,
      newLabels,
    });
  } else {
    // Append to FR
    const updated = { ...fr };
    updated.Files = Array.isArray(updated.Files) ? updated.Files.slice() : [];
    updated.Articles = Array.isArray(updated.Articles)
      ? updated.Articles.slice()
      : [];
  if (newFile) updated.Files.push(newFile);
    updated.Articles.push({ ...newArticle, content: newArticle.content });
    // Merge new label keys, if any
    for (const [k, v] of Object.entries(newLabels)) {
      if (!(k in updated)) updated[k] = v;
    }
    saveJSON(FR_PATH, updated);
    console.log(
      `FR updated with ${newFile ? '1 File + ' : ''}1 Article.`
    );
  }

  // Translation via Azure Agent (second call)
  console.log("Requesting Azure Agent for translations (EN/DE/ES/PT)...");
  const trPrompt = buildTranslatePrompt(
    newFile || { filename: '', title: '', description: '', date: newArticle.date, source_url: '' },
    newArticle
  );
  const translations = await azureAgentJson(trPrompt, {
    agentId: AZURE_TRANSLATE_AGENT_ID,
  });

  // Write to each locale
  for (const loc of LOCALES) {
    const targetPath = path.join(TRANSLATIONS, loc, "ressources.json");
    if (!fs.existsSync(targetPath)) {
      console.warn(`[WARN] Missing ${loc}/ressources.json; skipping.`);
      continue;
    }
    const data = loadJSON(targetPath);
    const seenFiles = new Set((data.Files || []).map((f) => f.filename));
    const seenSlugs = new Set((data.Articles || []).map((a) => a.slug));
    const payload = translations[loc];
    if (!payload) {
      console.warn(`[WARN] Missing translations for ${loc}`);
      continue;
    }
    const fTr = payload.File || {};
    const aTr = payload.Article || {};
    const labelsTr = payload.labels || {};

    const fileToAdd = newFile
      ? {
          filename: newFile.filename,
          title: fTr.title || newFile.title,
          description: fTr.description || newFile.description,
          date: newFile.date,
          source_url: newFile.source_url,
        }
      : null;
    const articleToAdd = {
      slug: newArticle.slug,
      title: aTr.title || newArticle.title,
      description: aTr.description || newArticle.description,
      content: aTr.content || newArticle.content,
      author: newArticle.author,
      date: newArticle.date,
      references: newArticle.references,
    };

    // Capitalization heuristic
    if (fileToAdd) {
      if (
        hasUnnecessaryCaps(fileToAdd.title) ||
        hasUnnecessaryCaps(fileToAdd.description)
      ) {
        console.warn(`[WARN] Caps heuristic flagged in ${loc} file text.`);
      }
    }
    if (
      hasUnnecessaryCaps(articleToAdd.title) ||
      hasUnnecessaryCaps(articleToAdd.description)
    ) {
      console.warn(`[WARN] Caps heuristic flagged in ${loc} article text.`);
    }

    if (DRY || !APPLY) {
      console.log(`[dry-run] Would append to ${loc}:`, {
        fileToAdd: fileToAdd || '(no file this run)',
        articleToAdd,
        labelsTr,
      });
      continue;
    }
    data.Files = Array.isArray(data.Files) ? data.Files : [];
    data.Articles = Array.isArray(data.Articles) ? data.Articles : [];
    if (fileToAdd && !seenFiles.has(fileToAdd.filename)) data.Files.push(fileToAdd);
    if (!seenSlugs.has(articleToAdd.slug)) data.Articles.push(articleToAdd);
    for (const [k, v] of Object.entries(labelsTr)) {
      if (!(k in data)) data[k] = v;
    }
    saveJSON(targetPath, data);
    console.log(`${loc} updated.`);
  }

  if (!SKIP_DL && APPLY) {
    // Try to download the new PDF for FR to ensure local availability
    try {
      const cp = require("child_process");
      cp.execSync("node scripts/download-missing-pdfs.js --locale fr --force", {
        stdio: "inherit",
      });
    } catch (e) {
      console.warn("PDF download step failed or not available:", e.message);
    }
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
