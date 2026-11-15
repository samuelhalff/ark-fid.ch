import assert from "node:assert/strict";
import test from "node:test";

import { getGroup, isRowFieldVisible, validateField } from "./engine.ts";
import { STEPS } from "./schema.ts";
import { choiceLabel, contactChoices, contactFromPerson, isUnnamedRow, knownPeople, personSheetFacts, rowFromPerson } from "./people.ts";
import type { Answers, GroupDef } from "./types.ts";

const group = (id: string) => getGroup(id) as GroupDef;

const westBay: Answers = {
  route: "pm-op",
  "a.directors": [{ _id: "dir000001", lastName: "Halff", firstName: "Samuel", function: "administrateur unique", signing: "individual", nationality: "Suisse", country: "Suisse" }],
  "a.contactName": "Samuel Halff",
  "a.contactEmail": "sam@example.ch",
};

test("the sole director is offered in the 25 % list, with his role", () => {
  const people = knownPeople(westBay, "b.persons");
  assert.equal(people.length, 1, "director and contact are the same person, offered once");
  assert.equal(choiceLabel(people[0], "fr"), "C'est Samuel Halff (administrateur unique, indiqué plus haut)");
  assert.equal(choiceLabel(people[0], "en"), "It's Samuel Halff (administrateur unique, given above)");
});

test("a choice copies what both blocks ask, keeps what the entry already holds, and nothing else", () => {
  const [person] = knownPeople(westBay, "b.persons");
  const row = rowFromPerson(group("b.persons"), person, { _id: "row0000001" });
  assert.deepEqual(row, { _id: "row0000001", lastName: "Halff", firstName: "Samuel", nationality: "Suisse", country: "Suisse" });
  // An option picked for another block (signature) is never copied; the contact's e-mail goes where an e-mail is asked.
  const signer = rowFromPerson(group("i.signers"), person, { _id: "row0000002" });
  assert.deepEqual(signer, { _id: "row0000002", lastName: "Halff", firstName: "Samuel", function: "administrateur unique", email: "sam@example.ch" });
});

test("a person already in the group is not offered again; only earlier blocks count", () => {
  const filled: Answers = { ...westBay, "b.persons": [{ _id: "row0000001", lastName: "HALFF", firstName: " samuel " }] };
  assert.deepEqual(knownPeople(filled, "b.persons"), []);
  // The directors' list comes before the contact person: nothing is offered in it.
  assert.deepEqual(knownPeople(westBay, "a.directors"), []);
});

test("the contact person alone is offered, named from the house format or the usual order", () => {
  const onlyContact: Answers = { route: "pm-op", "a.contactName": "MARTIN DUPONT Anne Claire" };
  const [person] = knownPeople(onlyContact, "b.persons");
  assert.equal(person.lastName, "MARTIN DUPONT");
  assert.equal(person.firstName, "Anne Claire");
  assert.equal(choiceLabel(person, "fr"), "C'est Anne Claire MARTIN DUPONT (personne de contact, indiqué plus haut)");
  const usual = knownPeople({ ...onlyContact, "a.contactName": "Anne Martin" }, "b.persons")[0];
  assert.deepEqual([usual.firstName, usual.lastName], ["Anne", "Martin"]);
  assert.deepEqual(knownPeople({ ...onlyContact, "a.contactName": "Anne" }, "b.persons"), []);
});

test("several directors are each offered, the 25 % holders in turn are offered to the signers", () => {
  const answers: Answers = {
    ...westBay,
    "a.directors": [
      { _id: "dir000001", lastName: "Halff", firstName: "Samuel", function: "président" },
      { _id: "dir000002", lastName: "Dupont", firstName: "Anne", function: "membre" },
    ],
    "b.persons": [{ _id: "row0000001", lastName: "Halff", firstName: "Samuel", birthDate: "01.03.1980" }],
  };
  assert.deepEqual(knownPeople(answers, "b.persons").map((p) => p.lastName), ["Dupont"]);
  const signers = knownPeople(answers, "i.signers");
  assert.deepEqual(signers.map((p) => p.lastName), ["Halff", "Dupont"]);
  // The same person met in two blocks gathers both: the birth date given in B is known in I.
  assert.equal(signers[0].values.birthDate, "01.03.1980");
});

test("an entry without a name is where the choices go", () => {
  assert.equal(isUnnamedRow({ _id: "row0000001", percent: "10" }), true);
  assert.equal(isUnnamedRow({ _id: "row0000001", lastName: "Halff" }), false);
});

test("a director given by name only, chosen as a holder: the name is copied, only the missing facts are asked", () => {
  const answers: Answers = { route: "pm-op", "a.directors": [{ _id: "dir000001", lastName: "Halff", firstName: "Samuel", function: "administrateur" }] };
  const holders = group("b.persons");
  const [person] = knownPeople(answers, "b.persons");
  const row = rowFromPerson(holders, person, { _id: "row0000001" });
  const missing = holders.fields.filter((f) => isRowFieldVisible(f, answers, row) && validateField(f, row[f.id])).map((f) => f.id);
  assert.deepEqual(missing, ["birthDate", "nationality", "address", "country"]);
});

test("the review screen lists what is missing in form order, and nothing once complete", async () => {
  const { missingAnswers } = await import("./engine.ts");
  const missing = missingAnswers({ route: "pm-op" });
  assert.ok(missing.length > 3);
  assert.ok(missing.every((m) => m.stepId));
  const order = missing.map((m) => STEPS.findIndex((s) => s.id === m.stepId));
  assert.deepEqual(order, [...order].sort((x, y) => x - y));
  assert.ok(missing.some((m) => m.key === "a.incorporationDate"));
});

test("a person's birth date, saved, shows again when the panel is opened after a reload (West Bay, 2026-11-15)", () => {
  const persons = group("b.persons");
  const saved: Answers = { ...westBay, "b.holders": [{ _id: "hold00001", kind: "person", person: "per000001", percent: "100" }], "b.persons": [{ _id: "per000001", lastName: "Halff", firstName: "Samuel", nationality: "Suisse", country: "Suisse" }] };
  // New entry copied from the director: only what is missing is asked, the birth date among it.
  assert.ok(personSheetFacts(persons, saved, (saved["b.persons"] as Answers[])[0] as never, true).includes("birthDate"));
  // The client types it, the draft is saved and reloaded: the value is still in the answers…
  const filled = { ...saved, "b.persons": [{ ...(saved["b.persons"] as object[])[0], birthDate: "01.02.1970", address: "Rue du Rhône 1, 1204 Genève" }] } as Answers;
  const reloaded = JSON.parse(JSON.stringify(filled)) as Answers; // stored as JSON, read back
  const person = (reloaded["b.persons"] as unknown as Record<string, string>[])[0];
  assert.equal(person.birthDate, "01.02.1970");
  // …and the panel opened again shows it (it used to list only the missing facts: none, so no birth date).
  const shown = personSheetFacts(persons, reloaded, person as never, false);
  assert.ok(shown.includes("birthDate"), "the birth date field is shown with its value");
  assert.ok(!shown.includes("lastName"), "a known name stays the title");
});

test("the contact person block offers the director given above, copying the name; nothing once a name is typed", () => {
  const noContact: Answers = { route: "pm-op", "a.directors": westBay["a.directors"] };
  const [person, ...rest] = contactChoices(noContact);
  assert.equal(rest.length, 0);
  assert.equal(choiceLabel(person, "fr"), "C'est Samuel Halff (administrateur unique, indiqué plus haut)");
  assert.deepEqual(contactFromPerson(person), { "a.contactName": "Samuel Halff" });
  assert.deepEqual(contactChoices(westBay), []);
});
