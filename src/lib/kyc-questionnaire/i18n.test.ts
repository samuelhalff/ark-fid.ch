import assert from "node:assert/strict";
import test from "node:test";
import { KIND_LABEL } from "./holders";
import { STEPS } from "./schema";
import { FIELD_ERRORS, SERVER_ERRORS, UI } from "./ui";
import type { Block, FieldDef, GroupDef, L } from "./types";

/**
 * Sam's standing rule « fais attention à la langue de l'UI pour tout composant »: every text the
 * form shows exists in French and in English, neither empty, and the English is not the French
 * copied over. A few words are the same in both languages on purpose (listed here).
 */
const SAME_IN_BOTH = new Set(["CHF", "EUR", "USD", "GBP", "Trust", "Type", "{declarations}", "Documents", "Signature"]);

function check(where: string, text: unknown, problems: string[]) {
  const value = text as Partial<L> | undefined;
  if (!value || typeof value !== "object") return problems.push(`${where}: not a label`);
  const fr = typeof value.fr === "string" ? value.fr.trim() : "";
  const en = typeof value.en === "string" ? value.en.trim() : "";
  if (!fr) problems.push(`${where}: French missing`);
  if (!en) problems.push(`${where}: English missing`);
  if (fr && en && fr === en && !SAME_IN_BOTH.has(fr)) problems.push(`${where}: English is the French text (« ${fr} »)`);
  // A placeholder in one language must be in the other ({name}, {n}…).
  const slots = (s: string) => [...s.matchAll(/\{[a-z]+\}/gi)].map((m) => m[0]).sort().join();
  if (fr && en && slots(fr) !== slots(en)) problems.push(`${where}: placeholders differ (${slots(fr)} / ${slots(en)})`);
}

function field(where: string, f: FieldDef, problems: string[]) {
  check(`${where}.label`, f.label, problems);
  if (f.help) check(`${where}.help`, f.help, problems);
  for (const v of f.variants || []) {
    if (v.label) check(`${where}.variant.label`, v.label, problems);
    if (v.help) check(`${where}.variant.help`, v.help, problems);
  }
  for (const o of f.options || []) {
    check(`${where}.option(${o.value})`, o.label, problems);
    if (o.hint) check(`${where}.option(${o.value}).hint`, o.hint, problems);
  }
  if (f.link) check(`${where}.link`, f.link.label, problems);
}

function group(where: string, g: GroupDef, problems: string[]) {
  check(`${where}.label`, g.label, problems);
  if (g.help) check(`${where}.help`, g.help, problems);
  check(`${where}.itemLabel`, g.itemLabel, problems);
  if (g.addLabel) check(`${where}.addLabel`, g.addLabel, problems);
  for (const f of g.fields) field(`${where}.${f.id}`, f, problems);
  if (g.nested) group(`${where}.${g.nested.id}`, g.nested, problems);
}

function block(where: string, b: Block, problems: string[]) {
  if (b.kind === "field") field(where, b, problems);
  else if (b.kind === "group") group(where, b, problems);
  else if (b.kind === "note") {
    check(`${where}.text`, b.text, problems);
    if (b.link) check(`${where}.link`, b.link.label, problems);
  } else {
    check(`${where}.label`, b.label, problems);
    if (b.help) check(`${where}.help`, b.help, problems);
    if (b.prefill?.note) check(`${where}.prefill`, b.prefill.note, problems);
  }
}

test("every interface text has French and English, filled and not copied", () => {
  const problems: string[] = [];
  for (const [key, text] of Object.entries(UI)) check(`UI.${key}`, text, problems);
  for (const [key, text] of Object.entries(SERVER_ERRORS)) check(`SERVER_ERRORS.${key}`, text, problems);
  for (const [key, text] of Object.entries(FIELD_ERRORS)) check(`FIELD_ERRORS.${key}`, text, problems);
  for (const [key, text] of Object.entries(KIND_LABEL)) check(`KIND_LABEL.${key}`, text, problems);
  assert.deepEqual(problems, []);
});

test("every schema label, help and option label has French and English, filled and not copied", () => {
  const problems: string[] = [];
  for (const step of STEPS) {
    check(`${step.id}.title`, step.title, problems);
    if (step.intro) check(`${step.id}.intro`, step.intro, problems);
    for (const v of step.variants || []) check(`${step.id}.variant`, v.intro, problems);
    for (const b of step.blocks) block(`${step.id}/${b.id}`, b, problems);
  }
  assert.deepEqual(problems, []);
});

test("the check itself catches a missing or copied English", () => {
  const problems: string[] = [];
  check("x", { fr: "Bonjour", en: "" }, problems);
  check("y", { fr: "Bonjour", en: "Bonjour" }, problems);
  check("z", { fr: "{n} détenteurs", en: "holders" }, problems);
  assert.equal(problems.length, 3);
});
