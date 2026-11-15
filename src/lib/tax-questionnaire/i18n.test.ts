import assert from "node:assert/strict";
import test from "node:test";
import { DOC_CATEGORIES, DOC_RULES } from "./documents.ts";
import { CANTONS, CONFESSION, CURRENCIES, HOLDER, PERMITS, RESIDENCE_OPTIONS, YES_NO_UNKNOWN } from "./options.ts";
import { ROUTER_GROUPS, ROUTER_OPTIONS, STEPS } from "./schema.ts";
import { QF_LOCALES, type L, type Option } from "./types.ts";
import { FIELD_ERRORS, SERVER_ERRORS, UI, UI2 } from "./ui.ts";

/** Sam's standing rule: every text the client can see exists in FR, EN and DE, never empty. */
function gaps(where: string, text: unknown, out: string[]) {
  if (!text || typeof text !== "object") return out.push(`${where}: missing`);
  for (const locale of QF_LOCALES) {
    const value = (text as Partial<L>)[locale];
    if (typeof value !== "string" || !value.trim()) out.push(`${where}.${locale}`);
  }
}
const optionGaps = (where: string, options: Option[] | undefined, out: string[]) =>
  (options || []).forEach((o) => {
    gaps(`${where}[${o.value}]`, o.label, out);
    if (o.hint) gaps(`${where}[${o.value}].hint`, o.hint, out);
  });

test("every UI string table entry has FR, EN and DE", () => {
  const out: string[] = [];
  for (const [table, entries] of Object.entries({ UI, UI2, SERVER_ERRORS, FIELD_ERRORS }))
    for (const [key, text] of Object.entries(entries)) gaps(`${table}.${key}`, text, out);
  assert.deepEqual(out, []);
});

test("every schema title, intro, label, help and option has FR, EN and DE", () => {
  const out: string[] = [];
  for (const step of STEPS) {
    gaps(`${step.id}.title`, step.title, out);
    if (step.intro) gaps(`${step.id}.intro`, step.intro, out);
    for (const block of step.blocks) {
      if (block.kind === "note") gaps(block.id, block.text, out);
      else gaps(block.id, block.label, out);
      if (block.kind === "field") {
        if (block.help) gaps(`${block.id}.help`, block.help, out);
        optionGaps(block.id, block.options, out);
      }
      if (block.kind === "group") {
        gaps(`${block.id}.itemLabel`, block.itemLabel, out);
        if (block.help) gaps(`${block.id}.help`, block.help, out);
        for (const f of block.fields) {
          gaps(`${block.id}/${f.id}`, f.label, out);
          if (f.help) gaps(`${block.id}/${f.id}.help`, f.help, out);
          optionGaps(`${block.id}/${f.id}`, f.options, out);
        }
      }
    }
  }
  ROUTER_GROUPS.forEach((g) => gaps(`router.group.${g.id}`, g.label, out));
  optionGaps("router", ROUTER_OPTIONS, out);
  for (const [name, options] of Object.entries({ CANTONS, CONFESSION, CURRENCIES, HOLDER, PERMITS, RESIDENCE_OPTIONS, YES_NO_UNKNOWN })) optionGaps(name, options, out);
  for (const rule of DOC_RULES) {
    gaps(`doc.${rule.id}`, rule.label, out);
    if (rule.hint) gaps(`doc.${rule.id}.hint`, rule.hint, out);
  }
  for (const [id, c] of Object.entries(DOC_CATEGORIES)) gaps(`docCategory.${id}`, c.label, out);
  assert.deepEqual(out, []);
});
