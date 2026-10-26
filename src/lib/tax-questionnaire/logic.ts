/**
 * Branching, sanitising and validation from the schema. Pure: the browser validates each step
 * with it, the server re-runs it on the whole submission (never trusting the client).
 */
import { computeChecklist, taxYearOf, withYear } from "./documents";
import { EMAIL_RE, parseAmount, parseDate } from "./format";
import { STEPS } from "./schema";
import type { Answers, Block, DocItem, FieldDef, GroupDef, L, QfLocale, Row, StepDef } from "./types";

export const LIMITS = {
  text: 200,
  textarea: 4000,
  maxCheckboxes: 40,
  rowIdRe: /^[a-z0-9]{6,24}$/,
} as const;

/** Error codes; the UI maps them to messages. */
export type FieldError =
  | "required"
  | "invalid_email"
  | "invalid_date"
  | "invalid_amount"
  | "invalid_number"
  | "invalid_percent"
  | "invalid_phone"
  | "invalid_option"
  | "too_long"
  | "min_rows";

export type Errors = Record<string, FieldError>;

// ---- lookups ---------------------------------------------------------------------------------------

const TOP_FIELDS = new Map<string, FieldDef>();
const GROUPS = new Map<string, GroupDef>();
const OWNER_STEP = new Map<string, string>();
for (const step of STEPS) {
  for (const block of step.blocks) {
    if (block.kind === "field") TOP_FIELDS.set(block.id, block);
    if (block.kind === "group") GROUPS.set(block.id, block);
    if (block.kind === "field" || block.kind === "group") {
      if (OWNER_STEP.has(block.id)) throw new Error(`Duplicate questionnaire id: ${block.id}`);
      OWNER_STEP.set(block.id, step.id);
    }
  }
}
export const getGroup = (id: string) => GROUPS.get(id);
export const getField = (id: string) => TOP_FIELDS.get(id);
export const stepById = (id: string) => STEPS.find((step) => step.id === id);

/** Title field of each group (document labels use it). */
export const TITLE_FIELDS: Record<string, string | undefined> = Object.fromEntries(
  [...GROUPS.values()].map((group) => [group.id, group.titleField]),
);

// ---- visibility ------------------------------------------------------------------------------------

export const isStepVisible = (step: StepDef, a: Answers) => !step.showIf || step.showIf(a);
export const visibleSteps = (a: Answers) => STEPS.filter((step) => isStepVisible(step, a));
export const isBlockVisible = (block: Block, a: Answers) => !block.showIf || block.showIf(a);
export const isRowFieldVisible = (field: FieldDef, a: Answers, row: Row) => !field.showIf || field.showIf(a, row);

const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);

/**
 * Drops the answers of hidden steps, blocks and row fields. Repeated until stable, because a
 * predicate may depend on an answer that is itself hidden.
 */
export function pruneHidden(input: Answers): Answers {
  let current: Answers = { ...input };
  for (let pass = 0; pass < 6; pass++) {
    const next: Answers = {};
    for (const step of STEPS) {
      if (!isStepVisible(step, current)) continue;
      for (const block of step.blocks) {
        if (block.kind !== "field" && block.kind !== "group") continue;
        if (!isBlockVisible(block, current)) continue;
        const value = current[block.id];
        if (value === undefined) continue;
        if (block.kind === "field") {
          next[block.id] = value;
          continue;
        }
        next[block.id] = rows(value).map((row) => {
          const kept: Row = { _id: row._id };
          for (const field of block.fields) {
            if (row[field.id] !== undefined && isRowFieldVisible(field, current, row)) kept[field.id] = row[field.id];
          }
          return kept;
        });
      }
    }
    if (JSON.stringify(next) === JSON.stringify(current)) return next;
    current = next;
  }
  return current;
}

// ---- sanitising (server input) --------------------------------------------------------------------

function allowedValues(field: FieldDef): Set<string> {
  if (field.type === "taxyears") return new Set(taxYearChoices().map(String));
  return new Set((field.options || []).map((o) => o.value));
}

function sanitizeValue(field: FieldDef, raw: unknown): string | string[] | undefined {
  if (field.type === "boolean") return raw === "yes" ? "yes" : undefined;
  if (field.type === "checkboxes" || field.type === "taxyears") {
    if (!Array.isArray(raw)) return undefined;
    const allowed = allowedValues(field);
    const values = [...new Set(raw.filter((v): v is string => typeof v === "string" && allowed.has(v)))];
    return values.slice(0, LIMITS.maxCheckboxes);
  }
  if (typeof raw !== "string") return undefined;
  const max = field.maxLength || (field.type === "textarea" ? LIMITS.textarea : LIMITS.text);
  // Keep newlines in text areas only; drop other control characters.
  const cleaned = (field.type === "textarea" ? raw.replace(/\r\n?/g, "\n") : raw.replace(/[\r\n\t]+/g, " "))
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  return cleaned.slice(0, max + 1); // one extra char so "too_long" is still detected
}

/** Keeps only known ids with values of the right shape (unknown keys and junk are dropped). */
export function sanitizeAnswers(raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const input = raw as Record<string, unknown>;
  for (const [id, field] of TOP_FIELDS) {
    const value = sanitizeValue(field, input[id]);
    if (value !== undefined && value !== "") out[id] = value;
  }
  for (const [id, group] of GROUPS) {
    const list = input[id];
    if (!Array.isArray(list)) continue;
    const seen = new Set<string>();
    const cleanRows: Row[] = [];
    for (const item of list.slice(0, group.maxRows)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const source = item as Record<string, unknown>;
      const rowId = typeof source._id === "string" && LIMITS.rowIdRe.test(source._id) ? source._id : "";
      if (!rowId || seen.has(rowId)) continue;
      seen.add(rowId);
      const row: Row = { _id: rowId };
      for (const field of group.fields) {
        const value = sanitizeValue(field, source[field.id]);
        if (value !== undefined && value !== "") row[field.id] = value;
      }
      cleanRows.push(row);
    }
    out[id] = cleanRows;
  }
  return out;
}

// ---- validation ------------------------------------------------------------------------------------

/** Tax years offered: the previous year first, then arrears, then the current year (departures). */
export function taxYearChoices(now = new Date()): number[] {
  const current = now.getFullYear();
  return [current - 1, current - 2, current - 3, current - 4, current - 5, current];
}

const isEmpty = (value: unknown) =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);

export function validateField(field: FieldDef, value: unknown, now = new Date()): FieldError | null {
  if (isEmpty(value)) return field.required ? "required" : null;
  if (field.type === "checkboxes" || field.type === "taxyears") {
    if (!Array.isArray(value)) return "invalid_option";
    const allowed = field.type === "taxyears" ? new Set(taxYearChoices(now).map(String)) : allowedValues(field);
    return value.every((v) => allowed.has(v)) ? null : "invalid_option";
  }
  if (field.type === "boolean") return value === "yes" ? null : "invalid_option";
  if (typeof value !== "string") return "invalid_option";
  const max = field.maxLength || (field.type === "textarea" ? LIMITS.textarea : LIMITS.text);
  if (value.length > max) return "too_long";
  switch (field.type) {
    case "email":
      return EMAIL_RE.test(value) ? null : "invalid_email";
    case "tel":
      return /^\+?[0-9 ()./-]{6,30}$/.test(value) ? null : "invalid_phone";
    case "date":
      return parseDate(value) ? null : "invalid_date";
    case "money": {
      const n = parseAmount(value);
      return n === null || Math.abs(n) > 1e12 ? "invalid_amount" : null;
    }
    case "integer":
      return /^\d{1,9}$/.test(value.replace(/['’\s]/g, "")) ? null : "invalid_number";
    case "percent": {
      const n = parseAmount(value.replace("%", ""));
      return n === null || n < 0 || n > 100 ? "invalid_percent" : null;
    }
    case "yesno":
      return value === "yes" || value === "no" ? null : "invalid_option";
    case "select":
    case "radio":
      return (field.options || []).some((o) => o.value === value) ? null : "invalid_option";
    default:
      return null;
  }
}

export const rowFieldKey = (groupId: string, rowId: string, fieldId: string) => `${groupId}[${rowId}].${fieldId}`;

/** Validates the visible blocks of one step. */
export function validateStep(step: StepDef, a: Answers, now = new Date()): Errors {
  const errors: Errors = {};
  if (!isStepVisible(step, a)) return errors;
  for (const block of step.blocks) {
    if (!isBlockVisible(block, a)) continue;
    if (block.kind === "field") {
      const error = validateField(block, a[block.id], now);
      if (error) errors[block.id] = error;
    } else if (block.kind === "group") {
      const list = rows(a[block.id]);
      if (list.length < (block.minRows || 0)) errors[block.id] = "min_rows";
      for (const row of list) {
        for (const field of block.fields) {
          if (!isRowFieldVisible(field, a, row)) continue;
          const error = validateField(field, row[field.id], now);
          if (error) errors[rowFieldKey(block.id, row._id, field.id)] = error;
        }
      }
    }
  }
  return errors;
}

export function validateAll(a: Answers, now = new Date()): Errors {
  return Object.assign({}, ...visibleSteps(a).map((step) => validateStep(step, a, now)));
}

// ---- labels and checklist -------------------------------------------------------------------------

export function label(text: L, locale: QfLocale, a: Answers): string {
  return withYear(text, taxYearOf(a))[locale];
}

/** The document checklist for these answers (hidden parts pruned first). */
export function checklistFor(a: Answers): DocItem[] {
  return computeChecklist(pruneHidden(a), TITLE_FIELDS);
}

/** Display value of a field answer (labels of options, Oui/Non…) in a language. */
export function displayValue(field: FieldDef, value: unknown, locale: QfLocale, a: Answers): string {
  if (isEmpty(value)) return "";
  const optionLabel = (v: string) => {
    const option = field.options?.find((o) => o.value === v);
    return option ? label(option.label, locale, a) : v;
  };
  if (Array.isArray(value)) return value.map((v) => optionLabel(String(v))).join(", ");
  const v = String(value);
  if (field.type === "yesno") return v === "yes" ? { fr: "Oui", en: "Yes", de: "Ja" }[locale] : v === "no" ? { fr: "Non", en: "No", de: "Nein" }[locale] : v;
  if (field.type === "select" || field.type === "radio") return optionLabel(v);
  return v;
}

/** Random row id (browser and Node). */
export function newRowId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
}
