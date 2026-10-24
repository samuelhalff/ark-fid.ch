"use strict";
/**
 * Blocking validation of ONE refreshed article across all locales.
 * Pure function over in-memory data so it can be unit-tested without git/network.
 */
const fs = require("fs");
const path = require("path");
const { countWords, validateArticleMetadata } = require("./articleRefresh");
const { extractOutdatedSwissVatRateMatches } = require("./outdatedVatValidator");
const { isBlockedDomain, isTrustedDomain } = require("./referenceValidator");

const LOCALES = ["fr", "en", "de", "es", "pt"];
// Translations are shorter than the French source (EN ~-15%); only FR is held to the
// exact bounds, translations get this tolerance.
const TRANSLATION_MIN_RATIO = 0.8;
const TRANSLATION_MAX_RATIO = 1.25;
/**
 * Derives the site routes from the app/[locale] directory tree (every folder holding a
 * page.*). Static segments are literal; dynamic ones are kept as "[param]" patterns
 * (e.g. "team/[slug]") and resolved by routeExists().
 * @returns {Set<string>} route patterns without locale or slashes ("" is the home page)
 */
function listAppRoutes(root) {
  const base = path.join(root, "app", "[locale]");
  const routes = new Set();
  const walk = (dir, segs) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && /^page\.(tsx|ts|jsx|js|mdx)$/.test(e.name))) routes.add(segs.join("/"));
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith("_") || e.name.startsWith("@")) continue;
      // route groups "(x)" do not add a URL segment
      walk(path.join(dir, e.name), /^\(.*\)$/.test(e.name) ? segs : [...segs, e.name]);
    }
  };
  walk(base, []);
  return routes;
}

/**
 * @param {Set<string>} routes patterns from listAppRoutes (or plain static routes)
 * @param {string} rel route without locale/slashes
 * @param {Record<string, Set<string>>} resolvers data sources for dynamic patterns; a dynamic
 *   segment with no (or an empty) data source accepts any single value.
 */
function routeExists(routes, rel, resolvers = {}) {
  if (routes.has(rel)) return true;
  const segs = rel === "" ? [] : rel.split("/");
  for (const pattern of routes) {
    if (!pattern.includes("[")) continue;
    const ps = pattern === "" ? [] : pattern.split("/");
    if (ps.length !== segs.length) continue;
    let ok = true;
    for (let i = 0; i < ps.length && ok; i++) {
      if (/^\[\[?\.{0,3}\w+\]\]?$/.test(ps[i])) {
        if (!segs[i]) ok = false;
      } else if (ps[i] !== segs[i]) ok = false;
    }
    if (!ok) continue;
    const src = resolvers[pattern];
    if (!src || src.size === 0) return true;
    // the dynamic value is the segment at the position of the (last) [param]
    const idx = ps.reduce((acc, seg, i) => (seg.startsWith("[") ? i : acc), -1);
    if (src.has(segs[idx])) return true;
  }
  return false;
}

function normalizedWords(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Identical to FR is only acceptable for very short strings (proper nouns). */
function sameAsFr(local, fr, { allowShort = false } = {}) {
  const a = normalizedWords(local);
  const b = normalizedWords(fr);
  if (!a) return false;
  if (a !== b) return false;
  return !(allowShort && countWords(a) <= 3);
}

function internalLinks(content) {
  return [...String(content || "").matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]);
}

/**
 * @param {object} o
 * @param {string} o.slug
 * @param {string} o.today YYYY-MM-DD
 * @param {Record<string,{Articles:object[]}>} o.current  locale -> ressources JSON (working tree)
 * @param {Record<string,{Articles:object[]}>} o.head     locale -> ressources JSON (HEAD)
 * @param {Set<string>} [o.routes]  allowed internal routes (without locale/slashes)
 * @param {Set<string>} [o.teamSlugs]
 * @param {object} [o.limits] {minWords,maxWords,minRefs,minTrusted}
 * @returns {string[]} errors
 */
function validateRefreshedArticle({ slug, today, current, head, routes, teamSlugs = new Set(), limits = {} }) {
  const errors = [];
  const { minWords = 0, maxWords = 0, minRefs = 3, minTrusted = 0 } = limits;
  const articleOf = (data, loc) => (data?.[loc]?.Articles || []).find((a) => a.slug === slug);
  const fr = articleOf(current, "fr");
  if (!fr) return [`fr: article ${slug} not found`];
  const frSlugs = new Set((current.fr.Articles || []).map((a) => a.slug));
  const resolvers = { "team/[slug]": teamSlugs, "ressources/articles/[slug]": frSlugs };

  for (const loc of LOCALES) {
    const a = articleOf(current, loc);
    const tag = `${loc}`;
    if (!a) {
      errors.push(`${tag}: article missing`);
      continue;
    }
    for (const f of ["title", "description", "content"]) {
      if (typeof a[f] !== "string" || !a[f].trim()) errors.push(`${tag}: ${f} empty`);
    }
    if (!Array.isArray(a.tags) || !a.tags.length) errors.push(`${tag}: tags missing`);

    const words = countWords(a.content);
    const lo = loc === "fr" ? minWords : Math.floor(minWords * TRANSLATION_MIN_RATIO);
    const hi = loc === "fr" ? maxWords : Math.ceil(maxWords * TRANSLATION_MAX_RATIO);
    if (lo > 0 && words < lo) errors.push(`${tag}: ${words} words < min ${lo}`);
    if (hi > 0 && words > hi) errors.push(`${tag}: ${words} words > max ${hi}`);

    if (loc !== "fr") {
      if (sameAsFr(a.content, fr.content)) errors.push(`${tag}: content identical to FR`);
      if (sameAsFr(a.title, fr.title, { allowShort: true })) errors.push(`${tag}: title identical to FR`);
      if (sameAsFr(a.description, fr.description, { allowShort: true })) {
        errors.push(`${tag}: description identical to FR`);
      }
    }

    // references
    const refs = Array.isArray(a.references) ? a.references : [];
    if (refs.length < minRefs) errors.push(`${tag}: ${refs.length} references < ${minRefs}`);
    const seen = new Set();
    let trusted = 0;
    for (const r of refs) {
      let u;
      try {
        u = new URL(r?.url);
      } catch {
        errors.push(`${tag}: invalid reference url ${r?.url}`);
        continue;
      }
      if (u.protocol !== "https:") errors.push(`${tag}: reference not https ${r.url}`);
      if (isBlockedDomain(r.url)) errors.push(`${tag}: blocked reference domain ${u.hostname}`);
      if (isTrustedDomain(r.url)) trusted++;
      const key = u.href.replace(/\/$/, "");
      if (seen.has(key)) errors.push(`${tag}: duplicate reference ${r.url}`);
      seen.add(key);
    }
    if (minTrusted > 0 && trusted < minTrusted) errors.push(`${tag}: ${trusted} trusted references < ${minTrusted}`);

    // internal links: unlocalized site paths (the renderer adds the locale); a foreign locale prefix is wrong.
    for (const href of internalLinks(a.content)) {
      const pathOnly = href.split(/[?#]/, 1)[0].replace(/\/+$/, "");
      const m = pathOnly.match(/^\/(fr|en|de|es|pt)(\/|$)/);
      if (m && m[1] !== loc) {
        errors.push(`${tag}: link to other locale ${href}`);
        continue;
      }
      const rel = pathOnly.replace(/^\/(fr|en|de|es|pt)(?=\/|$)/, "").replace(/^\//, "");
      const art = rel.match(/^ressources\/articles\/([^/]+)$/);
      if (art) {
        if (!frSlugs.has(art[1])) errors.push(`${tag}: link to unknown article ${href}`);
      } else if (routes && !routeExists(routes, rel, resolvers)) {
        errors.push(`${tag}: unknown internal route ${href}`);
      }
    }

    // unchanged slug/date/category vs HEAD
    const h = articleOf(head, loc);
    if (h) {
      for (const f of ["date", "category"]) {
        if (h[f] !== a[f]) errors.push(`${tag}: ${f} changed (${h[f]} -> ${a[f]})`);
      }
    }
    if (a.updated !== today) errors.push(`${tag}: updated ${a.updated} != ${today}`);

    const vat = extractOutdatedSwissVatRateMatches(a);
    if (vat.length) errors.push(`${tag}: outdated VAT rate ${[...new Set(vat.map((v) => v.rate))].join(", ")}`);
  }

  errors.push(...validateArticleMetadata([fr], teamSlugs).map((e) => `fr: ${e}`));
  return errors;
}

module.exports = { validateRefreshedArticle, listAppRoutes, routeExists, LOCALES };
