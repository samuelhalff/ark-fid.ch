#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const {
  describeTopic,
  detectTopic,
} = require("./lib/articleTopicGuardrails");
const {
  EVERGREEN_TOPICS,
  guessCategoryFromText,
  pickOutlineForCategory,
} = require("./lib/trends");
const {
  buildTopicGuidanceForAgent,
  getAvailableTopics,
  validateArticleTopicAgainstAvailable,
} = require("./lib/topicSelector");

const treasuryArticle = {
  slug: "tresorerie-pme-2026-franc-fort-retards-paiement",
  title: "Trésorerie PME en 2026 : 7 réflexes face au franc fort, à l'énergie et aux retards de paiement",
  description: "Cash-flow, budget, relances clients et pilotage de trésorerie.",
};

assert.equal(
  detectTopic(treasuryArticle),
  "finance",
  "paiement/cash-flow/trésorerie should classify as finance, not payroll",
);

assert.equal(
  detectTopic({
    slug: "revision-comptes-pme-controle-ordinaire-restreint",
    title: "Révision des comptes en Suisse : contrôle ordinaire ou restreint pour PME",
  }),
  "audit",
  "révision/audit topics should classify as audit",
);

assert.equal(describeTopic("audit"), "Audit & révision");

assert.equal(
  guessCategoryFromText("Révision restreinte en Suisse pour PME").category,
  "audit",
  "trend/category detection should support audit topics",
);

assert.deepEqual(pickOutlineForCategory("audit"), [
  "H2 seuils et obligations",
  "H2 contrôle ordinaire vs restreint",
  "H2 préparation du dossier",
  "H2 erreurs fréquentes",
  "FAQ",
]);

assert.ok(
  EVERGREEN_TOPICS.some((topic) => topic.category === "audit"),
  "evergreen rotation should include audit/révision topics",
);

const requiredLeadGenTopics = [
  "frontaliers-teletravail-paie-suisse-france",
  "tva-prestations-internationales-suisse-reverse-charge",
  "migration-odoo-depuis-excel-legacy-erp",
  "debiteurs-recouvrement-retards-paiement-pme",
  "archivage-numerique-comptable-suisse-pme",
  "succursale-ou-filiale-suisse-entreprise-etrangere",
  "ayants-droit-economiques-registre-actions-suisse",
  "succession-entrepreneur-pme-suisse-fiscalite",
];

for (const slug of requiredLeadGenTopics) {
  assert.ok(
    EVERGREEN_TOPICS.some((topic) => topic.topic === slug),
    `evergreen rotation should include ${slug}`,
  );
}

const rotationFixture = {
  Articles: [
    {
      slug: "revision-comptes-pme-controle-ordinaire-restreint",
      title: "Révision des comptes en Suisse: contrôle ordinaire ou restreint pour PME",
      date: "2026-05-01",
    },
    {
      slug: "paie-salaires-cotisations-avs-lpp-laa",
      title: "Paie et salaires: cotisations AVS, LPP et LAA",
      date: "2026-05-02",
    },
  ],
};
const availableTopics = getAvailableTopics(rotationFixture, ["audit"], 2);
assert.ok(
  !availableTopics.availableTopics.some((topic) => topic.topic === "audit"),
  "topic selector should exclude topics already in the rotation window",
);
assert.ok(
  buildTopicGuidanceForAgent(availableTopics).includes("THÈMES DISPONIBLES"),
  "topic guidance should show the agent the valid topic pool",
);
assert.equal(
  validateArticleTopicAgainstAvailable(
    {
      slug: "audit-revision-pme-geneve",
      title: "Audit et révision des PME genevoises",
    },
    availableTopics,
  ).valid,
  false,
  "topic validator should reject generated articles outside the valid topic pool",
);

console.log("Topic diversity policy tests passed");
