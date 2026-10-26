# Article locales and pruning (Oct 2026)

## New articles: FR + EN + DE only

- The article pipeline (`.github/workflows/ai-ressources-every-4-days.yml`) runs on the 2nd and 16th of each month (about 2 new articles a month).
- New articles are written in French and translated to English and German only. The locale policy lives in `scripts/lib/articleLocales.js`.
- Spanish and Portuguese are kept for existing articles only. `translate-articles.js` and the refresh flow (`--refresh`) update an ES/PT entry only if it already exists, and never create a new one.
- Validators accept an article that is missing in ES/PT (`validate-article-translations.js`, `refreshedArticleValidator.js`). An ES/PT entry that is a raw copy of the French text still fails.
- When an article is missing in ES/PT, the ES/PT URL falls back to the French text with `noindex` and is not listed in the sitemap or in the hreflang alternates (existing behaviour of `getValidLocalesForSlug`).

## Pruned ES/PT article URLs

- `src/data/article-locale-noindex.json` lists ES/PT article URLs with no Google Search Console impressions (page level, 2026-07-27 to 2026-10-25). Articles published after 2026-07-27 (less than 90 days of data) and articles that receive 301s from merged articles are not listed.
- These pages still render (no 404) but are `noindex, follow`, and are left out of the sitemap, the hreflang alternates of every language version and the RSS feed (`getIndexableLocalesForSlug` / `isIndexableArticleLocale` in `src/lib/articles.ts`). The refresh workflow does not submit them to IndexNow.
- `scripts/article-locale-noindex.test.js` (part of `npm run test`) checks the list: ES/PT keys only, existing slugs, no redirect sources or targets.
- To bring a page back, remove its slug from the list. Re-check with `gseo gsc ark-fid.ch --dims page` before adding more.

## Consolidated articles

- Weak articles that overlap a stronger article on the same queries are removed from every locale and 301-redirected to the winner (`ARTICLE_CONSOLIDATIONS_2026_10` in `next.config.js`, covered by `scripts/article-redirects.test.js`).
- Before adding a pair, make sure the target is not itself a redirect source (no chains) and repoint any older redirect that targets the removed slug.
