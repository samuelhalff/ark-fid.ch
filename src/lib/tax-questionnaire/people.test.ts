import assert from "node:assert/strict";
import test from "node:test";
import { choiceLabel, knownNames } from "./people.ts";
import type { Answers } from "./types.ts";

const base: Answers = { "start.household": "single", "router.items": ["employed", "companyOwner"] };

test("a company asked after the employers offers the employers not yet listed (Sam 2026-11-15)", () => {
  const a: Answers = { ...base, "work.employers": [{ _id: "e1", name: "Acme SA" }, { _id: "e2", name: " Beta  Sàrl " }], "work.companies": [{ _id: "c1", name: "acme sa" }, { _id: "c2" }] };
  const names = knownNames(a, "work.companies");
  assert.deepEqual(names.map((n) => n.value), ["Beta Sàrl"]);
  assert.equal(choiceLabel(names[0], "fr"), "C'est Beta Sàrl (employeur, indiqué plus haut)");
  assert.equal(choiceLabel(names[0], "en"), "It's Beta Sàrl (employer, given above)");
  assert.equal(choiceLabel(names[0], "de"), "Es ist Beta Sàrl (Arbeitgeber, oben angegeben)");
});

test("names of a block the client is not asked are not offered", () => {
  const a: Answers = { ...base, "router.items": ["companyOwner"], "work.employers": [{ _id: "e1", name: "Acme SA" }] };
  assert.deepEqual(knownNames(a, "work.companies"), []);
});

test("the spouse is offered for an inheritance only in a couple's form, each name once", () => {
  const couple: Answers = {
    "start.household": "couple",
    "start.spouseFirstName": "Anne",
    "start.spouseLastName": "Martin",
    "router.items": ["inheritance", "children", "dependants"],
    "family.children": [{ _id: "k1", firstName: "Léa" }, { _id: "k2", firstName: "léa" }],
    "family.dependants": [{ _id: "d1", name: "Paul Martin" }],
  };
  assert.deepEqual(knownNames(couple, "other.inheritance").map((n) => [n.value, n.role.fr]), [["Anne Martin", "conjoint"], ["Paul Martin", "personne soutenue"], ["Léa", "enfant"]]);
  const single = { ...couple, "start.household": "single" };
  assert.deepEqual(knownNames(single, "other.inheritance").map((n) => n.value), ["Paul Martin", "Léa"]);
});

test("a group without name reuse offers nothing", () => {
  assert.deepEqual(knownNames({ ...base, "work.employers": [{ _id: "e1", name: "Acme SA" }] }, "assets.banks"), []);
});
