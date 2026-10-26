# SOGC monthly statistics (créations, faillites)

Two evergreen data pages on Geneva and French-speaking Switzerland (GE, VD, VS, NE, FR, JU), built from the Swiss Official Gazette of Commerce (SOGC / FOSC / SHAB) and updated in place every month. They are meant as citable sources for the press: every number comes from the official publications, and no LLM writes or edits them.

| Page (same slug in fr/en/de) | Series | Category |
| --- | --- | --- |
| `creations-entreprises-geneve-suisse-romande-statistiques` | `sogc-creations-romandie` | incorporation |
| `faillites-geneve-suisse-romande-statistiques` | `sogc-faillites-romandie` | corporate |

One stable URL per statistic (owner decision, 2026-10-26): monthly URLs would split links and rankings. The title carries the latest month (≤ 60 characters), `date` (datePublished) never changes, `updated` (dateModified) is set when a monthly run changes the page, `reportMonth` is the latest data month.

The first monthly URL, `creations-entreprises-geneve-suisse-romande-septembre-2026`, redirects (301, fr/en/de) to the créations page (`next.config.js`).

## Pipeline

| Piece | Role |
| --- | --- |
| `scripts/lib/sogcReport.js` | Fetches the public API (`https://amtsblattportal.ch/api/v1`, no auth), parses HR01 and KK02/KK03 XML, builds an aggregate-only snapshot |
| `scripts/lib/sogcReportRender.js` | Renders both pages in fr/en/de from fixed templates, the CSVs and the per-canton highlights |
| `scripts/sogc-monthly-report.js` | CLI: fetch, render, check, write (`--apply`) |
| `scripts/sogc-report.test.js` | Unit tests (part of `npm test`) |
| `.github/workflows/sogc-monthly-report.yml` | 3rd of each month, 06:00 UTC: previous month, validate, commit to main, IndexNow |

```bash
node scripts/sogc-monthly-report.js --month=2026-09                  # dry run: titles, word counts, highlights
node scripts/sogc-monthly-report.js --month=2026-09 --apply          # writes everything
node scripts/sogc-monthly-report.js --month=2026-09 --from-snapshot --apply   # re-render, no network
node scripts/sogc-monthly-report.js --month=2026-05 --backfill --apply        # older month: snapshot and CSVs only
```

A month older than the one shown on the pages is refused unless `--backfill` (which never touches the pages).

Outputs:

- `data/sogc-reports/YYYY-MM.json`: snapshot (schema 2): monthly counts per canton for HR01, HR03, KK02, KK03 over the 24 months up to the report month; legal forms, sector buckets and bankruptcy debtor split for the report month; quality counters; checksum of the aggregates; `highlights` (one sentence per canton in fr/en/de, for cantonal press pitches, regenerated from the aggregates on every run and excluded from the checksum).
- `public/assets/data/sogc/creations-entreprises-suisse-romande.csv` and `faillites-suisse-romande.csv`: full history (month × canton) from all stored snapshots; for each month the snapshot with the latest report month wins. Breakdowns (legal forms, debtors) exist only for months that were a report month.
- `public/assets/data/sogc/creations-entreprises-suisse-romande-YYYY-MM.csv`, `faillites-suisse-romande-YYYY-MM.csv`: one row per canton for the month. Rewritten only when the figures change.

## API facts (verified with curl, October 2026)

- List: `GET /publications?publicationStates=PUBLISHED&subRubrics=HR01&cantons=GE&publicationDate.start=…&publicationDate.end=…&pageRequest.page=0&pageRequest.size=2000`. Sending `rubrics=HR` with `subRubrics` silently drops the sub-rubric filter.
- Paging has no stable order, so each request must fit in one page; HR ranges above 2000 items are split in two and reconciled with the parent total.
- `GET /rubrics` lists sub-rubrics. KK01 avis préalable d'ouverture, KK02 publication de faillite/appel aux créanciers, KK03 suspension faute d'actif, KK04–KK12 later stages.
- Bankruptcy (KK) list filters are wider than the publication's own data: `cantons=GE` also returns some items of another canton's office, and a month range returns some items published just before it. KK is therefore listed one calendar month at a time, items outside the month are skipped (counted in `kkOutOfRangeListItems`), and each item is counted under its own canton; an item returned for another canton must also be in its own canton's list, or the run fails.
- Detail: `GET /publications/{id}/xml` (sometimes gzip-encoded; Node fetch decodes it). HR01: `legalForm`, `purpose`, `publicationText`, `uid` (duplicate check only, never stored). KK02/KK03: `<debtor><selectType>company|person`, `<or731b>Yes|No` for companies, `<addition>none|legacy|refusedLegacy|custom` for persons (`custom` comes with free text such as "Succession insolvable").

Fail-closed: any item outside the requested sub-rubric, state or (HR) canton and dates, any count mismatch with the API `total`, any missing detail, any value outside the vocabulary above, or a per-canton debtor split that does not add up to the KK02 + KK03 count aborts the run before anything is written.

## Methodology (as published)

- Créations: HR01 (new entries, branches included); deletions: HR03. The balance is a flow of publications, not the change in active companies.
- Faillites: KK02 + KK03 publications (liquidation publications and suspensions for lack of assets), a count of publications, not of distinct debtors. KK01 is not used: Geneva publishes it almost systematically, other cantons rarely. Offices publish in batches, so the pages lead with rolling twelve-month totals; only the twelve-month change is shown as a percentage in the canton table. The pages note the LP revision against abusive bankruptcy in force since 1 January 2025 (public-law claims enforced by bankruptcy against registered debtors).
- Debtors: companies (of which art. 731b CO), individuals, estates (`legacy`, `refusedLegacy`, or `custom` free text naming an estate; other `custom` texts count as individuals).
- Date basis: SOGC publication date. Each publication is counted once; one listing several of the six cantons goes to the first in the order GE, VD, VS, NE, FR, JU.
- Sectors (créations): deterministic keyword classification of the purpose, indicative only, not NOGA. Bump `CLASSIFIER_VERSION` when the rules change.
- No names of people or companies are published or stored.

## Seat transfers: not published

Investigated in October 2026 and not shipped. HR02 `seatChanged` is also true for address-only changes. Arrivals are detectable in the new canton's HR02 text ("X, précédemment à <commune>", "bisher in"), but departures are not: Vaud and Jura publish no departure HR02, and the origin of an arrival is only a municipality name. Net flows per canton would need a nationwide scan in three languages plus a municipality-to-canton map.

## Guardrails and other pipelines

- `DATA_REPORT_SERIES` (`scripts/lib/articleTopicGuardrails.js`) keeps both pages out of the editorial topic rotation and duplicate checks, the stale-article refresh, `ai-ressources-update.js --refresh` and `translate-articles.js`. `DATA_REPORT_LOCALES` = fr, en, de: es/pt return 404 for these pages, and the translation validator does not count them as missing.
- `validate-latest-article-guardrails.js --slug=<slug>` validates each page in the workflow.
- The LinkedIn workflow does not auto-post articles that have a `series`; post one by hand with `workflow_dispatch` if wanted.
- The RSS feed and resource lists sort by `date`, so monthly updates do not move the pages up there.
- Never run `sync-ressources.js --apply --force-overwrite` on these files.
