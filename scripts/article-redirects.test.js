#!/usr/bin/env node
// Duplicate-article consolidation: every removed source slug must redirect (one hop,
// both slash forms, permanent) to a target that exists in all locales.
const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const LOCALES = ["fr", "en", "de", "es", "pt"];
const ARTICLE_PREFIX = "/:locale/ressources/articles/";

const PAIRS = [
  [
    "domiciliation-suisse-entreprises-contrats-substance-risques-2026",
    "domiciliation-suisse-entreprises-2026-contrat-substance-risques",
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

      it("is absent from every locale and the target exists in every locale", () => {
        for (const locale of LOCALES) {
          const slugs = slugsFor(locale);
          assert.equal(slugs.has(source), false, `${source} still in ${locale}`);
          assert.equal(slugs.has(target), true, `${target} missing in ${locale}`);
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

