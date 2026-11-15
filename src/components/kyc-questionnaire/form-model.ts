"use client";

import { z } from "zod";
import { fieldText, getField, getGroup, label, nestedKeyLabel, nestedRows, rowsOf, rowTitle, validateStep, type FieldError } from "@/src/lib/kyc-questionnaire/engine";
import { STEPS } from "@/src/lib/kyc-questionnaire/schema";
import { FIELD_ERRORS } from "@/src/lib/kyc-questionnaire/ui";
import type { Answers, KycLocale, Row, StepDef } from "@/src/lib/kyc-questionnaire/types";

/**
 * react-hook-form uses dots for nesting, the schema ids contain dots ("a.lastName"): form names
 * replace them with "__". Groups are arrays of rows (useFieldArray), each row keeps its `_id`.
 */
export type FormValues = Record<string, unknown>;

export const toName = (id: string) => id.replace(/\./g, "__");
export const toId = (name: string) => name.replace(/__/g, ".");

export function toForm(answers: Answers): FormValues {
  const out: FormValues = {};
  for (const [id, value] of Object.entries(answers)) out[toName(id)] = Array.isArray(value) ? value.map((v) => (v && typeof v === "object" ? { ...(v as Row) } : v)) : value;
  return out;
}

export function fromForm(values: FormValues): Answers {
  const out: Answers = {};
  for (const [name, value] of Object.entries(values || {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      out[toId(name)] = value.map((v) => {
        if (!v || typeof v !== "object") return v;
        const row: Record<string, unknown> = {};
        for (const [k, rv] of Object.entries(v as Record<string, unknown>)) if (rv !== undefined && rv !== null && rv !== "") row[k] = rv;
        return row;
      }) as Answers[string];
    } else {
      out[toId(name)] = value as Answers[string];
    }
  }
  return out;
}

const ROW_KEY = /^(.+)\[([a-z0-9]+)\]\.(.+)$/;

/**
 * react-hook-form path of an error key, nested groups included: "b.holders[r1].holders[r2].percent"
 * → ["b__holders", 0, "holders", 1, "percent"]. Null when a row is not (or no longer) there.
 */
export function keyPath(key: string, answers: Answers): (string | number)[] | null {
  const parts = key.split(/\[([a-z0-9]+)\]\./);
  const path: (string | number)[] = [toName(parts[0])];
  let rows = rowsOf(answers, parts[0]);
  for (let i = 1; i < parts.length; i += 2) {
    const index = rows.findIndex((r) => r._id === parts[i]);
    if (index < 0) return null;
    path.push(index, parts[i + 1]);
    rows = nestedRows(rows[index], parts[i + 1]);
  }
  return path;
}

/** Answers edited by the holders component of section B: their issues point to it. */
const HOLDER_BLOCKS = new Set(["b.holders", "b.persons", "b.holdersUnknown", "b.qOther", "b.controlPersons", "b.controlHow", "b.managers"]);

/** zod schema for one screen: delegates to the shared validator (same rules as the server). */
export function stepSchema(step: StepDef, locale: KycLocale, route: string) {
  return z.record(z.unknown()).superRefine((values, ctx) => {
    // The route is the server's (Ark's choice): it decides the branching, never the form.
    const answers = { ...fromForm(values), route };
    const errors = validateStep(step, answers);
    for (const [key, code] of Object.entries(errors)) {
      const message = FIELD_ERRORS[code as FieldError]?.[locale] || code;
      ctx.addIssue({ code: "custom", path: keyPath(key, answers) || [toName(key.split("[")[0])], message });
    }
  });
}

export interface Issue {
  /** react-hook-form name, or "doc:<key>": also the [data-field] of the control. */
  name: string;
  label: string;
}

type ErrorNode = { message?: string; root?: { message?: string } } & Record<string, unknown>;

/** "Directeur 2 · DUPONT Jean": a row's number and, when known, its title. */
function rowLabel(groupId: string, index: number, answers: Answers, locale: KycLocale): string {
  const group = getGroup(groupId);
  if (!group) return "";
  const row = rowsOf(answers, groupId)[index];
  const title = row ? rowTitle(group, row) : "";
  return `${label(group.itemLabel, locale)} ${index + 1}${title ? ` · ${title}` : ""}`;
}

/** Flattens react-hook-form errors into a list of fields (schema order is kept by the caller's step). */
export function collectIssues(errors: Record<string, unknown>, locale: KycLocale, answers: Answers): Issue[] {
  const out: Issue[] = [];
  for (const [name, node] of Object.entries(errors || {})) {
    if (!node || typeof node !== "object") continue;
    const id = toId(name);
    const field = getField(id);
    if (field) {
      out.push({ name, label: label(fieldText(field, answers).label, locale) });
      continue;
    }
    const group = getGroup(id);
    if (!group) continue;
    const n = node as ErrorNode;
    if (HOLDER_BLOCKS.has(id)) {
      // The holders tree and its persons are edited in their own component: one issue, pointing to it.
      out.push({ name: toName("b.holders"), label: label(getGroup("b.holders")!.label, locale) });
      continue;
    }
    if (n.message || n.root?.message) out.push({ name, label: label(group.label, locale) });
    if (Array.isArray(node)) {
      node.forEach((rowErrors, index) => {
        if (!rowErrors || typeof rowErrors !== "object") return;
        for (const fieldId of Object.keys(rowErrors as Record<string, unknown>)) {
          const f = group.fields.find((x) => x.id === fieldId);
          if (f) out.push({ name: `${name}.${index}.${fieldId}`, label: `${label(f.label, locale)} (${rowLabel(id, index, answers, locale)})` });
        }
      });
    }
  }
  // One line per place: the holders component gathers its own answers.
  return out.filter((issue, index) => out.findIndex((o) => o.name === issue.name && o.label === issue.label) === index);
}

export { stepOfKey } from "@/src/lib/kyc-questionnaire/engine";

/** Error keys of the server (422 invalid_answers) as form issues. */
export function issuesFromKeys(keys: string[], locale: KycLocale, answers: Answers): Issue[] {
  const out: Issue[] = [];
  for (const key of keys) {
    if (HOLDER_BLOCKS.has(key.split("[")[0])) {
      // « Part détenue (Holding X SA › Mme Y) »: found in the holders component.
      const worded = key.includes("[") ? nestedKeyLabel(key, answers, locale) : null;
      const field = getField(key);
      out.push({ name: toName("b.holders"), label: worded || label(field ? fieldText(field, answers).label : getGroup(key)?.label || getGroup("b.holders")!.label, locale) });
      continue;
    }
    const row = ROW_KEY.exec(key);
    if (row) {
      const [, groupId, rowId, fieldId] = row;
      const index = rowsOf(answers, groupId).findIndex((r) => r._id === rowId);
      const f = getGroup(groupId)?.fields.find((x) => x.id === fieldId);
      if (index < 0 || !f) continue;
      out.push({ name: `${toName(groupId)}.${index}.${fieldId}`, label: `${label(f.label, locale)} (${rowLabel(groupId, index, answers, locale)})` });
      continue;
    }
    const field = getField(key);
    const block = field || getGroup(key);
    if (block) out.push({ name: toName(key), label: label(field ? fieldText(field, answers).label : block.label, locale) });
  }
  return out;
}

/** Scrolls to a control (by its [data-field]) and focuses its first focusable element. */
export function focusField(name: string | undefined) {
  if (!name || typeof document === "undefined") return;
  const container = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(name)}"]`);
  if (!container) return;
  container.scrollIntoView({ behavior: "smooth", block: "center" });
  const target = container.querySelector<HTMLElement>("input:not([type=hidden]):not([type=file]), textarea, button, [role=combobox], [role=radio], [role=checkbox], [tabindex]");
  (target || container).focus({ preventScroll: true });
}
