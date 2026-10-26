"use client";

import { z } from "zod";
import { FIELD_ERRORS } from "@/src/lib/tax-questionnaire/ui";
import { validateStep, type FieldError } from "@/src/lib/tax-questionnaire/logic";
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
