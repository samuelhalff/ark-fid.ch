#!/usr/bin/env node
// Duplicate-article consolidation: every removed source slug must redirect (one hop,
// both slash forms, permanent) to a target that exists in all locales.
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { LEGACY_ARTICLE_LOCALES } = require("./lib/articleLocales");

const ROOT = path.resolve(__dirname, "..");
const LOCALES = ["fr", "en", "de", "es", "pt"];
const ARTICLE_PREFIX = "/:locale/ressources/articles/";

const PAIRS = [
  [
    "domiciliation-suisse-entreprises-contrats-substance-risques-2026",
    // repointed 2026-10-26 when its former target was merged into the cluster winner
    "domiciliation-suisse-substance-risques-guide-2026",
  ],
  [
    "tva-2025-geneve-impact-pme-revision-fiscale",
    "impacts-tva-2025-geneve-pme",
  ],
  [
    "teletravail-frontaliers-2025-paie-geneve",
    "paie-frontaliers-teletravail-2026-regles-controle",
  ],
  [
    "certificat-de-salaire-suisse-2026-erreurs-frequentes-controles-checklist-employeur",
    "certificat-salaire-erreurs-controles",
  ],
  [
    "creer-sarl-ou-sa-geneve-2026-guide-complet",
    "creer-sarl-sa-geneve-criteres-capital-fiscalite-gouvernance-2026",
  ],
  // Cluster consolidation 2026-10-26 (domiciliation, outsourcing/payroll, PV)
  [
    "domiciliation-suisse-entreprises-2026-contrat-substance-risques",
    "domiciliation-suisse-substance-risques-guide-2026",
  ],
  [
    "outsourcing-administratif-pme-geneve-solutions-avantages-2025",
    "externalisation-comptabilite-geneve-pme-avantages-etapes-solutions-2025",
  ],
  [
    "reformer-l-externalisation-de-la-direction-financiere-pour-les-pme-a-geneve-en-2025",
    "outsourcing-finance-cfo-a-la-demande",
  ],
  [
    "swissdec-5-paie-geneve-obligations-2025",
    "swissdec-5-0-et-salaires-geneve-2025-points-cles",
  ],
  [
    "nouveautes-paie-geneve-2025-regles-frontaliers-teletravail",
    "paie-frontaliers-teletravail-2026-regles-controle",
  ],
  [
    "mise-en-place-ou-amelioration-du-controle-des-proces-verbaux-et-assemblees-generales-en-pme-geneve-2025-solutions-pratiques",
    "proces-verbal-assemblee-generale-obligations-redaction-suisse-2025",
  ],
];

const slugsFor = (locale) => {
  const file = path.join(ROOT, "src/translations", locale, "ressources.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  return new Set((data.Articles || []).map((a) => a.slug));
};

describe("duplicate article redirects", () => {
  let rules = [];

  before(async () => {
    const config = require(path.join(ROOT, "next.config.js"));
    rules = await config.redirects();
  });

  for (const [source, target] of PAIRS) {
    describe(source, () => {
      it("redirects permanently in both slash forms to the target", () => {
        for (const form of [
          `${ARTICLE_PREFIX}${source}/`,
          `${ARTICLE_PREFIX}${source}`,
        ]) {
          const matches = rules.filter((r) => r.source === form);
          assert.equal(matches.length, 1, `exactly one rule for ${form}`);
          assert.equal(matches[0].permanent, true);
          assert.equal(matches[0].destination, `${ARTICLE_PREFIX}${target}/`);
        }
      });

      it("is absent from every locale and the target exists in FR/EN/DE", () => {
        for (const locale of LOCALES) {
          const slugs = slugsFor(locale);
          assert.equal(slugs.has(source), false, `${source} still in ${locale}`);
          // ES/PT only carry older articles (FR/EN/DE-only policy): a target may be absent there.
          if (!LEGACY_ARTICLE_LOCALES.includes(locale)) {
            assert.equal(slugs.has(target), true, `${target} missing in ${locale}`);
          }
        }
      });

      it("does not chain (target is not itself a redirect source)", () => {
        const redirectedSlugs = new Set(
          rules
            .filter((r) => r.source.startsWith(ARTICLE_PREFIX))
            .map((r) =>
              r.source.slice(ARTICLE_PREFIX.length).replace(/\/$/, ""),
            ),
        );
        assert.equal(redirectedSlugs.has(target), false);
      });
    });
  }

  it("leaves no article content or references linking to a removed slug", () => {
    for (const locale of LOCALES) {
      const raw = fs.readFileSync(
        path.join(ROOT, "src/translations", locale, "ressources.json"),
        "utf8",
      );
      for (const [source] of PAIRS) {
        const re = new RegExp(`articles/${source}(?![\\w-])`);
        assert.equal(re.test(raw), false, `${locale} still links to ${source}`);
      }
    }
  });
});

