import { NextResponse } from "next/server";
import { locales, type Locale } from "@/src/lib/i18n"; // adjust exports
import { localizePath } from "@/src/lib/paths";
import { hreflangFor } from "@/src/lib/hreflang";
import { teamMembers, getMemberSlug } from "@/src/lib/team";
import fs from "fs";
import path from "path";

const BASE = "https://ark-fid.ch";
const canonicalLocale = "fr";

function getPlaceholderLocales(): Set<string> {
  const raw = process.env.PLACEHOLDER_LOCALES || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

const placeholderLocales = getPlaceholderLocales();
const sitemapLocales = locales.filter(
  (locale) => !placeholderLocales.has(locale as any)
);
// static routes
const staticPaths = [
  "/",
  "/about",
  "/services",
  "/ressources",
  "/contact",
  "/team",
  "/partners",
  "/legal/terms",
  "/legal/privacy",
  "/legal/cookies",
];

// dynamic routes
const servicePaths = [
  "/services/accounting",
  "/services/taxes",
  "/services/payroll",
  "/services/incorporation",
  "/services/outsourcing",
  "/services/corporate",
  "/services/domiciliation",
  "/services/odoo",
  "/services/family-office",
  "/services/mergers-acquisitions",
];

// Team member pages
const teamPaths = teamMembers.map((member) => `/team/${getMemberSlug(member)}`);

interface ArticleData {
  slug: string;
  title?: string;
  description?: string;
  content?: string;
  date?: string;
}

function readRessourcesIndex(locale: string): ArticleData[] {
  const file = path.join(
    process.cwd(),
    "src",
    "translations",
    locale,
    "ressources.json"
  );
  try {
    if (!fs.existsSync(file)) return [];
    const json = JSON.parse(fs.readFileSync(file, "utf8")) as {
      Articles?: ArticleData[];
    };
    return Array.isArray(json.Articles) ? json.Articles : [];
  } catch (_) {
    return [];
  }
}

/**
 * Check if an article in a non-canonical locale is a genuine translation
 * (not just a copy of the canonical FR content).
 * Returns true if the article has meaningfully different content.
 */
function isGenuineTranslation(
  article: ArticleData,
  canonicalArticle: ArticleData
): boolean {
  // If title, description, AND content are all identical to FR, it's not a genuine translation
  const sameTitle = (article.title || "") === (canonicalArticle.title || "");
  const sameDesc =
    (article.description || "") === (canonicalArticle.description || "");
  const sameContent =
    (article.content || "") === (canonicalArticle.content || "");

  // If all three are identical, it's a duplicate/fallback, not a translation
  if (sameTitle && sameDesc && sameContent) return false;

  return true;
}

// Enumerate articles from the canonical locale translations JSON.
// Only include locales where genuine translations exist (not duplicates of FR).
// Shape: { Articles: [{ slug, date, ... }] }
const ressourcesArticles = (() => {
  try {
    // Load all articles by locale
    const articlesByLocale = new Map<string, Map<string, ArticleData>>();
    for (const locale of sitemapLocales) {
      const items = readRessourcesIndex(locale);
      const bySlug = new Map<string, ArticleData>();
      for (const item of items) {
        bySlug.set(item.slug, item);
      }
      articlesByLocale.set(locale, bySlug);
    }

    const canonicalArticles = articlesByLocale.get(canonicalLocale);
    if (!canonicalArticles || canonicalArticles.size === 0) {
      // Fallback to EN if FR has no articles
      const enArticles = articlesByLocale.get("en");
      if (!enArticles) return [];
    }

    const canonical = readRessourcesIndex(canonicalLocale);
    const articles = canonical.length ? canonical : readRessourcesIndex("en");

    return articles.map((canonicalArticle) => {
      // Determine which locales have genuine translations for this article
      const validLocales = sitemapLocales.filter((locale) => {
        const localeArticles = articlesByLocale.get(locale);
        if (!localeArticles) return false;

        const article = localeArticles.get(canonicalArticle.slug);
        if (!article) return false;

        // Canonical locale is always valid
        if (locale === canonicalLocale) return true;

        // For other locales, check if it's a genuine translation
        return isGenuineTranslation(article, canonicalArticle);
      });

      return {
        path: `/ressources/articles/${canonicalArticle.slug}`,
        date: canonicalArticle.date,
        locales: validLocales,
      };
    });
  } catch (_) {
    // fall through
  }
  return [] as Array<{ path: string; date?: string; locales?: string[] }>;
})();

type PathEntry = { path: string; date?: string; locales?: string[] } | string;
const toPathEntry = (p: PathEntry) => (typeof p === "string" ? { path: p } : p);

const paths = [
  ...staticPaths.map(toPathEntry),
  ...servicePaths.map(toPathEntry),
  ...teamPaths.map(toPathEntry),
  ...ressourcesArticles,
] as Array<{ path: string; date?: string; locales?: string[] }>;

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const defaultLastmod = new Date().toISOString().slice(0, 10);

  const urlEntries = paths.flatMap((pObj) => {
    const p = pObj.path;
    const pathLocales = (
      pObj.locales?.length ? pObj.locales : sitemapLocales
    ).filter((locale) => sitemapLocales.includes(locale as any));
    // build per-locale entries and optionally a non-prefixed default locale entry
    return pathLocales.map((locale) => {
      const basePath = p === "/" ? "" : p;
      const localized = basePath ? localizePath(basePath, locale as any) : "";
      // Add trailing slash to match trailingSlash: true in next.config.js
      const loc = `${BASE}/${locale}${localized}/`;
      const lastmod = pObj.date || defaultLastmod;
      // derive changefreq/priority
      const isHome = p === "/";
      const isArticle = p.startsWith("/ressources/articles/");
      const isResources = p.startsWith("/ressources") && !isArticle;
      const isService = p.startsWith("/services");
      const isLegal = p.startsWith("/legal/");
      const changefreq =
        isHome || isArticle
          ? "weekly"
          : isService || isResources
          ? "monthly"
          : isLegal
          ? "yearly"
          : "monthly";
      const priority = isHome
        ? "1.0"
        : isArticle
        ? "0.8"
        : isService
        ? "0.7"
        : isResources
        ? "0.6"
        : isLegal
        ? "0.3"
        : "0.5";

      // build alternates block
      const alternates = [
        ...pathLocales.map((alt) => {
          const altPathBase = p === "/" ? "" : p;
          const altLocalized = altPathBase
            ? localizePath(altPathBase, alt as any)
            : "";
          // Add trailing slash to alternate hrefs
          const href = `${BASE}/${alt}${altLocalized}/`;
          const hreflang = hreflangFor(alt as Locale);
          return `    <xhtml:link rel="alternate" hreflang="${escapeXml(
            hreflang
          )}" href="${escapeXml(href)}"/>`;
        }),
        // x-default points to FR per canonical policy
        (() => {
          const xDefaultLocale = pathLocales.includes(canonicalLocale)
            ? canonicalLocale
            : pathLocales[0];
          const altPathBase = p === "/" ? "" : p;
          const altLocalized = altPathBase
            ? localizePath(altPathBase, xDefaultLocale as any)
            : "";
          // Add trailing slash to x-default href
          const href = `${BASE}/${xDefaultLocale}${altLocalized}/`;
          return `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(
            href
          )}"/>`;
        })(),
      ].join("\n");
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alternates}
  </url>`;
    });
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries.join("\n")}
</urlset>`;

  return new NextResponse(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
