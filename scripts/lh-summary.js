#!/usr/bin/env node
/**
 * Lighthouse JSON summarizer.
 * Usage: node scripts/lh-summary.js <reportsDir> <profile>
 * Scans for lhr-*.json in reportsDir, extracts key metrics, prints a markdown table.
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2] || '.lighthouseci';
const profile = process.argv[3] || 'unknown';

function formatMs(v){
  if (v == null || isNaN(v)) return '';
  if (v >= 1000) return (v/1000).toFixed(2)+'s';
  return v.toFixed(0)+'ms';
}

function formatScore(s){
  if (s == null) return '';
  return (s*100).toFixed(0);
}

let files = [];
try {
  files = fs.readdirSync(dir).filter(f=>f.startsWith('lhr-') && f.endsWith('.json'));
} catch(e) {
  console.error('Could not read directory', dir, e.message);
  process.exit(0); // fail-soft; don't break CI
}

const rows = [];
for (const f of files) {
  try {
    const json = JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
    const audits = json.audits || {};
    const categories = json.categories || {};
    const url = json.finalDisplayedUrl || json.finalUrl || json.requestedUrl || f;
    rows.push({
      url,
      perf: formatScore(categories.performance && categories.performance.score),
      lcp: formatMs(audits['largest-contentful-paint']?.numericValue),
      fcp: formatMs(audits['first-contentful-paint']?.numericValue),
      tbt: formatMs(audits['total-blocking-time']?.numericValue),
      cls: audits['cumulative-layout-shift']?.numericValue?.toFixed(3) ?? '',
      si: formatMs(audits['speed-index']?.numericValue),
      interactive: formatMs(audits['interactive']?.numericValue),
    });
  } catch(e) {
    console.error('Failed parsing', f, e.message);
  }
}

if(!rows.length){
  console.log(`\n### Lighthouse (${profile})\nNo JSON reports found in ${dir}.`);
  process.exit(0);
}

rows.sort((a,b)=>a.url.localeCompare(b.url));

console.log(`\n### Lighthouse (${profile}) Metrics`);
console.log('\n| URL | Perf | LCP | FCP | TBT | CLS | SI | Interactive |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
for(const r of rows){
  console.log(`| ${r.url.replace(/^https?:\/\//,'')} | ${r.perf} | ${r.lcp} | ${r.fcp} | ${r.tbt} | ${r.cls} | ${r.si} | ${r.interactive} |`);
}

// Highlight potential slowest metrics (simple heuristic)
const slowLcp = [...rows].filter(r=>r.lcp.endsWith('s')).sort((a,b)=>parseFloat(b.lcp)-parseFloat(a.lcp))[0];
const slowTbt = [...rows].filter(r=>r.tbt && !r.tbt.endsWith('ms')).sort((a,b)=>parseFloat(b.tbt)-parseFloat(a.tbt))[0];
if (slowLcp || slowTbt) {
  console.log('\n<details><summary>Heuristic Highlights</summary>');
  if (slowLcp) console.log(`\n- Highest LCP: ${slowLcp.lcp} at ${slowLcp.url}`);
  if (slowTbt) console.log(`- Highest TBT: ${slowTbt.tbt} at ${slowTbt.url}`);
  console.log('\n</details>');
}
