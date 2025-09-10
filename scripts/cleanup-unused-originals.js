/*
  Remove JPG/PNG originals when a .webp equivalent exists and no code references the original.
  - Safe by design: only deletes if webp exists AND the original path is not found in app/ or src/.
*/

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.resolve(process.cwd(), 'public/assets');
const CODE_DIRS = [path.resolve(process.cwd(), 'app'), path.resolve(process.cwd(), 'src')];

async function exists(p) { try { await fs.promises.access(p); return true; } catch { return false; } }

async function collectCodeText() {
  const files = [];
  for (const dir of CODE_DIRS) files.push(...(await collectFiles(dir)));
  let blob = '';
  for (const f of files) blob += await fs.promises.readFile(f, 'utf8');
  return blob;
}

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

async function walkAndClean(dir, codeBlob) {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walkAndClean(full, codeBlob);
    } else {
      const ext = path.extname(e.name).toLowerCase();
      if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') continue;
      const webRel = toWebPath(full).replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const webFs = path.join(process.cwd(), 'public', webRel.replace(/^\//, ''));
      if (!(await exists(webFs))) continue; // no webp, skip
      const webRelOrig = toWebPath(full);
      if (!codeBlob.includes(webRelOrig)) {
        // delete original
        await fs.promises.unlink(full);
        console.log('deleted original:', path.relative(ASSETS_DIR, full));
      }
    }
  }
}

function toWebPath(p) {
  const i = p.lastIndexOf('public');
  return i >= 0 ? p.slice(i + 'public'.length).replace(/\\/g, '/') : null;
}

(async () => {
  const codeBlob = await collectCodeText();
  await walkAndClean(ASSETS_DIR, codeBlob);
})();
