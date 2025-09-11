'use strict';

/**
 * Daily AI-driven ressources update
 * - Calls Gemini to propose exactly 1 new File and 1 new Article (FR, canonical)
 * - Validates output: schema, uniqueness (no duplicates), links (HTTP 2xx) and capitalization rules
 * - Appends to src/translations/fr/ressources.json without touching existing entries
 * - Second Gemini call translates ONLY the two new entries into EN/DE/ES/PT, including any new label keys
 * - Appends translated entries to each locale's ressources.json and merges new label keys
 * - Optionally downloads the new PDF (see download-missing-pdfs.js)
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/ai-ressources-update.js [--apply] [--dry-run] [--skip-download]
 */

const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const DRY = args.has('--dry-run');
const SKIP_DL = args.has('--skip-download');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('Missing GEMINI_API_KEY environment variable.');
  process.exit(2);
}

const ROOT = process.cwd();
const TRANSLATIONS = path.join(ROOT, 'src', 'translations');
const FR_PATH = path.join(TRANSLATIONS, 'fr', 'ressources.json');
const LOCALES = ['en', 'de', 'es', 'pt'];

if (!fs.existsSync(FR_PATH)) {
  console.error(`Canonical FR file not found: ${FR_PATH}`);
  process.exit(2);
}

function loadJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    throw new Error(`Failed to parse ${p}: ${e.message}`);
  }
}

function saveJSON(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function isoDateToday() {
  return new Date().toISOString().slice(0, 10);
}

function hasUnnecessaryCaps(str) {
  if (!str || typeof str !== 'string') return false;
  // Allow acronyms (2+ upper), sentence starts, proper nouns are hard; basic heuristic:
  // Flag words with all caps of length >= 3 (excluding known acronyms)
  const allowed = new Set(['TVA', 'AFC', 'AVS', 'LAA', 'AC', 'LPP', 'SA', 'Sàrl', 'SA', 'Odoo', 'CO', 'RPC', 'FER', 'PDF', 'ETIAS']);
  return str.split(/\s+/).some(w => /[A-Z]{3,}/.test(w) && !allowed.has(w));
}

async function httpOk(url, timeoutMs = parseInt(process.env.LINK_CHECK_TIMEOUT_MS || '10000', 10)) {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
    clearTimeout(t);
    if (res.status === 405 || res.status === 403) {
      const controller2 = new AbortController();
      const t2 = setTimeout(() => controller2.abort(), timeoutMs);
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller2.signal });
      clearTimeout(t2);
    }
    if (res.ok) return true;
    // Second pass ("check twice")
    await new Promise(r => setTimeout(r, 300));
    const controller3 = new AbortController();
    const t3 = setTimeout(() => controller3.abort(), timeoutMs);
    res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller3.signal });
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
  return arr.filter(it => {
    if (!it || typeof it !== 'object') return false;
    const v = it[key];
    if (!v) return false;
    if (seen.has(v)) return false;
    seen.add(v);
    return true;
  });
}

function buildSystemPrompt(frJson) {
  const services = [
    'comptabilité (PME, indépendants, Swiss GAAP FER)',
    'fiscalité (personnes physiques et morales, TVA)',
    'corporate (conseil, gouvernance, PV, AG)',
    'paie (swissdec, LPP, LAA, AC)',
    'domiciliation',
    'directorship',
    'implémentation Odoo et intégrations',
    'outsourcing administratif et financier'
  ];

  return [
    'Tu es un assistant éditorial spécialisé en SEO pour la Suisse (Genève, Suisse romande).',
    'Objectif: proposer EXACTEMENT 1 nouveau fichier téléchargeable (Files) et 1 nouvel article (Articles) en français, pertinents pour des prospects de nos services.',
    'Contraintes de qualité et SEO (IMPÉRATIVES):',
    '- Ne pas modifier, renommer ni supprimer les entrées existantes. Ajouter seulement 2 nouvelles entrées (1 File, 1 Article).',
    '- Éviter les répétitions de sujets déjà couverts. Vérifier les titrages et slugs pour éviter les doublons.',
    '- Style: pas de capitales superflues (seulement initiale, acronymes, noms propres).',
    '- Focus géographique: Genève d’abord, Suisse romande ensuite, Suisse générale enfin.',
    '- Inclure des mots‑clés Google Trends et/ou actualités pertinentes en rapport direct avec nos services.',
    '- Tous les liens DOIVENT être pertinents et répondre HTTP 200 (pas de 404). Vérifie deux fois.',
    '- Les dates des contenus existants doivent rester inchangées. Pour les nouvelles entrées, utilise la date du jour ISO (YYYY-MM-DD).',
    'Services à promouvoir (intègres ces informations dans les choix des sujets): ' + services.join(', ') + '.',
    'Format de sortie STRICT (application/json):',
    '{',
    '  "newFile": {',
    '    "filename": "<nom-de-fichier.pdf>",',
    '    "title": "<titre FR>",',
    '    "description": "<description FR>",',
    '    "date": "YYYY-MM-DD",',
    '    "source_url": "https://...pdf"',
    '  },',
    '  "newArticle": {',
    '    "slug": "<slug-nouveau-unique>",',
    '    "title": "<titre FR>",',
    '    "description": "<description FR>",',
    '    "content": "<contenu FR concis, utile, concret>",',
    '    "author": "Ark Fiduciaire",',
    '    "date": "YYYY-MM-DD",',
    '    "references": [ { "labelKey": "<labelKey>", "url": "https://..." } ]',
    '  },',
    '  "newLabels": {',
    '    "optionalLabelKey1": "Texte FR lisible (si de nouveaux labelKey sont introduits)"',
    '  }',
    '}',
    '',
    'Rappels importants:',
    '- filename doit finir par .pdf et pointer vers une ressource PDF réelle.',
    '- slug doit être unique (pas déjà présent).',
    '- references[].url doivent être officiels/sérieux (AFC, ch.ch, cantons, fedlex, odoo doc, etc.).',
    '- Vérifie deux fois qu’aucun lien n’est 404 et qu’il est pertinent.',
  ].join('\n');
}

function buildTranslatePrompt(newFile, newArticle) {
  return [
    'Tu es un traducteur professionnel. Traduis en conservant slugs, filenames, URLs et structures.',
    'Ne mets pas de capitales superflues (juste première lettre, acronymes, noms propres).',
    'Ne modifie aucun contenu existant. Fournis UNIQUEMENT les versions traduites pour ces deux nouvelles entrées et les labels.',
    'Format de sortie STRICT (application/json):',
    '{',
    '  "en": { "File": {"title": "...", "description": "..."}, "Article": {"title": "...", "description": "...", "content": "..."}, "labels": {"labelKeyFR": "English label"} },',
    '  "de": { "File": {"title": "...", "description": "..."}, "Article": {"title": "...", "description": "...", "content": "..."}, "labels": {"labelKeyFR": "Deutsches Label"} },',
    '  "es": { "File": {"title": "...", "description": "..."}, "Article": {"title": "...", "description": "...", "content": "..."}, "labels": {"labelKeyFR": "Etiqueta ES"} },',
    '  "pt": { "File": {"title": "...", "description": "..."}, "Article": {"title": "...", "description": "...", "content": "..."}, "labels": {"labelKeyFR": "Etiqueta PT"} }',
    '}',
    '',
    'Entrées FR (source immuable):',
    JSON.stringify({ newFile, newArticle }, null, 2)
  ].join('\n');
}

async function geminiJson(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${text}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content.');
  let json;
  try { json = JSON.parse(text); } catch (e) {
    throw new Error('Gemini did not return valid JSON: ' + e.message);
  }
  return json;
}

function validateNewFileArticle(fr, nf, na) {
  if (!nf || !na) throw new Error('Missing newFile or newArticle');
  const files = Array.isArray(fr.Files) ? fr.Files : [];
  const articles = Array.isArray(fr.Articles) ? fr.Articles : [];
  // Uniqueness
  const fileNames = new Set(files.map(f => f.filename));
  if (fileNames.has(nf.filename)) throw new Error(`filename already exists: ${nf.filename}`);
  const slugs = new Set(articles.map(a => a.slug));
  if (slugs.has(na.slug)) throw new Error(`slug already exists: ${na.slug}`);
  // Required fields
  for (const k of ['filename','title','description','date','source_url']) {
    if (!nf[k]) throw new Error(`newFile missing ${k}`);
  }
  for (const k of ['slug','title','description','content','author','date','references']) {
    if (!na[k]) throw new Error(`newArticle missing ${k}`);
  }
  // Caps check (basic heuristic)
  if (hasUnnecessaryCaps(nf.title) || hasUnnecessaryCaps(nf.description)) {
    throw new Error('newFile has unnecessary caps');
  }
  if (hasUnnecessaryCaps(na.title) || hasUnnecessaryCaps(na.description)) {
    throw new Error('newArticle has unnecessary caps');
  }
  // References shape
  if (!Array.isArray(na.references) || na.references.length === 0) {
    throw new Error('newArticle requires at least one reference');
  }
}

async function main() {
  const fr = loadJSON(FR_PATH);
  const systemPrompt = buildSystemPrompt(fr);
  const MODEL_DRAFT = process.env.GEMINI_MODEL_DRAFT || process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  const MODEL_TRANSLATE = process.env.GEMINI_MODEL_TRANSLATE || process.env.GEMINI_MODEL || MODEL_DRAFT;
  console.log(`Requesting Gemini (${MODEL_DRAFT}) for new FR entries...`);
  const draft = await geminiJson(MODEL_DRAFT, systemPrompt);
  const newFile = draft.newFile;
  const newArticle = draft.newArticle;
  const newLabels = draft.newLabels || {};
  validateNewFileArticle(fr, newFile, newArticle);

  // Validate links twice
  console.log('Validating URLs (check twice)...');
  const fileOk = await httpOk(newFile.source_url);
  if (!fileOk) throw new Error(`newFile.source_url not reachable: ${newFile.source_url}`);
  for (const ref of newArticle.references) {
    if (!ref || !ref.url) continue;
    const ok = await httpOk(ref.url);
    if (!ok) throw new Error(`reference URL not reachable: ${ref.url}`);
  }

  // Enforce today date if missing or invalid
  const today = isoDateToday();
  newFile.date = /^\d{4}-\d{2}-\d{2}$/.test(newFile.date) ? newFile.date : today;
  newArticle.date = /^\d{4}-\d{2}-\d{2}$/.test(newArticle.date) ? newArticle.date : today;

  if (DRY || !APPLY) {
    console.log('[dry-run] Would append to FR:', { newFile, newArticle, newLabels });
  } else {
    // Append to FR
    const updated = { ...fr };
    updated.Files = Array.isArray(updated.Files) ? updated.Files.slice() : [];
    updated.Articles = Array.isArray(updated.Articles) ? updated.Articles.slice() : [];
    updated.Files.push(newFile);
    updated.Articles.push({ ...newArticle, content: newArticle.content });
    // Merge new label keys, if any
    for (const [k, v] of Object.entries(newLabels)) {
      if (!(k in updated)) updated[k] = v;
    }
    saveJSON(FR_PATH, updated);
    console.log('FR updated with 1 File + 1 Article.');
  }

  // Ask Gemini to translate the new entries
  console.log(`Requesting Gemini (${MODEL_TRANSLATE}) for translations (EN/DE/ES/PT)...`);
  const trPrompt = buildTranslatePrompt(newFile, newArticle);
  const translations = await geminiJson(MODEL_TRANSLATE, trPrompt);

  // Write to each locale
  for (const loc of LOCALES) {
    const targetPath = path.join(TRANSLATIONS, loc, 'ressources.json');
    if (!fs.existsSync(targetPath)) {
      console.warn(`[WARN] Missing ${loc}/ressources.json; skipping.`);
      continue;
    }
    const data = loadJSON(targetPath);
    const seenFiles = new Set((data.Files||[]).map(f => f.filename));
    const seenSlugs = new Set((data.Articles||[]).map(a => a.slug));
    const payload = translations[loc];
    if (!payload) { console.warn(`[WARN] Missing translations for ${loc}`); continue; }
    const fTr = payload.File || {};
    const aTr = payload.Article || {};
    const labelsTr = payload.labels || {};

    const fileToAdd = {
      filename: newFile.filename,
      title: fTr.title || newFile.title,
      description: fTr.description || newFile.description,
      date: newFile.date,
      source_url: newFile.source_url,
    };
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
    if (hasUnnecessaryCaps(fileToAdd.title) || hasUnnecessaryCaps(fileToAdd.description)) {
      console.warn(`[WARN] Caps heuristic flagged in ${loc} file text.`);
    }
    if (hasUnnecessaryCaps(articleToAdd.title) || hasUnnecessaryCaps(articleToAdd.description)) {
      console.warn(`[WARN] Caps heuristic flagged in ${loc} article text.`);
    }

    if (DRY || !APPLY) {
      console.log(`[dry-run] Would append to ${loc}:`, { fileToAdd, articleToAdd, labelsTr });
      continue;
    }
    data.Files = Array.isArray(data.Files) ? data.Files : [];
    data.Articles = Array.isArray(data.Articles) ? data.Articles : [];
    if (!seenFiles.has(fileToAdd.filename)) data.Files.push(fileToAdd);
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
      const cp = require('child_process');
      cp.execSync('node scripts/download-missing-pdfs.js --locale fr --force', { stdio: 'inherit' });
    } catch (e) {
      console.warn('PDF download step failed or not available:', e.message);
    }
  }

  console.log('Done.');
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
