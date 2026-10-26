# SOGC monthly registrations report

A monthly data article on new company registrations in Geneva and French-speaking Switzerland (GE, VD, VS, NE, FR, JU), built from the Swiss Official Gazette of Commerce (SOGC / FOSC / SHAB). It is meant as a citable source for the press: every number comes from the official publications, and no LLM writes or edits the article.

## Pipeline

| Piece | Role |
| --- | --- |
| `scripts/lib/sogcReport.js` | Fetches the public API (`https://amtsblattportal.ch/api/v1`, no auth), parses HR01 XML, builds an aggregate-only snapshot |
| `scripts/lib/sogcReportRender.js` | Renders the article in fr/en/de from fixed templates, and the CSV |
| `scripts/sogc-monthly-report.js` | CLI: fetch, render, check, write (`--apply`) |
| `scripts/sogc-report.test.js` | Unit tests (part of `npm test`) |
| `.github/workflows/sogc-monthly-report.yml` | 3rd of each month, 06:00 UTC: report on the previous month, validate, commit to main |

```bash
node scripts/sogc-monthly-report.js --month=2026-09            # dry run, prints headline figures
node scripts/sogc-monthly-report.js --month=2026-09 --apply    # writes everything
node scripts/sogc-monthly-report.js --month=2026-09 --from-snapshot --apply  # re-render, no network
```

Outputs per month:

- `data/sogc-reports/YYYY-MM.json`: snapshot (monthly counts per canton for HR01 and HR03 from January of the previous year to the report month, legal forms and sector buckets for the report month, quality counters, checksum). Aggregates only.
- `public/assets/data/sogc/creations-entreprises-suisse-romande-YYYY-MM.csv`: aggregate table linked from the article.
- An article with slug `creations-entreprises-geneve-suisse-romande-<mois>-<yyyy>` in `src/translations/{fr,en,de}/ressources.json`, with `series: "sogc-creations-romandie"` and `reportMonth`.

## Locales

Published in fr, en and de only (owner decision, 2026-10-26; `DATA_REPORT_LOCALES` in `scripts/lib/articleTopicGuardrails.js`). The script removes the report from es/pt if it is ever found there. Because es/pt have no entry, the sitemap and hreflang (`getValidLocalesForSlug`) leave them out, the article page returns 404 for es/pt instead of the usual French fallback (articles with a `series`), and `validate-article-translations.js` does not count them as missing.

Re-running a month keeps the first publication date. If the aggregates are unchanged, the stored snapshot is kept and nothing changes; otherwise the article gets an `updated` date.

## API facts (verified with curl, October 2026)

- List: `GET /publications?publicationStates=PUBLISHED&subRubrics=HR01&cantons=GE&publicationDate.start=…&publicationDate.end=…&pageRequest.page=0&pageRequest.size=2000`. `content[].meta` has `id`, `subRubric`, `cantons`, `publicationDate`; `content` itself is null in lists.
- Sending `rubrics=HR` together with `subRubrics` silently drops the sub-rubric filter, so only `subRubrics` is sent.
- Paging has no stable order (duplicates across pages were observed), so every request must fit in one page; ranges with more than 2000 items are split in two.
- Detail: `GET /publications/{id}/xml`. Fields used: `legalForm` (4-digit code), `purpose` (absent for sole proprietorships, then read after `But:`/`Zweck:` in `publicationText`), `uid` (duplicate check only, never stored).
- Legal form codes: 0101 sole proprietorship, 0103 general partnership, 0106 SA, 0107 Sàrl, 0108 cooperative, 0109 association, 0110 foundation, 0111 / 0151 branches.

The fetch fails closed: any item outside the requested sub-rubric, canton, state or dates, any count mismatch with the API `total`, or any missing detail aborts the run before anything is written.

## Methodology (as published)

- New entries: SOGC heading HR01, including branches. Deletions: HR03. The balance is a flow of publications, not the change in active companies (deletions include mergers, liquidations, seat transfers).
- Date basis: SOGC publication date, not the register entry date.
- Each publication is counted once; a publication listing several of the six cantons goes to the first in the order GE, VD, VS, NE, FR, JU (none in September 2026).
- Sectors: deterministic keyword classification of the first part of the purpose (before the usual "la société peut…" boilerplate), French and German keywords, earliest keyword wins. Indicative only, not NOGA; the unclassified count is always shown. Bump `CLASSIFIER_VERSION` when the rules change.
- No names of people or companies are published or stored.

## Guardrails and other pipelines

- `series: "sogc-creations-romandie"` (the only reserved value, see `DATA_REPORT_SERIES` in `scripts/lib/articleTopicGuardrails.js`) keeps the reports out of the editorial topic rotation and duplicate checks, out of the stale-article refresh (`refresh-next-article.js`), out of `ai-ressources-update.js --refresh`, and out of `translate-articles.js`.
- `validate-latest-article-guardrails.js` ignores data reports when picking the latest editorial article; `--slug=<slug>` validates a given article (used by the workflow).
- `amtsblattportal.ch` is on the curated reference allowlist (`scripts/lib/referenceValidator.js`, `docs/reference-source-policy.md`).
- Never run `sync-ressources.js --apply --force-overwrite` on these files: it copies French content over other locales.
