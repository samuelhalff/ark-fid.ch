/*
  Audit Next.js <Image> usage to infer max rendered widths per asset.
  - Scans app/ and src/ for Image imports and src strings.
  - Parses width/height props and sizes attr for rough estimates.
  - Emits a CSV of asset path, observed width cap.
*/

const fs = require('fs');
const path = require('path');

const CODE_DIRS = [path.resolve(process.cwd(), 'app'), path.resolve(process.cwd(), 'src')];

async function collectFiles(dir) {
  const out = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await collectFiles(full)));
    else if (/\.(tsx?|jsx?)$/.test(e.name)) out.push(full);
  }
  return out;
}

function parseSizesAttr(sizes) {
  // Very rough heuristic: pick the largest fixed size in the list
  const candidates = [];
  const re = /(\d+)px/g;
  let m;
  while ((m = re.exec(sizes))) candidates.push(parseInt(m[1], 10));
  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

async function run() {
  const files = [];
  for (const d of CODE_DIRS) files.push(...(await collectFiles(d)));
  const results = new Map();

  for (const file of files) {
    const content = await fs.promises.readFile(file, 'utf8');
    if (!content.includes('next/image')) continue;

    // naive scan for src strings like src="/assets/..."
    const imgUsage = [...content.matchAll(/<Image[\s\S]*?src=\"(\/assets\/[^\"]+)\"[\s\S]*?>/g)];
    for (const match of imgUsage) {
      const src = match[1];
      // try to find width or sizes in the same tag
      const tag = match[0];
      let cap = null;
      const widthMatch = tag.match(/width=\{(\d+)\}/);
      if (widthMatch) cap = parseInt(widthMatch[1], 10);
      const sizesMatch = tag.match(/sizes=\"([^\"]+)\"/);
      if (!cap && sizesMatch) cap = parseSizesAttr(sizesMatch[1]);
      if (!cap && tag.includes('fill')) cap = 640; // default heuristic for fill

      const prev = results.get(src) || 0;
      results.set(src, Math.max(prev, cap || 0));
    }
  }

  console.log('asset,cap_px');
  for (const [asset, cap] of results.entries()) {
    console.log(`${asset},${cap || ''}`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
