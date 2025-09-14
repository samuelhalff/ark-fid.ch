'use strict';
// Load environment variables from .env if available (non-fatal if missing)
try { require('dotenv').config(); } catch {}

/**
 * Translate FR articles to other locales (EN/DE/ES/PT) while preserving slugs and links.
 * - Does NOT change filenames, slugs, or reference URLs.
 * - Only updates title/description/content fields for Articles.
 * - Skips items already translated (i.e., when locale differs from FR), unless --force.
 * - Applies a light post-check to avoid unnecessary capitals (acronyms allowed).
 *
 * Usage:
 *   node scripts/translate-articles.js --dry-run
 *   GEMINI_API_KEY=... node scripts/translate-articles.js --apply
 *   GEMINI_API_KEY=... node scripts/translate-articles.js --apply --locales=en,de --max=3
 *   GEMINI_API_KEY=... node scripts/translate-articles.js --apply --only-slugs=slug1,slug2
 */

const fs = require('fs');
const path = require('path');

const args = new Set(process.argv.slice(2).filter(a => !a.includes('=')));
const getArg = (k, d) => {
  const prefix = `${k}=`;
  const found = process.argv.slice(2).find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : d;
};

const APPLY = args.has('--apply');
const DRY = args.has('--dry-run') || !APPLY;
const FORCE = args.has('--force');
const LOCALES = (getArg('--locales', 'en,de,es,pt').split(',').map(s => s.trim()).filter(Boolean));
const MODEL_OVERRIDE = getArg('--model', '');
const PROVIDER = getArg('--provider', '').toLowerCase() || process.env.TRANSLATE_PROVIDER || 'gemini';
const ONLY_SLUGS = new Set((getArg('--only-slugs', '') || '').split(',').map(s => s.trim()).filter(Boolean));
const MAX = parseInt(getArg('--max', '0'), 10) || 0;

const ROOT = process.cwd();
const TRANSLATIONS = path.join(ROOT, 'src', 'translations');
const FR_PATH = path.join(TRANSLATIONS, 'fr', 'ressources.json');

if (!fs.existsSync(FR_PATH)) {
  console.error(`Canonical FR file not found: ${FR_PATH}`);
  process.exit(2);
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const MODEL = MODEL_OVERRIDE || process.env.GEMINI_MODEL_TRANSLATE || process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const AZURE = {
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4.1',
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview',
};

function loadJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { throw new Error(`Failed to parse ${p}: ${e.message}`); }
}
function saveJSON(p, data) { fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8'); }

function hasUnnecessaryCaps(str) {
  if (!str || typeof str !== 'string') return false;
  const allowed = new Set(['TVA','AFC','AVS','LAA','AC','LPP','SA','Sàrl','Odoo','CO','RPC','FER','PDF','ETIAS','UE','UEFA']);
  return str.split(/\s+/).some(w => /[A-Z]{3,}/.test(w) && !allowed.has(w));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function geminiJson(model, prompt) {
  if (!GEMINI_API_KEY) throw new Error('Missing GEMINI_API_KEY or GOOGLE_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json'
    }
  };
  // up to 3 attempts with backoff on 429
  let attempt = 0;
  while (true) {
    attempt++;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Gemini returned no content.');
      try { return JSON.parse(text); } catch (e) { throw new Error('Gemini did not return valid JSON: ' + e.message); }
    }
    const text = await res.text().catch(() => '');
    if (res.status === 429 && attempt < 3) {
      // try to parse retry delay
      let delayMs = 35000;
      try {
        const j = JSON.parse(text);
        const retry = j?.error?.details?.find?.(d => d['@type']?.includes('RetryInfo'));
        const s = retry?.retryDelay || '35s';
        const m = /([0-9]+)s/.exec(s);
        if (m) delayMs = parseInt(m[1], 10) * 1000;
      } catch {}
      console.warn(`[WARN] 429 from Gemini (attempt ${attempt}). Retrying in ${Math.round(delayMs/1000)}s...`);
      await sleep(delayMs);
      continue;
    }
    throw new Error(`Gemini HTTP ${res.status}: ${text}`);
  }
}

async function azureChatJson(prompt) {
  if (!AZURE.endpoint || !AZURE.apiKey) throw new Error('Missing Azure OpenAI endpoint or API key');
  // Build URL (allow endpoint to already include deployments path and query)
  let url = AZURE.endpoint;
  if (!/api-version=/.test(url)) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}api-version=${encodeURIComponent(AZURE.apiVersion)}`;
  }
  const body = {
    messages: [
      { role: 'system', content: 'You are a professional translator. Output strictly JSON.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    top_p: 0.9,
    response_format: { type: 'json_object' }
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': AZURE.apiKey,
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Azure OpenAI HTTP ${res.status}: ${text}`);
  }
  const data = await res.json();
  // Azure response: choices[0].message.content contains JSON string
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Azure OpenAI returned no content.');
  try { return JSON.parse(content); } catch (e) { throw new Error('Azure did not return valid JSON: ' + e.message); }
}

function buildTranslatePrompt(locale, frArticle) {
  return [
    'Tu es un traducteur professionnel. Traduis ce contenu français vers la langue cible précisée.',
    'Contraintes impératives:',
    '- Ne modifie PAS le slug, ni les liens, ni les URLs de référence.',
    '- Ne change PAS la casse inutilement (pas de capitales superflues : initiale de phrase, acronymes et noms propres seulement).',
    '- Préserve la structure markdown du contenu, en l’adaptant à la langue cible si nécessaire.',
    '- Réponds en JSON strict.',
    '',
    'Langue cible (code): ' + locale,
    'Entrée FR:',
    JSON.stringify({ slug: frArticle.slug, title: frArticle.title, description: frArticle.description, content: frArticle.content }, null, 2),
    '',
    'Format de sortie STRICT (application/json):',
    '{ "title": "...", "description": "...", "content": "..." }'
  ].join('\n');
}

function needsTranslation(frA, locA) {
  if (!locA) return true;
  if (FORCE) return true;
  const sameTitle = (locA.title || '') === (frA.title || '');
  const sameDesc = (locA.description || '') === (frA.description || '');
  const sameContent = (locA.content || '') === (frA.content || '');
  return sameTitle && sameDesc && sameContent; // identical means untranslated
}

async function main() {
  const fr = loadJSON(FR_PATH);
  const frArticles = Array.isArray(fr.Articles) ? fr.Articles : [];
  if (!frArticles.length) throw new Error('FR Articles list is empty.');

  let processed = 0, updated = 0;

  for (const locale of LOCALES) {
    const targetPath = path.join(TRANSLATIONS, locale, 'ressources.json');
    if (!fs.existsSync(targetPath)) { console.warn(`[WARN] Missing ${locale}/ressources.json; skipping.`); continue; }
    const data = loadJSON(targetPath);
    data.Articles = Array.isArray(data.Articles) ? data.Articles : [];
    const bySlug = new Map(data.Articles.map(a => [a.slug, a]));

    for (const frA of frArticles) {
      if (ONLY_SLUGS.size && !ONLY_SLUGS.has(frA.slug)) continue;
      const locA = bySlug.get(frA.slug);
      if (!needsTranslation(frA, locA)) continue;

      processed++;
      if (MAX && processed > MAX) break;

      const prompt = buildTranslatePrompt(locale, frA);
      if (DRY) {
        console.log(`[dry-run] Would translate slug="${frA.slug}" to ${locale}`);
        continue;
      }
  const tr = PROVIDER === 'azure' ? await azureChatJson(prompt) : await geminiJson(MODEL, prompt);
      const title = (tr && tr.title) ? String(tr.title) : frA.title;
      const description = (tr && tr.description) ? String(tr.description) : frA.description;
      const content = (tr && tr.content) ? String(tr.content) : frA.content;

      if (hasUnnecessaryCaps(title) || hasUnnecessaryCaps(description)) {
        console.warn(`[WARN] ${locale}:${frA.slug} possible unnecessary capitals in title/description.`);
      }

      const merged = {
        ...frA, // preserve slug, author, date, image, references
        title,
        description,
        content
      };

      // If article exists, replace it; otherwise push
      if (locA) {
        const idx = data.Articles.findIndex(a => a.slug === frA.slug);
        if (idx >= 0) data.Articles[idx] = merged; else data.Articles.push(merged);
      } else {
        data.Articles.push(merged);
      }
      updated++;
      saveJSON(targetPath, data);
      console.log(`[UPDATED] ${locale}:${frA.slug}`);
    }
  }

  if (DRY) console.log(`\nDry-run complete. Articles needing translation (or identical to FR) scanned: ${processed}.`);
  else console.log(`\nDone. Articles updated: ${updated}.`);
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
