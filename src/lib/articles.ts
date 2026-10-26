import fs from "fs";
import path from "path";
import { cache } from "react";
import { locales, type Locale } from "./i18n-locales";
import articleLocaleNoindex from "../data/article-locale-noindex.json";

export const ARTICLE_CACHE_TTL_MS = 15 * 60 * 1000;

export type ArticleReference = {
  labelKey: string;
  url: string;
};

export type ResourceArticle = {
  slug: string;
  title: string;
  description?: string;
  content?: string;
  date?: string;
  updated?: string;
  author?: string;
  authorUrl?: string;
  /** Team slug of the reviewer; only shown when reviewedAt covers the current version. */
  reviewedBy?: string;
  /** YYYY-MM-DD */
  reviewedAt?: string;
  image?: string;
  references?: ArticleReference[];
  category?: string;
  tags?: string[];
  /** Reserved data-report series (deterministic, never LLM-edited), e.g. "sogc-creations-romandie". */
  series?: string;
  /** Data period covered by a data report, YYYY-MM. */
  reportMonth?: string;
};

type CachedArticles = {
  expiresAt: number;
  articles: ResourceArticle[];
};

const articlesByLocale = new Map<Locale, CachedArticles>();

function readArticles(locale: Locale): ResourceArticle[] {
  const file = path.join(
    process.cwd(),
    "src",
    "translations",
    locale,
    "ressources.json",
  );

  try {
    if (!fs.existsSync(file)) return [];
    const json = JSON.parse(fs.readFileSync(file, "utf8")) as {
      Articles?: unknown;
    };
    if (!Array.isArray(json.Articles)) return [];
    return json.Articles.filter((article): article is ResourceArticle => {
      if (!article || typeof article !== "object") return false;
      const candidate = article as Partial<ResourceArticle>;
      return Boolean(candidate.slug && candidate.title);
    });
  } catch {
    return [];
  }
}

function loadArticles(locale: Locale): ResourceArticle[] {
  const now = Date.now();
  const cached = articlesByLocale.get(locale);
  if (cached && cached.expiresAt > now) {
    return cached.articles;
  }

  const articles = readArticles(locale);
  articlesByLocale.set(locale, {
    expiresAt: now + ARTICLE_CACHE_TTL_MS,
    articles,
  });
  return articles;
}

export const getArticles = cache((locale: Locale): ResourceArticle[] =>
  loadArticles(locale),
);

export const getArticle = cache(
  (locale: Locale, slug: string): ResourceArticle | undefined =>
    getArticles(locale).find((article) => article.slug === slug),
);

function isDuplicateOfFr(article: ResourceArticle, frArticle: ResourceArticle) {
  const sameTitle = (article.title || "") === (frArticle.title || "");
  const sameDesc = (article.description || "") === (frArticle.description || "");
  const sameContent = (article.content || "") === (frArticle.content || "");
  return sameTitle && sameDesc && sameContent;
}

export const isGenuineTranslation = cache((locale: Locale, slug: string) => {
  if (locale === "fr") return true;

  const article = getArticle(locale, slug);
  const frArticle = getArticle("fr", slug);
  if (!article || !frArticle) return false;

  return !isDuplicateOfFr(article, frArticle);
});

export const getValidLocalesForSlug = cache((slug: string): Locale[] =>
  locales.filter((locale) => {
    const article = getArticle(locale, slug);
    if (!article) return false;
    return locale === "fr" || isGenuineTranslation(locale, slug);
  }),
);

// Locale versions deliberately kept out of the index (ES/PT pages with no search
// impressions). They still render, but are noindex and absent from the sitemap,
// the hreflang alternates and the RSS feed.
const noindexByLocale = new Map<string, Set<string>>(
  Object.entries(articleLocaleNoindex as Record<string, unknown>)
    .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
    .map(([locale, slugs]) => [locale, new Set(slugs)]),
);

export function isNoindexArticleLocale(locale: Locale, slug: string): boolean {
  return noindexByLocale.get(locale)?.has(slug) ?? false;
}

/** Genuine translation (or FR) that is not on the noindex list. */
export const isIndexableArticleLocale = cache((locale: Locale, slug: string) => {
  if (isNoindexArticleLocale(locale, slug)) return false;
  return locale === "fr" || isGenuineTranslation(locale, slug);
});

/** Locales to expose in the sitemap and hreflang alternates for an article. */
export const getIndexableLocalesForSlug = cache((slug: string): Locale[] =>
  getValidLocalesForSlug(slug).filter((locale) => !isNoindexArticleLocale(locale, slug)),
);
