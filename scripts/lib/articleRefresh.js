"use strict";

/**
 * Shared editorial rules + transactional "refresh an existing article" logic.
 *
 * Pure (no network, no module-level side effects): every model call is injected
 * through `deps`, so the whole flow is testable with mocks.
 */

const fs = require("fs");
const path = require("path");

const SERVICE_PATHS = [
  "/services/accounting",
  "/services/corporate",
  "/services/domiciliation",
  "/services/family-office",
  "/services/immigration",
  "/services/incorporation",
  "/services/mergers-acquisitions",
  "/services/odoo",
  "/services/outsourcing",
  "/services/payroll",
  "/services/taxes",
];

// Fields a refresh is allowed to regenerate. Everything else on the existing
// article (slug, date, category, image, author, authorUrl, reviewedBy,
// reviewedAt, unknown fields...) is preserved.
const GENERATED_FIELDS = ["title", "description", "content", "references", "tags"];
// Fields owned by the FR article and mirrored to locale entries when present.
const MIRRORED_FIELDS = [
  "date",
  "updated",
  "category",
  "tags",
  "author",
  "authorUrl",
  "image",
  "reviewedBy",
  "reviewedAt",
];
const TRANSLATED_FIELDS = ["title", "description", "content"];

/**
 * Editorial rules shared by every generation path (system prompt, two-step
 * draft, length recovery, retry, refresh). Topic drives structure; nothing is
 * mandatory beyond what the subject needs, and nothing may be invented.
 */
function buildStructureRules() {
  return [
    "- STRUCTURE DICTÉE PAR LE SUJET: autant de sections H2 que le sujet en demande (généralement 5 à 8), des H3 seulement si utile. Pas de plan imposé.",
    "- Un tableau ou une checklist uniquement s'il apporte une information que le texte n'exprime pas mieux. Pas de FAQ systématique: au plus 3 questions, seulement si des clients les posent réellement.",
    "- Ne rallonge jamais par remplissage (sections génériques, répétitions, FAQ ou tableaux ajoutés pour faire du volume).",
  ];
}

function buildNoFabricationRules() {
  return [
    "- AUCUNE INVENTION: pas d'anecdote, pas d'« observation de terrain », pas de formule du type « ce que nous voyons en mandat », pas d'étude de cas chiffrée, pas de client ou d'entreprise type présentés comme réels.",
    "- Chiffres: uniquement s'ils sont sourcés (références fournies) ou s'il s'agit de seuils, taux ou délais légaux. Sans source, reste qualitatif.",
    "- Un exemple chiffré n'est admis que s'il est clairement présenté comme hypothétique (« Exemple fictif: … ») et sert à illustrer un calcul.",
  ];
}

function buildGenevaAnchorRule() {
  return "- ANCRAGE GENÈVE/SUISSE: nomme l'autorité compétente réelle (AFC-GE, OCIRT, registre du commerce de Genève, caisse AVS, AFC pour la TVA...), les délais et formulaires officiels. Si le sujet est fédéral, dis ce qui change à Genève.";
}

function buildOriginalityRule() {
  return "- ORIGINALITÉ: pas de synthèse générique de ce qu'on trouve déjà sur admin.ch; apporte un éclairage de professionnel sur l'ordre des démarches, les arbitrages et les points de vigilance, sans prétendre décrire des dossiers réels.";
}

function buildArkParagraphRule(servicePath) {
  const link = servicePath
    ? `[notre service](${servicePath})`
    : `[notre service](/services/…)`;
  const where = servicePath
    ? `la page ${servicePath}`
    : `la page de service la plus pertinente parmi: ${SERVICE_PATHS.join(", ")}`;
  return `- PARAGRAPHE ARK: un court paragraphe « Ce que nous faisons chez Ark » qui décrit seulement le service proposé sur ce sujet (périmètre, étapes de l'accompagnement), sans résultat promis ni cas client, suivi d'un lien interne relatif vers ${where} (ex. ${link}). C'est le seul lien autorisé dans le texte; aucune URL http/https.`;
}

function buildEditorialRules({ servicePath = "" } = {}) {
  return [
    ...buildStructureRules(),
    ...buildNoFabricationRules(),
    buildGenevaAnchorRule(),
    buildOriginalityRule(),
    buildArkParagraphRule(servicePath),
  ];
}

function toIsoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/** Sets `updated`, never touches `date`. Mutates and returns the article. */
function markUpdated(article, today) {
  if (!article || typeof article !== "object") return article;
  article.updated = toIsoDate(today);
  return article;
}

function buildRefreshResearchPrompt(article, { today, allowedDomainsPrompt = "" } = {}) {
  return [
    "Tu es un chercheur web pour Ark Fiduciaire (Genève).",
    `Date actuelle: ${toIsoDate(today)}.`,
    `Objectif: fournir 6 à 10 références vérifiables (HTTP 200, pas de login) pour mettre à jour l'article existant « ${article.title} » (slug: ${article.slug}). Le sujet ne change pas.`,
    "- Inclure au moins 2 sources officielles (admin.ch, fedlex.admin.ch, bsv.admin.ch, estv.admin.ch, seco.admin.ch, finma.ch, etc.).",
    "- Un domaine = un lien. Aucun site de cabinet concurrent. Aucune URL inventée.",
    allowedDomainsPrompt,
    'Retourne STRICTEMENT un JSON: { "references": [ { "labelKey": "Libellé FR", "url": "https://..." } ] }',
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRefreshPrompt(article, { today, servicePath = "", references } = {}) {
  const refs = Array.isArray(references)
    ? references
    : Array.isArray(article?.references)
      ? article.references
      : [];
  return [
    "Tu es un rédacteur senior pour Ark Fiduciaire (Genève).",
    "Tu mets à jour un article existant. Garde le slug et le sujet.",
    `Date du jour: ${toIsoDate(today)}.`,
    "Vérifie chaque fait, chiffre et date contre les références fournies; mets à jour pour la date du jour, remplace les mentions d'année dépassées (y compris dans le titre si pertinent), supprime le remplissage (FAQ générique, tableaux vides, passages inventés).",
    "Si un fait ne peut pas être vérifié avec les références, retire-le ou formule-le de manière prudente.",
    "",
    "RÈGLES ÉDITORIALES:",
    ...buildEditorialRules({ servicePath }),
    "- Ton direct et humain; pas de formules IA (« il est important de noter », « en effet », « de plus », « en conclusion »). Ne commence pas par une section « Introduction ».",
    "- Taux de TVA suisses depuis le 1er janvier 2024: 8,1 %, 2,6 %, 3,8 %. Ne cite jamais les anciens taux 7,7 %, 2,5 %, 3,7 %.",
    "- Aucune URL http/https dans le texte. Pour citer une source, écris (source: <labelKey>).",
    "- Titres: ## pour H2 et ### pour H3, sans préfixe « H2 »/« H3 ».",
    "",
    "Références disponibles (ne pas modifier):",
    JSON.stringify(refs, null, 2),
    "",
    "Article actuel (JSON):",
    JSON.stringify(
      {
        slug: article.slug,
        title: article.title,
        description: article.description,
        content: article.content,
        tags: article.tags,
      },
      null,
      2,
    ),
    "",
    "Retourne STRICTEMENT un JSON:",
    '{ "article": { "title": "...", "description": "...", "content": "<Markdown>", "tags": ["..."] }, "changeSummary": ["..."] }',
  ].join("\n");
}

function countWords(text) {
  if (typeof text !== "string") return 0;
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Merge generated fields into the existing FR article. Preserves every other
 * field (including unknown ones). Does NOT set `updated` (caller does that
 * once the whole refresh has succeeded).
 */
function mergeRefreshedArticle(existing, generated) {
  const merged = { ...existing };
  for (const field of GENERATED_FIELDS) {
    const value = generated?.[field];
    if (field === "references" || field === "tags") {
      if (Array.isArray(value) && value.length) merged[field] = value;
      continue;
    }
    if (typeof value === "string" && value.trim()) merged[field] = value;
  }
  return merged;
}

/** Build the localized entry from the existing one (if any) + translation. */
function buildLocalizedArticle(frArticle, existingLocal, translation, labels = {}) {
  const base = existingLocal ? { ...existingLocal } : { ...frArticle };
  for (const field of TRANSLATED_FIELDS) base[field] = translation[field];
  for (const field of MIRRORED_FIELDS) {
    if (frArticle[field] !== undefined) base[field] = frArticle[field];
  }
  base.slug = frArticle.slug;
  if (Array.isArray(frArticle.references)) {
    base.references = frArticle.references.map((ref) =>
      ref && ref.labelKey && typeof labels[ref.labelKey] === "string" && labels[ref.labelKey]
        ? { ...ref, labelKey: labels[ref.labelKey] }
        : ref,
    );
  }
  return base;
}

/**
 * Write several JSON files all-or-nothing: stage to temp files, then rename;
 * if anything fails, restore already-renamed files and remove temps.
 */
function writeJsonFilesAtomically(files) {
  const staged = [];
  try {
    for (const { path: target, data } of files) {
      const tmp = `${target}.refresh-${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
      staged.push({ target, tmp, original: fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null });
    }
  } catch (error) {
    for (const s of staged) safeUnlink(s.tmp);
    throw error;
  }
  const renamed = [];
  try {
    for (const s of staged) {
      fs.renameSync(s.tmp, s.target);
      renamed.push(s);
    }
  } catch (error) {
    for (const s of renamed) {
      if (s.original !== null) fs.writeFileSync(s.target, s.original, "utf8");
    }
    for (const s of staged) safeUnlink(s.tmp);
    throw error;
  }
}

function safeUnlink(file) {
  try {
    fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Refresh one or several FR articles + their EN/DE/ES/PT translations as one
 * transaction. Nothing is written unless EVERYTHING succeeded.
 *
 * deps (all async, injectable):
 *   research(article)                    -> references array (already validated/repaired by caller)
 *   draft(prompt, article)               -> { article:{title,description,content,tags}, changeSummary }
 *   postProcess(article, frData)         -> mutates article (links, headings, VAT...) ; may throw
 *   translate(article, labels)           -> { en:{Article:{title,description,content},labels}, de:..., es:..., pt:... }
 */
async function refreshArticles({
  slugs,
  today,
  translationsDir,
  locales = ["en", "de", "es", "pt"],
  servicePaths = {},
  minWords = 700,
  maxWords = 0,
  apply = false,
  deps,
  log = console.log,
}) {
  if (!Array.isArray(slugs) || !slugs.length) throw new Error("refresh: no slug given");
  const frPath = path.join(translationsDir, "fr", "ressources.json");
  const frData = loadJson(frPath);
  const localeData = {};
  for (const locale of locales) {
    const p = path.join(translationsDir, locale, "ressources.json");
    if (!fs.existsSync(p)) throw new Error(`refresh: missing ${locale}/ressources.json`);
    localeData[locale] = loadJson(p);
  }
  frData.Articles = Array.isArray(frData.Articles) ? frData.Articles : [];
  const results = [];

  for (const slug of slugs) {
    const idx = frData.Articles.findIndex((a) => a.slug === slug);
    if (idx < 0) throw new Error(`refresh: FR article not found: ${slug}`);
    const existing = frData.Articles[idx];
    const servicePath = servicePaths[slug] || "";
    log(`[refresh] ${slug}: research`);
    const references = await deps.research(existing);
    if (!Array.isArray(references) || !references.length) {
      throw new Error(`refresh: ${slug}: no usable references`);
    }
    log(`[refresh] ${slug}: draft`);
    const prompt = buildRefreshPrompt(existing, { today, servicePath, references });
    const drafted = await deps.draft(prompt, existing);
    const generated = drafted?.article;
    if (!generated || typeof generated.content !== "string") {
      throw new Error(`refresh: ${slug}: draft payload missing article.content`);
    }
    const candidate = mergeRefreshedArticle(existing, { ...generated, references });
    if (deps.postProcess) await deps.postProcess(candidate, frData);
    const words = countWords(candidate.content);
    if (words < minWords) {
      throw new Error(`refresh: ${slug}: refreshed article too short (${words} < ${minWords} words)`);
    }
    if (maxWords > 0 && words > maxWords) {
      throw new Error(`refresh: ${slug}: refreshed article too long (${words} > ${maxWords} words)`);
    }
    if (candidate.slug !== existing.slug) throw new Error(`refresh: ${slug}: slug changed`);

    const labels = {};
    for (const ref of candidate.references || []) if (ref?.labelKey) labels[ref.labelKey] = ref.labelKey;
    log(`[refresh] ${slug}: translate`);
    const translations = await deps.translate(candidate, labels);
    for (const locale of locales) {
      const t = translations?.[locale]?.Article;
      if (!t || !t.title || !t.description || !t.content) {
        throw new Error(`refresh: ${slug}: incomplete ${locale} translation`);
      }
      if (t.content === candidate.content) {
        throw new Error(`refresh: ${slug}: ${locale} translation identical to FR`);
      }
    }

    // Everything for this slug validated: finalize in memory.
    markUpdated(candidate, today);
    frData.Articles[idx] = candidate;
    for (const locale of locales) {
      const data = localeData[locale];
      data.Articles = Array.isArray(data.Articles) ? data.Articles : [];
      const li = data.Articles.findIndex((a) => a.slug === slug);
      const entry = buildLocalizedArticle(
        candidate,
        li >= 0 ? data.Articles[li] : null,
        translations[locale].Article,
        translations[locale].labels || {},
      );
      if (li >= 0) data.Articles[li] = entry;
      else data.Articles.push(entry);
    }
    results.push({
      slug,
      wordsBefore: countWords(existing.content),
      wordsAfter: words,
      changeSummary: Array.isArray(drafted.changeSummary) ? drafted.changeSummary : [],
    });
  }

  if (apply) {
    const files = [{ path: frPath, data: frData }];
    for (const locale of locales) {
      files.push({ path: path.join(translationsDir, locale, "ressources.json"), data: localeData[locale] });
    }
    writeJsonFilesAtomically(files);
    log(`[refresh] wrote ${files.length} files`);
  } else {
    log("[refresh] dry-run: nothing written (use --apply)");
  }
  return results;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function slugifyName(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Extract member slugs from the text of src/lib/team.ts (name: "...") entries. */
function readTeamSlugs(teamTsText) {
  const slugs = new Set();
  for (const m of String(teamTsText).matchAll(/^\s*name:\s*"([^"]+)"/gm)) {
    slugs.add(slugifyName(m[1]));
  }
  return slugs;
}

/**
 * Metadata rules: updated >= date; reviewedBy must be a team slug and needs a
 * reviewedAt >= (updated ?? date). Returns a list of error strings.
 */
function validateArticleMetadata(articles, teamSlugs) {
  const errors = [];
  for (const a of articles) {
    const id = a.slug || "(no slug)";
    if (a.updated !== undefined) {
      if (!ISO_DATE_RE.test(String(a.updated))) errors.push(`${id}: updated is not YYYY-MM-DD`);
      else if (a.date && String(a.updated) < String(a.date)) {
        errors.push(`${id}: updated (${a.updated}) is before date (${a.date})`);
      }
    }
    if (a.reviewedAt !== undefined && !a.reviewedBy) {
      errors.push(`${id}: reviewedAt set without reviewedBy`);
    }
    if (a.reviewedBy) {
      if (!teamSlugs.has(a.reviewedBy)) {
        errors.push(`${id}: reviewedBy "${a.reviewedBy}" does not match a team slug`);
      }
      if (!a.reviewedAt || !ISO_DATE_RE.test(String(a.reviewedAt))) {
        errors.push(`${id}: reviewedBy requires reviewedAt (YYYY-MM-DD)`);
      } else {
        const floor = String(a.updated || a.date || "");
        if (floor && String(a.reviewedAt) < floor) {
          errors.push(`${id}: reviewedAt (${a.reviewedAt}) is before ${a.updated ? "updated" : "date"} (${floor})`);
        }
      }
    }
  }
  return errors;
}

module.exports = {
  slugifyName,
  readTeamSlugs,
  validateArticleMetadata,
  SERVICE_PATHS,
  GENERATED_FIELDS,
  MIRRORED_FIELDS,
  buildStructureRules,
  buildNoFabricationRules,
  buildGenevaAnchorRule,
  buildOriginalityRule,
  buildArkParagraphRule,
  buildEditorialRules,
  markUpdated,
  buildRefreshResearchPrompt,
  buildRefreshPrompt,
  mergeRefreshedArticle,
  buildLocalizedArticle,
  writeJsonFilesAtomically,
  refreshArticles,
  countWords,
};
