/*
  Asset lint: fail if code references .jpg/.png under /assets, or if any image exceeds size caps.
*/
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets');
const IGNORE_DIRS = new Set(['downloads']);
const CODE_DIRS = [path.resolve(process.cwd(), 'app'), path.resolve(process.cwd(), 'src')];
const MAX_BYTES = Number(process.env.ASSET_MAX_BYTES || 600 * 1024); // 600kB default cap per file

async function collectFiles(dir, re) {
  const out = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await collectFiles(full, re)));
    else if (re.test(e.name)) out.push(full);
  }
  return out;
}

(async () => {
  // 1) Disallow .jpg/.png references under /assets in code
  const codeFiles = [];
  for (const d of CODE_DIRS) codeFiles.push(...(await collectFiles(d, /\.(tsx?|jsx?)$/)));
  const badRefs = [];
  for (const f of codeFiles) {
    const t = await fs.promises.readFile(f, 'utf8');
    const m = t.match(/\/assets\/(?:[^"']+)\.(?:png|jpg|jpeg)/gi);
    if (m) badRefs.push({ file: f, matches: m });
  }
  if (badRefs.length) {
    console.error('Found disallowed .jpg/.png references in code:');
    for (const b of badRefs) console.error('-', path.relative(process.cwd(), b.file), '=>', b.matches.join(', '));
    process.exit(1);
  }

  // 2) Check raw asset file sizes
  const assets = await collectFiles(ASSETS_DIR, /.*/);
  const oversize = [];
  for (const a of assets) {
    const rel = path.relative(ASSETS_DIR, a);
    const top = rel.split(path.sep)[0];
    if (IGNORE_DIRS.has(top)) continue;
    if (a.toLowerCase().endsWith('.pdf')) continue;
    const stat = await fs.promises.stat(a);
    if (stat.size > MAX_BYTES) oversize.push({ file: a, size: stat.size });
  }
  if (oversize.length) {
    console.error(`Found oversize assets (> ${Math.round(MAX_BYTES/1024)}kB):`);
    for (const o of oversize) console.error('-', path.relative(ASSETS_DIR, o.file), `${Math.round(o.size/1024)}kB`);
    process.exit(1);
  }

  console.log('Assets OK');
})();
