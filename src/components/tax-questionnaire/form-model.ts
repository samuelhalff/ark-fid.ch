"use client";

import { z } from "zod";
import { FIELD_ERRORS } from "@/src/lib/tax-questionnaire/ui";
import { getField, getGroup, label as interpolate, validateStep, type FieldError } from "@/src/lib/tax-questionnaire/logic";
import type { Answers, QfLocale, Row, StepDef } from "@/src/lib/tax-questionnaire/types";

/**
 * react-hook-form uses dots for nesting, the schema ids contain dots ("start.email"):
 * form names replace them with "__". Groups are arrays of rows (useFieldArray).
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

/** zod schema for one screen: delegates to the shared validator (same rules as the server). */
export function stepSchema(step: StepDef, locale: QfLocale) {
  return z.record(z.unknown()).superRefine((values, ctx) => {
    const answers = fromForm(values);
    const errors = validateStep(step, answers);
    for (const [key, code] of Object.entries(errors)) {
      const message = FIELD_ERRORS[code as FieldError]?.[locale] || code;
      const row = /^(.+)\[([a-z0-9]+)\]\.(.+)$/.exec(key);
      if (row) {
        const [, groupId, rowId, fieldId] = row;
        const rows = (answers[groupId] as Row[] | undefined) || [];
        const index = rows.findIndex((r) => r._id === rowId);
        ctx.addIssue({ code: "custom", path: [toName(groupId), Math.max(index, 0), fieldId], message });
      } else {
        ctx.addIssue({ code: "custom", path: [toName(key)], message });
      }
    }
  });
}

export interface Issue {
  /** react-hook-form name, "consent.<x>" or "doc:<key>": also the [data-field] of the control. */
  name: string;
  label: string;
}

type ErrorNode = { message?: string; root?: { message?: string } } & Record<string, unknown>;

/** Flattens react-hook-form errors into a list of fields (schema order is kept by the caller's step). */
export function collectIssues(errors: Record<string, unknown>, locale: QfLocale, answers: Answers): Issue[] {
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  const out: Issue[] = [];
  for (const [name, node] of Object.entries(errors || {})) {
    if (!node || typeof node !== "object") continue;
    const id = toId(name);
    const field = getField(id);
    if (field) {
      out.push({ name, label: L(field.label) });
      continue;
    }
    const group = getGroup(id);
    if (!group) continue;
    const n = node as ErrorNode;
    if (n.message || n.root?.message) out.push({ name, label: L(group.label) });
    if (Array.isArray(node)) {
      node.forEach((rowErrors, index) => {
        if (!rowErrors || typeof rowErrors !== "object") return;
        for (const fieldId of Object.keys(rowErrors as Record<string, unknown>)) {
          const f = group.fields.find((x) => x.id === fieldId);
          if (f) out.push({ name: `${name}.${index}.${fieldId}`, label: `${L(f.label)} (${L(group.itemLabel)} ${index + 1})` });
        }
      });
    }
  }
  return out;
}

/** Scrolls to a control (by its [data-field]) and focuses its first focusable element. */
export function focusField(name: string | undefined) {
  if (!name || typeof document === "undefined") return;
  const container = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(name)}"]`);
  if (!container) return;
  container.scrollIntoView({ behavior: "smooth", block: "center" });
  const target = container.querySelector<HTMLElement>("input:not([type=hidden]), textarea, button, [role=combobox], [role=radio], [role=checkbox], [tabindex]");
  (target || container).focus({ preventScroll: true });
}
