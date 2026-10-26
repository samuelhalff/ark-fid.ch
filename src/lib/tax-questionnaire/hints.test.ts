import assert from "node:assert/strict";
import test from "node:test";
import { DOC_RULES } from "./documents.ts";
import { matchInstitution, requestTemplate, rowTitleOf, whereToFind } from "./hints.ts";
import type { DocItem } from "./types.ts";

const item = (ruleId: string, fr: string): DocItem => ({
  key: ruleId,
  code: "abcdef",
  ruleId,
  category: "wealth",
  label: { fr, en: fr, de: fr },
});

test("every document rule has a where-to-find hint in fr/en/de", () => {
  for (const rule of DOC_RULES) {
    for (const locale of ["fr", "en", "de"] as const) {
      assert.ok(whereToFind(item(rule.id, rule.label.fr), locale).length > 10, `${rule.id} ${locale}`);
    }
  }
  assert.ok(whereToFind(item("older-years", "Documents 2023"), "fr").length > 10);
});

test("institutions are matched on the row title, accents and case ignored", () => {
  assert.equal(matchInstitution("Banque Cantonale de Genève")?.name, "BCGE");
  assert.equal(matchInstitution("ubs switzerland ag")?.name, "UBS");
  assert.equal(matchInstitution("Crédit Suisse")?.name, "UBS");
  assert.equal(matchInstitution("Zürcher Kantonalbank")?.name, "ZKB");
  assert.equal(matchInstitution("Zurich Versicherung")?.name, "Zurich");
  assert.equal(matchInstitution("Swiss Life AG")?.name, "Swiss Life");
  assert.equal(matchInstitution("Banque Alpha"), null);
  assert.equal(matchInstitution("Raxa"), null); // no partial-word match on "axa"
  assert.equal(rowTitleOf(item("bank", "Relevé fiscal au 31.12.2025 – UBS")), "UBS");
});

test("bank hint becomes institution-specific", () => {
  const hint = whereToFind(item("bank", "Relevé fiscal au 31.12.2025 (soldes) – Crédit Suisse"), "fr");
  assert.match(hint, /^UBS : /);
  assert.match(hint, /Credit Suisse/);
  const generic = whereToFind(item("salary", "Certificat de salaire 2025 – UBS"), "fr");
  assert.doesNotMatch(generic, /^UBS/);
});

test("request template names the document, the year and the client", () => {
  const t = requestTemplate(item("p3a", "Attestation(s) de versement au 3e pilier A 2025"), "de", "Claire Dupont");
  assert.match(t.subject, /2025/);
  assert.match(t.body, /Attestation\(s\) de versement/);
  assert.match(t.body, /Claire Dupont$/);
});
