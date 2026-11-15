import assert from "node:assert/strict";
import test from "node:test";

import { chooseCountry, countries, isCountryName, pickCountry, searchCountries, splitCountries, suggestCountries, tidyCountries, typedPart } from "../questionnaire/countries.ts";
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

test("an empty field offers the common countries; a typed name its matches; a full name nothing", () => {
  assert.deepEqual(suggestCountries("", false, "fr").map((c) => c.name), ["Suisse", "France", "Italie", "Allemagne", "Autriche", "Royaume-Uni", "États-Unis", "Liechtenstein"]);
  assert.deepEqual(suggestCountries("  ", false, "en").slice(0, 2).map((c) => c.name), ["Switzerland", "France"]);
  assert.equal(suggestCountries("sui", false, "fr")[0].name, "Suisse");
  assert.deepEqual(suggestCountries("Suisse", false, "fr"), []);
  // A prefilled « Suisse » being edited: what is typed instead is searched.
  assert.equal(suggestCountries("Suiss", false, "fr")[0].name, "Suisse");
  assert.equal(suggestCountries("Fra", false, "fr")[0].name, "France");
  // Several: after « Suisse, » the common ones come back without Suisse.
  const next = suggestCountries("Suisse, ", true, "fr").map((c) => c.name);
  assert.equal(next.includes("Suisse"), false);
  assert.equal(next[0], "France");
  assert.equal(suggestCountries("Suisse, it", true, "fr")[0].name, "Italie");
});

test("a prefilled « Suisse » just entered offers the others: one replaces it, or is added when several are taken", () => {
  const single = suggestCountries("Suisse", false, "fr", true).map((c) => c.name);
  assert.equal(single.includes("Suisse"), false);
  assert.equal(single[0], "France");
  assert.equal(chooseCountry("Suisse", "France", false, "fr", true), "France");
  assert.equal(suggestCountries("Suisse, France", true, "fr", true).some((c) => ["Suisse", "France"].includes(c.name)), false);
  assert.equal(chooseCountry("Suisse", "France", true, "fr", true), "Suisse, France");
  // Once typing, a full name typed needs nothing more.
  assert.deepEqual(suggestCountries("France", false, "fr", false), []);
  assert.equal(chooseCountry("Suisse, Fr", "France", true, "fr", false), "Suisse, France");
});

test("a several-countries answer is never emptied: picking, leaving the field, autocorrected text", () => {
  const values = ["Suisse", "Suisse, ", "Suisse,", "Suisse, Fr", "Suisse, France", "Suisse; France, it", "Suisse / France", "suisse, Suisse", "France, ", " Suisse ,  "];
  const names = ["Suisse", "France", "Italie"];
  for (const value of values) {
    const before = splitCountries(value);
    // Leaving the field (blur while the list is open, or a tap racing the blur) only drops a trailing comma.
    assert.equal(splitCountries(tidyCountries(value)).join("|"), before.join("|"), "blur keeps " + value);
    assert.ok(tidyCountries(value).length > 0, "blur never empties " + value);
    for (const name of names) {
      for (const browse of [false, true]) {
        const after = chooseCountry(value, name, true, "fr", browse);
        assert.ok(after.length > 0, "pick never empties " + value);
        assert.ok(splitCountries(after).includes(name), name + " added to " + value);
        // The names before the one being typed all stay.
        const kept = splitCountries(value.slice(0, Math.max(value.lastIndexOf(","), value.lastIndexOf(";")) + 1));
        for (const k of kept) assert.ok(splitCountries(after).some((n) => n.toLowerCase() === k.toLowerCase()), k + " kept in " + after);
      }
    }
  }
  assert.equal(tidyCountries(""), "");
});
