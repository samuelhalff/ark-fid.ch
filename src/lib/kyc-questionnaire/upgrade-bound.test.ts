import assert from "node:assert/strict";
import test from "node:test";

import { cappedLists, sanitizeAnswers } from "./engine";
import { upgradeAnswers } from "./upgrade";
import type { Answers } from "./types";

test("a huge a.signatories list is merged in linear time (S-F2)", () => {
  const raw = { "a.signatories": Array.from({ length: 100_000 }, () => ({})) } as Answers;
  const started = Date.now();
  const out = upgradeAnswers(raw);
  assert.equal((out["a.directors"] as unknown[]).length, 100_000);
  assert.ok(Date.now() - started < 2000, "no quadratic scan");
});

test("sanitizeAnswers caps raw lists before the upgrade walks them (S-F2)", () => {
  const raw = { "a.signatories": Array.from({ length: 170_000 }, () => ({})), "a.directors": Array.from({ length: 170_000 }, () => ({})) };
  assert.ok(cappedLists(raw as Answers)["a.signatories"]!.length <= 40);
  const started = Date.now();
  sanitizeAnswers(raw);
  assert.ok(Date.now() - started < 1000);
});

test("signatories are still merged with the directors they match (S-F2)", () => {
  const out = upgradeAnswers({
    "a.directors": [{ _id: "dir001aaa", lastName: "Dupont", firstName: "Anne" }],
    "a.signatories": [{ _id: "sig001aaa", lastName: "DUPONT", firstName: "Anne", signing: "alone" }, { _id: "sig002aaa", lastName: "Martin", firstName: "Luc" }],
  } as Answers);
  const people = out["a.directors"] as Array<Record<string, unknown>>;
  assert.equal(people.length, 2);
  assert.equal(people[0].signing, "alone");
});
