#!/usr/bin/env node
/**
 * Compare fr/ressources.json to other locale ressources.json files.
 * Reports:
 *  - Missing top-level keys
 *  - Count differences in Files & Articles arrays
 *  - Missing individual file/article entries by filename/slug
 *  - Extra entries not in FR canonical
 */
const fs = require('fs');
const path = require('path');

const LOCALES = ['en','de','es','pt'];
const BASE = path.join(process.cwd(), 'src', 'translations');
const CANONICAL = 'fr';

function load(locale){
  const p = path.join(BASE, locale, 'ressources.json');
  return JSON.parse(fs.readFileSync(p,'utf8'));
}

function indexBy(arr, key){
  return Object.fromEntries(arr.map(o => [o[key], o]));
}

const fr = load(CANONICAL);
const report = [];

for(const loc of LOCALES){
  const data = load(loc);
  const section = { locale: loc, issues: [] };
  // Top-level key comparison (excluding dynamic arrays for content diff below)
  const frKeys = Object.keys(fr).filter(k => !['Files','Articles'].includes(k));
  const dataKeys = Object.keys(data).filter(k => !['Files','Articles'].includes(k));
  for(const k of frKeys){
    if(!(k in data)) section.issues.push(`Missing key: ${k}`);
  }
  for(const k of dataKeys){
    if(!(k in fr)) section.issues.push(`Extra key not in fr: ${k}`);
  }

  // Files diff
  const frFiles = fr.Files || [];
  const locFiles = data.Files || [];
  const frFilesIndex = indexBy(frFiles,'filename');
  const locFilesIndex = indexBy(locFiles,'filename');
  for(const f of frFiles){ if(!locFilesIndex[f.filename]) section.issues.push(`Missing file entry: ${f.filename}`); }
  for(const f of locFiles){ if(!frFilesIndex[f.filename]) section.issues.push(`Extra file entry (not in fr): ${f.filename}`); }
  if(frFiles.length !== locFiles.length){ section.issues.push(`File count mismatch fr=${frFiles.length} vs ${locFiles.length}`); }

  // Articles diff
  const frArticles = fr.Articles || [];
  const locArticles = data.Articles || [];
  const frArtIndex = indexBy(frArticles,'slug');
  const locArtIndex = indexBy(locArticles,'slug');
  for(const a of frArticles){ if(!locArtIndex[a.slug]) section.issues.push(`Missing article: ${a.slug}`); }
  for(const a of locArticles){ if(!frArtIndex[a.slug]) section.issues.push(`Extra article (not in fr): ${a.slug}`); }
  if(frArticles.length !== locArticles.length){ section.issues.push(`Article count mismatch fr=${frArticles.length} vs ${locArticles.length}`); }

  if(section.issues.length === 0) section.issues.push('No discrepancies');
  report.push(section);
}

console.log('Ressources translation diff report');
console.log('Canonical: fr');
for(const r of report){
  console.log(`\nLocale: ${r.locale}`);
  r.issues.forEach(i => console.log(' -', i));
}
