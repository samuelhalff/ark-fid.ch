#!/usr/bin/env node
/**
 * Builds the standalone pages served on lba.ark-fid.ch (see middleware.ts).
 *
 * Sources (src/lba): content/<locale>.html (page body), styles.css, app.js, theme.js, meta.json.
 * Output: public/lba/<locale>.html + content-hashed assets in public/assets/lba/.
 * The output is committed; `node scripts/build-lba.mjs --check` fails when it is out of date.
 *
 * The pages run under a strict CSP: no inline or third-party scripts, self-hosted font.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src/lba");
const OUT_PAGES = path.join(ROOT, "public/lba");
const OUT_ASSETS = path.join(ROOT, "public/assets/lba");
const ORIGIN = "https://lba.ark-fid.ch";
const check = process.argv.includes("--check");

const read = (file) => fs.readFileSync(path.join(SRC, file), "utf8");
const meta = JSON.parse(read("meta.json"));
const locales = Object.keys(meta.locales).filter((l) => fs.existsSync(path.join(SRC, "content", `${l}.html`)));
if (!locales.includes(meta.defaultLocale)) throw new Error(`Missing content for default locale ${meta.defaultLocale}`);

const outputs = new Map();
const hashed = (name, ext, content) => {
  const file = `${name}.${createHash("sha256").update(content).digest("hex").slice(0, 10)}.${ext}`;
  outputs.set(path.join(OUT_ASSETS, file), content);
  return `/assets/lba/${file}`;
};
const cssUrl = hashed("lba", "css", read("styles.css"));
const appUrl = hashed("app", "js", read("app.js"));
const themeUrl = hashed("theme", "js", read("theme.js"));

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const text = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const organization = {
  "@type": "Organization",
  "@id": "https://ark-fid.ch/#organization",
  name: "Ark Fiduciaire SA",
  url: "https://ark-fid.ch",
  logo: "https://ark-fid.ch/assets/arkfid--color.svg",
};

for (const locale of locales) {
  const m = meta.locales[locale];
  const body = read(`content/${locale}.html`).trim();
  const url = `${ORIGIN}/${locale}/`;

  // Structured data: the article, plus the key notions as defined terms (taken from the page itself).
  const terms = [...body.matchAll(/<div class="notion" id="([\w-]+)">\s*<dt>([\s\S]*?)<\/dt>\s*<dd>\s*<p>([\s\S]*?)<\/p>/g)].map(
    ([, id, name, description]) => ({ "@type": "DefinedTerm", name: text(name), url: `${url}#${id}`, description: text(description) }),
  );
  const h1 = text((body.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || m.title);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: h1,
        name: m.title,
        description: m.description,
        inLanguage: m.htmlLang,
        datePublished: meta.published,
        dateModified: meta.updated,
        mainEntityOfPage: url,
        image: "https://ark-fid.ch/assets/og/og-fr.webp",
        author: organization,
        publisher: organization,
        about: m.about,
        ...(terms.length ? { hasPart: { "@id": `${url}#notions` } } : {}),
      },
      ...(terms.length
        ? [{ "@type": "DefinedTermSet", "@id": `${url}#notions`, inLanguage: m.htmlLang, hasDefinedTerm: terms }]
        : []),
    ],
  };

  const alternates = [
    ...locales.map((l) => `<link rel="alternate" hreflang="${l}" href="${ORIGIN}/${l}/">`),
    `<link rel="alternate" hreflang="x-default" href="${ORIGIN}/${meta.defaultLocale}/">`,
  ].join("\n");
  const langLinks = locales
    .filter((l) => l !== locale)
    .map((l) => `<li><a href="/${l}/" hreflang="${l}" lang="${l}">${esc(meta.locales[l].name)}</a></li>`)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="${m.htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(m.title)}</title>
<meta name="description" content="${esc(m.description)}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="${url}">
${alternates}
<meta name="author" content="Ark Fiduciaire SA">
<meta name="theme-color" content="#F5F6F4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#151B21" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="article">
<meta property="og:locale" content="${m.ogLocale}">
<meta property="og:site_name" content="Ark Fiduciaire SA">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(m.title)}">
<meta property="og:description" content="${esc(m.description)}">
<meta property="og:image" content="https://ark-fid.ch/assets/og/og-fr.webp">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.png" type="image/png">
<link rel="preload" href="/assets/lba/archivo-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${cssUrl}">
<script src="${themeUrl}"></script>
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
</head>
<body>
<div class="wrap">
<div class="topbar">
  <a class="logo" href="${m.arkUrl}" aria-label="Ark Fiduciaire SA">
    <img class="on-light" src="/assets/arkfid--color.svg" alt="Ark Fiduciaire SA" width="100" height="32">
    <img class="on-dark" src="/assets/arkfid--light.svg" alt="" width="100" height="32">
  </a>
  <div class="controls">
    <a class="site" href="${m.arkUrl}">${esc(m.visitSite)}</a>
    <details class="lang">
      <summary class="lang-btn" aria-label="${esc(m.languages)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9M12 3C9.4 5.6 8.2 8.6 8.2 12s1.2 6.4 3.8 9"/></svg>
        <span class="lang-code">${m.label}</span>
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <ul class="lang-menu">${langLinks}</ul>
    </details>
    <button type="button" class="theme" hidden data-mode="system" data-label="${esc(m.theme.label)}" data-system="${esc(m.theme.system)}" data-light="${esc(m.theme.light)}" data-dark="${esc(m.theme.dark)}">
      <svg class="i-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      <svg class="i-dark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>
      <svg class="i-system" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>
      <span class="sr"></span>
    </button>
  </div>
</div>

${body.replace("</footer>", `  <p>${m.publishedBy} <a href="${m.arkUrl}">Ark Fiduciaire SA</a>, ${m.city}.</p>\n</footer>`)}

</div>
<script src="${appUrl}" defer></script>
</body>
</html>
`;
  outputs.set(path.join(OUT_PAGES, `${locale}.html`), html);
}

// Files that are generated (pages + hashed assets); fonts are kept.
const generated = (dir, keep) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => !keep.test(f)).map((f) => path.join(dir, f)) : [];
const existing = [...generated(OUT_PAGES, /^$/), ...generated(OUT_ASSETS, /\.woff2$/)];

if (check) {
  const stale = [...outputs].filter(([file, content]) => !fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content).map(([f]) => f);
  const extra = existing.filter((f) => !outputs.has(f));
  if (stale.length || extra.length) {
    console.error("LBA pages are out of date; run `node scripts/build-lba.mjs`.", { stale, extra });
    process.exit(1);
  }
  console.log(`LBA pages up to date (${locales.join(", ")}).`);
} else {
  for (const f of existing) if (!outputs.has(f)) fs.rmSync(f);
  for (const [file, content] of outputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  console.log(`Built LBA pages: ${locales.join(", ")}`);
}
