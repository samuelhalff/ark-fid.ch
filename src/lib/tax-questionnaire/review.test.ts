import assert from "node:assert/strict";
import test from "node:test";
import { getField, isFilled, missingAnswers, stepOfKey } from "./logic.ts";
import { STEPS } from "./schema.ts";
import type { Answers } from "./types.ts";

test("isFilled: an accepted answer only (green check), never a single checkbox", () => {
  const email = getField("start.email")!;
  assert.equal(isFilled(email, "anne@example.ch"), true);
  assert.equal(isFilled(email, "anne@"), false);
  assert.equal(isFilled(email, "  "), false);
  const date = getField("start.avisDate")!;
  assert.equal(isFilled(date, "01.02.2026"), true);
  assert.equal(isFilled(date, "31.02.2026"), false);
  assert.equal(isFilled({ kind: "field", id: "x", type: "boolean", label: { fr: "x", en: "x", de: "x" } }, "yes"), false);
});

test("stepOfKey finds the screen of a field and of a row field", () => {
  assert.equal(stepOfKey("start.email"), "start");
  assert.equal(stepOfKey("work.employers[abc123].name"), "work");
  assert.equal(stepOfKey("nope"), undefined);
});

test("missingAnswers lists what blocks sending, in the form's order (review screen, Sam 2026-11-15)", () => {
  const a: Answers = { "start.household": "single", "router.items": ["employed"], "work.employers": [{ _id: "e1" }] };
  const missing = missingAnswers(a);
  assert.ok(missing.length > 0);
  assert.ok(missing.some((m) => m.key === "start.email" && m.stepId === "start"));
  assert.ok(missing.some((m) => m.key === "work.employers[e1].name" && m.stepId === "work"));
  const order = STEPS.map((s) => s.id);
  const positions = missing.map((m) => order.indexOf(m.stepId));
  assert.deepEqual(positions, [...positions].sort((x, y) => x - y));
});

test("every country field offers the countries as typed", () => {
  const countryFields: string[] = [];
  for (const step of STEPS)
    for (const block of step.blocks) {
      const fields = block.kind === "field" ? [block] : block.kind === "group" ? block.fields : [];
      for (const f of fields) if (f.type === "text" && /^(Pays|Nouveau pays)\b/.test(f.label.fr) && !f.suggest) countryFields.push(`${block.id}/${f.id}`);
    }
  assert.deepEqual(countryFields, []);
});
