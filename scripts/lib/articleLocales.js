/**
 * Article locale policy (Oct 2026).
 *
 * New articles are written in FR and translated to EN and DE only. ES and PT
 * earned ~2% of article clicks, so they are kept for existing articles but never
 * generated for new ones. Tooling must therefore accept an article that is
 * missing in es/pt, while still rejecting an es/pt entry that is a raw FR copy.
 */
const ALL_ARTICLE_LOCALES = ["fr", "en", "de", "es", "pt"];
// Locales every new article is translated into (FR is the source).
const NEW_ARTICLE_TARGET_LOCALES = ["en", "de"];
// Locales kept only for articles that already exist there.
const LEGACY_ARTICLE_LOCALES = ["es", "pt"];

function isLegacyArticleLocale(locale) {
  return LEGACY_ARTICLE_LOCALES.includes(locale);
}

/**
 * Target locales for (re)translating one article: the new-article locales,
 * plus each legacy locale only where the article already exists.
 * @param {string} slug
 * @param {Record<string, {Articles?: Array<{slug: string}>}>} localeData data per locale
 * @param {string[]} [candidates]
 */
function translationLocalesForSlug(slug, localeData, candidates = [...NEW_ARTICLE_TARGET_LOCALES, ...LEGACY_ARTICLE_LOCALES]) {
  return candidates.filter((locale) => {
    if (!isLegacyArticleLocale(locale)) return true;
    const articles = localeData?.[locale]?.Articles;
    return Array.isArray(articles) && articles.some((a) => a && a.slug === slug);
  });
}

module.exports = {
  ALL_ARTICLE_LOCALES,
  NEW_ARTICLE_TARGET_LOCALES,
  LEGACY_ARTICLE_LOCALES,
  isLegacyArticleLocale,
  translationLocalesForSlug,
};
