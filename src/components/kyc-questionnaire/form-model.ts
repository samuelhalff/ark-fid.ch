"use client";

import { z } from "zod";
import { getField, getGroup, label, rowsOf, rowTitle, validateStep, type FieldError } from "@/src/lib/kyc-questionnaire/engine";
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

/** zod schema for one screen: delegates to the shared validator (same rules as the server). */
export function stepSchema(step: StepDef, locale: KycLocale, route: string) {
  return z.record(z.unknown()).superRefine((values, ctx) => {
    // The route is the server's (Ark's choice): it decides the branching, never the form.
    const answers = { ...fromForm(values), route };
    const errors = validateStep(step, answers);
    for (const [key, code] of Object.entries(errors)) {
      const message = FIELD_ERRORS[code as FieldError]?.[locale] || code;
      const row = ROW_KEY.exec(key);
      if (row) {
        const [, groupId, rowId, fieldId] = row;
        const index = rowsOf(answers, groupId).findIndex((r) => r._id === rowId);
        ctx.addIssue({ code: "custom", path: [toName(groupId), Math.max(index, 0), fieldId], message });
      } else {
        ctx.addIssue({ code: "custom", path: [toName(key)], message });
      }
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
      out.push({ name, label: label(field.label, locale) });
      continue;
    }
    const group = getGroup(id);
    if (!group) continue;
    const n = node as ErrorNode;
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
  return out;
}

/** Screen holding an error key of the shared validator ("a.name" or "b.ubos[rowid].lastName"). */
export function stepOfKey(key: string): string | undefined {
  const id = ROW_KEY.exec(key)?.[1] || key;
  return STEPS.find((s) => s.blocks.some((b) => b.id === id))?.id;
}

/** Error keys of the server (422 invalid_answers) as form issues. */
export function issuesFromKeys(keys: string[], locale: KycLocale, answers: Answers): Issue[] {
  const out: Issue[] = [];
  for (const key of keys) {
    const row = ROW_KEY.exec(key);
    if (row) {
      const [, groupId, rowId, fieldId] = row;
      const index = rowsOf(answers, groupId).findIndex((r) => r._id === rowId);
      const f = getGroup(groupId)?.fields.find((x) => x.id === fieldId);
      if (index < 0 || !f) continue;
      out.push({ name: `${toName(groupId)}.${index}.${fieldId}`, label: `${label(f.label, locale)} (${rowLabel(groupId, index, answers, locale)})` });
      continue;
    }
    const block = getField(key) || getGroup(key);
    if (block) out.push({ name: toName(key), label: label(block.label, locale) });
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
