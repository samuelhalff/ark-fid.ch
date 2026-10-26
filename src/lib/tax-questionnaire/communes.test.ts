import assert from "node:assert/strict";
import test from "node:test";

import { COMMUNES, communeByBfs, searchCommunes } from "./communes.ts";
import { communeError, stepById, validateField, validateStep } from "./logic.ts";
import type { FieldDef } from "./types.ts";

const byName = (name: string) => COMMUNES.find((c) => c.name === name)!;

test("BFS list is loaded and indexed", () => {
  assert.ok(COMMUNES.length > 2000);
  const carouge = byName("Carouge (GE)");
  assert.equal(carouge.canton, "GE");
  assert.equal(communeByBfs(String(carouge.bfs))?.name, "Carouge (GE)");
  assert.equal(communeByBfs("999999"), undefined);
});

test("search is accent-insensitive, matches word starts and filters by canton", () => {
  assert.equal(searchCommunes("geneve", "GE")[0].name, "Genève");
  assert.ok(searchCommunes("chene", "GE").some((c) => c.name === "Chêne-Bougeries"));
  assert.ok(searchCommunes("bougeries", "GE").some((c) => c.name === "Chêne-Bougeries"));
  assert.ok(searchCommunes("lau", "VD").every((c) => c.canton === "VD"));
  assert.ok(searchCommunes("", "GE").length === 45);
  assert.ok(searchCommunes("zurich").some((c) => c.canton === "ZH"));
});

test("communeError: listed commune must match name and canton; free text accepted", () => {
  const geneve = byName("Genève");
  assert.equal(communeError("Genève", String(geneve.bfs), "GE"), null);
  assert.equal(communeError("Geneva", String(geneve.bfs), "GE"), "invalid_option");
  assert.equal(communeError("Genève", String(geneve.bfs), "VD"), "invalid_option");
  assert.equal(communeError("Genève", "999999", "GE"), "invalid_option");
  assert.equal(communeError("Hameau inconnu", undefined, "GE"), null);
  assert.equal(communeError("Hameau inconnu", "", "GE"), null);
});

test("start step validates the commune against its BFS number", () => {
  const step = stepById("start")!;
  const geneve = byName("Genève");
  const base = { "start.canton": "GE", "start.commune": "Genève" };
  const errorsOk = validateStep(step, { ...base, "start.communeBfs": String(geneve.bfs) });
  assert.equal(errorsOk["start.commune"], undefined);
  const errorsBad = validateStep(step, { ...base, "start.canton": "VD", "start.communeBfs": String(geneve.bfs) });
  assert.equal(errorsBad["start.commune"], "invalid_option");
  const errorsMissing = validateStep(step, { "start.canton": "GE" });
  assert.equal(errorsMissing["start.commune"], "required");
});

test("an unchecked required checkbox is reported as required", () => {
  const field: FieldDef = { kind: "field", id: "x.consent", type: "boolean", label: { fr: "x", en: "x", de: "x" }, required: true };
  assert.equal(validateField(field, undefined), "required");
  assert.equal(validateField(field, ""), "required");
  assert.equal(validateField(field, "yes"), null);
});
