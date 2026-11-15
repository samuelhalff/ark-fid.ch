import assert from "node:assert/strict";
import test from "node:test";

import { countries, isCountryName, pickCountry, searchCountries, splitCountries, typedPart } from "./countries.ts";
import { STEPS } from "./schema.ts";

test("Switzerland and its neighbours come first, in the form's language", () => {
  assert.deepEqual(countries("fr").slice(0, 6).map((c) => c.name), ["Suisse", "France", "Allemagne", "Italie", "Autriche", "Liechtenstein"]);
  assert.equal(countries("en")[0].name, "Switzerland");
  assert.ok(countries("fr").length > 240);
});

test("« sui » finds Suisse; a word's start, accents and the other language work too", () => {
  assert.equal(searchCountries("sui", "fr")[0].name, "Suisse");
  assert.equal(searchCountries("switz", "fr")[0].name, "Suisse");
  assert.equal(searchCountries("etats", "fr")[0].name, "États-Unis");
  assert.equal(searchCountries("uni", "fr").some((c) => c.name === "Royaume-Uni"), true);
  assert.deepEqual(searchCountries("  ", "fr"), []);
  assert.ok(searchCountries("a", "fr").length <= 6);
});

test("a field that takes several keeps the names before the one being typed", () => {
  assert.equal(typedPart("Suisse, Fr", true), "Fr");
  assert.equal(typedPart("Suisse, Fr", false), "Suisse, Fr");
  assert.equal(pickCountry("Suisse, Fr", "France", true), "Suisse, France");
  assert.equal(pickCountry("Fr", "France", true), "France");
  assert.equal(pickCountry("Suisse, France, sui", "Suisse", true), "France, Suisse");
  assert.equal(pickCountry("Sui", "Suisse", false), "Suisse");
  assert.deepEqual(splitCountries("Suisse, France; Italie"), ["Suisse", "France", "Italie"]);
});

test("a full name needs no suggestion; any text stays an answer", () => {
  assert.equal(isCountryName("suisse", "fr"), true);
  assert.equal(isCountryName("Sui", "fr"), false);
});

test("every nationality and country field of a person or the company offers the countries", () => {
  const fields = STEPS.flatMap((s) => s.blocks.flatMap((b) => (b.kind === "group" ? b.fields : b.kind === "field" ? [b] : [])));
  const countryFields = fields.filter((f) => !f.retired && /(^|\.)(nationality|country|taxCountry|incorporationCountry|companyTaxCountry)$/.test(f.id));
  assert.ok(countryFields.length >= 8);
  for (const f of countryFields) assert.ok(f.suggest, `${f.id} offers the countries`);
  for (const f of countryFields.filter((f) => /nationality|taxCountry$/.test(f.id) && f.id !== "a.companyTaxCountry")) assert.equal(f.suggest, "countries", `${f.id} takes several`);
});
