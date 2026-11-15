import assert from "node:assert/strict";
import test from "node:test";

import { getField, getGroup, isFilled, isRowFieldVisible, validateField } from "./engine.ts";
import { choiceLabel, isUnnamedRow, knownPeople, rowFromPerson } from "./people.ts";
import type { Answers, GroupDef } from "./types.ts";

const group = (id: string) => getGroup(id) as GroupDef;

const westBay: Answers = {
  route: "pm-op",
  "a.directors": [{ _id: "dir000001", lastName: "Halff", firstName: "Samuel", function: "administrateur unique", signing: "individual", nationality: "Suisse", country: "Suisse" }],
  "a.contactName": "Samuel Halff",
  "a.contactEmail": "sam@example.ch",
  "b.q25": "yes",
};

test("the sole director is offered in the 25 % list, with his role", () => {
  const people = knownPeople(westBay, "b.controllers25");
  assert.equal(people.length, 1, "director and contact are the same person, offered once");
  assert.equal(choiceLabel(people[0], "fr"), "C'est Samuel Halff (administrateur unique, indiqué plus haut)");
  assert.equal(choiceLabel(people[0], "en"), "It's Samuel Halff (administrateur unique, given above)");
});

test("a choice copies what both blocks ask, keeps what the entry already holds, and nothing else", () => {
  const [person] = knownPeople(westBay, "b.controllers25");
  const row = rowFromPerson(group("b.controllers25"), person, { _id: "row0000001", percent: "100" });
  assert.deepEqual(row, { _id: "row0000001", percent: "100", lastName: "Halff", firstName: "Samuel", nationality: "Suisse", country: "Suisse" });
  // An option picked for another block (signature) is never copied; the contact's e-mail goes where an e-mail is asked.
  const signer = rowFromPerson(group("i.signers"), person, { _id: "row0000002" });
  assert.deepEqual(signer, { _id: "row0000002", lastName: "Halff", firstName: "Samuel", function: "administrateur unique", email: "sam@example.ch" });
});

test("a person already in the group is not offered again; only earlier blocks count", () => {
  const filled: Answers = { ...westBay, "b.controllers25": [{ _id: "row0000001", lastName: "HALFF", firstName: " samuel " }] };
  assert.deepEqual(knownPeople(filled, "b.controllers25"), []);
  // The directors' list comes before the contact person: nothing is offered in it.
  assert.deepEqual(knownPeople(westBay, "a.directors"), []);
});

test("the contact person alone is offered, named from the house format or the usual order", () => {
  const onlyContact: Answers = { route: "pm-op", "a.contactName": "MARTIN DUPONT Anne Claire", "b.q25": "yes" };
  const [person] = knownPeople(onlyContact, "b.controllers25");
  assert.equal(person.lastName, "MARTIN DUPONT");
  assert.equal(person.firstName, "Anne Claire");
  assert.equal(choiceLabel(person, "fr"), "C'est Anne Claire MARTIN DUPONT (personne de contact, indiqué plus haut)");
  const usual = knownPeople({ ...onlyContact, "a.contactName": "Anne Martin" }, "b.controllers25")[0];
  assert.deepEqual([usual.firstName, usual.lastName], ["Anne", "Martin"]);
  assert.deepEqual(knownPeople({ ...onlyContact, "a.contactName": "Anne" }, "b.controllers25"), []);
});

test("several directors are each offered, the 25 % holders in turn are offered to the signers", () => {
  const answers: Answers = {
    ...westBay,
    "a.directors": [
      { _id: "dir000001", lastName: "Halff", firstName: "Samuel", function: "président" },
      { _id: "dir000002", lastName: "Dupont", firstName: "Anne", function: "membre" },
    ],
    "b.controllers25": [{ _id: "row0000001", lastName: "Halff", firstName: "Samuel", birthDate: "01.03.1980", percent: "60" }],
  };
  assert.deepEqual(knownPeople(answers, "b.controllers25").map((p) => p.lastName), ["Dupont"]);
  const signers = knownPeople(answers, "i.signers");
  assert.deepEqual(signers.map((p) => p.lastName), ["Halff", "Dupont"]);
  // The same person met in two blocks gathers both: the birth date given in B is known in I.
  assert.equal(signers[0].values.birthDate, "01.03.1980");
});

test("an entry without a name is where the choices go", () => {
  assert.equal(isUnnamedRow({ _id: "row0000001", percent: "10" }), true);
  assert.equal(isUnnamedRow({ _id: "row0000001", lastName: "Halff" }), false);
});

test("a director given by name only, chosen as a 25 % holder: the name is copied, only the missing facts are asked", () => {
  const answers: Answers = { route: "pm-op", "b.q25": "yes", "a.directors": [{ _id: "dir000001", lastName: "Halff", firstName: "Samuel", function: "administrateur" }] };
  const holders = group("b.controllers25");
  const [person] = knownPeople(answers, "b.controllers25");
  const row = rowFromPerson(holders, person, { _id: "row0000001" });
  const missing = holders.fields.filter((f) => isRowFieldVisible(f, answers, row) && validateField(f, row[f.id])).map((f) => f.id);
  assert.deepEqual(missing, ["birthDate", "nationality", "address", "country", "percent", "holding"]);
});

test("the green check: a valid answer only, never an empty or refused one", () => {
  const date = getField("a.incorporationDate")!;
  assert.equal(isFilled(date, "01.03.2016"), true);
  assert.equal(isFilled(date, "01.03"), false);
  assert.equal(isFilled(date, "  "), false);
  assert.equal(isFilled(getField("a.contactEmail")!, "sam@"), false);
});

test("every interface text of the form exists in French and English", async () => {
  const { UI } = await import("./ui.ts");
  for (const [key, text] of Object.entries(UI)) {
    if (!text || typeof text !== "object" || !("fr" in text)) continue;
    const l = text as Record<string, unknown>;
    assert.ok(typeof l.fr === "string" && l.fr.trim(), `${key} fr`);
    assert.ok(typeof l.en === "string" && l.en.trim(), `${key} en`);
  }
});
