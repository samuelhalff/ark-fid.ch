/**
 * Branching, sanitising and validation from the KYC schema. Pure: the browser validates each
 * screen with it, the server re-runs it on the whole submission (never trusting the client).
 */
import { EMAIL_RE, parseAmount, parseDate } from "../tax-questionnaire/format";
import { STEPS } from "./schema";
import type { Answers, Block, FieldDef, GroupDef, KycLocale, L, Row, StepDef } from "./types";

export const LIMITS = {
  text: 200,
  textarea: 4000,
  maxCheckboxes: 40,
  rowIdRe: /^[a-z0-9]{6,24}$/,
} as const;

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

const TOP_FIELDS = new Map<string, FieldDef>();
const GROUPS = new Map<string, GroupDef>();
for (const step of STEPS) {
  for (const block of step.blocks) {
    if (block.kind === "field" || block.kind === "group") {
      if (TOP_FIELDS.has(block.id) || GROUPS.has(block.id)) throw new Error(`Duplicate KYC id: ${block.id}`);
      if (block.kind === "field") TOP_FIELDS.set(block.id, block);
      else GROUPS.set(block.id, block);
    }
  }
}

/** Answers the server owns: never accepted from the browser or Cadence's prefill. */
export const SERVER_OWNED = new Set(["route"]);

export const getField = (id: string) => TOP_FIELDS.get(id);
export const getGroup = (id: string) => GROUPS.get(id);
export const stepById = (id: string) => STEPS.find((s) => s.id === id);
export const allFieldIds = () => [...TOP_FIELDS.keys(), ...GROUPS.keys()];

export const rowsOf = (a: Answers, id: string): Row[] => (Array.isArray(a[id]) ? (a[id] as Row[]) : []);

export const isStepVisible = (step: StepDef, a: Answers) => !step.showIf || step.showIf(a);
export const visibleSteps = (a: Answers) => STEPS.filter((s) => isStepVisible(s, a));
export const isBlockVisible = (block: Block, a: Answers) => !block.showIf || block.showIf(a);
export const isRowFieldVisible = (field: FieldDef, a: Answers, row: Row) => !field.showIf || field.showIf(a, row);

/** Drops the answers of hidden screens, blocks and row fields (repeated until stable). */
export function pruneHidden(input: Answers): Answers {
  let current: Answers = { ...input };
  for (let pass = 0; pass < 6; pass++) {
    const next: Answers = {};
    if (current.route !== undefined) next.route = current.route;
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
        next[block.id] = rowsOf(current, block.id).map((row) => {
          const kept: Row = { _id: row._id };
          for (const field of block.fields) if (row[field.id] !== undefined && isRowFieldVisible(field, current, row)) kept[field.id] = row[field.id];
          return kept;
        });
      }
    }
    if (JSON.stringify(next) === JSON.stringify(current)) return next;
    current = next;
  }
  return current;
}

function sanitizeValue(field: FieldDef, raw: unknown): string | string[] | undefined {
  if (field.type === "boolean") return raw === "yes" ? "yes" : undefined;
  if (field.type === "checkboxes") {
    if (!Array.isArray(raw)) return undefined;
    const allowed = new Set((field.options || []).map((o) => o.value));
    return [...new Set(raw.filter((v): v is string => typeof v === "string" && allowed.has(v)))].slice(0, LIMITS.maxCheckboxes);
  }
  if (typeof raw !== "string") return undefined;
  const max = field.maxLength || (field.type === "textarea" ? LIMITS.textarea : LIMITS.text);
  const cleaned = (field.type === "textarea" ? raw.replace(/\r\n?/g, "\n") : raw.replace(/[\r\n\t]+/g, " "))
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  return cleaned.slice(0, max + 1); // one extra character so "too_long" is still detected
}

/** Keeps only known ids with values of the right shape; server-owned ids are always dropped. */
export function sanitizeAnswers(raw: unknown): Answers {
  const out: Answers = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const input = raw as Record<string, unknown>;
  for (const [id, field] of TOP_FIELDS) {
    if (SERVER_OWNED.has(id)) continue;
    const value = sanitizeValue(field, input[id]);
    if (value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)) out[id] = value;
  }
  for (const [id, group] of GROUPS) {
    const list = input[id];
    if (!Array.isArray(list)) continue;
    const seen = new Set<string>();
    const clean: Row[] = [];
    for (const item of list.slice(0, group.maxRows)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const source = item as Record<string, unknown>;
      const rowId = typeof source._id === "string" && LIMITS.rowIdRe.test(source._id) ? source._id : "";
      if (!rowId || seen.has(rowId)) continue;
      seen.add(rowId);
      const row: Row = { _id: rowId };
      for (const field of group.fields) {
        const value = sanitizeValue(field, source[field.id]);
        if (value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0)) row[field.id] = value;
      }
      clean.push(row);
    }
    out[id] = clean;
  }
  return out;
}

const isEmpty = (value: unknown) =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);

export function validateField(field: FieldDef, value: unknown): FieldError | null {
  if (isEmpty(value)) return field.required ? "required" : null;
  if (field.type === "checkboxes") {
    if (!Array.isArray(value)) return "invalid_option";
    const allowed = new Set((field.options || []).map((o) => o.value));
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
      return n === null || Math.abs(n) > 1e13 ? "invalid_amount" : null;
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

export function validateStep(step: StepDef, a: Answers): Errors {
  const errors: Errors = {};
  if (!isStepVisible(step, a)) return errors;
  for (const block of step.blocks) {
    if (!isBlockVisible(block, a)) continue;
    if (block.kind === "field") {
      const error = validateField(block, a[block.id]);
      if (error) errors[block.id] = error;
    } else if (block.kind === "group") {
      const list = rowsOf(a, block.id);
      if (list.length < (block.minRows || 0)) errors[block.id] = "min_rows";
      for (const row of list) {
        for (const field of block.fields) {
          if (!isRowFieldVisible(field, a, row)) continue;
          const error = validateField(field, row[field.id]);
          if (error) errors[rowFieldKey(block.id, row._id, field.id)] = error;
        }
      }
    }
  }
  return errors;
}

export const validateAll = (a: Answers): Errors => Object.assign({}, ...visibleSteps(a).map((s) => validateStep(s, a)));

export const label = (text: L, locale: KycLocale) => text[locale] || text.fr;

/** Title of a group row ("DUPONT Jean": last names in capitals, house convention), or "" when empty. */
export function rowTitle(group: GroupDef, row: Row): string {
  return (group.titleFields || [])
    .map((f) => (typeof row[f] === "string" ? (f === "lastName" ? (row[f] as string).trim().toLocaleUpperCase("fr-CH") : (row[f] as string).trim()) : ""))
    .filter(Boolean)
    .join(" ");
}

/** Display value of an answer (option labels, Oui/Non) in a language. */
export function displayValue(field: FieldDef, value: unknown, locale: KycLocale): string {
  if (isEmpty(value)) return "";
  const optionLabel = (v: string) => {
    const option = field.options?.find((o) => o.value === v);
    return option ? label(option.label, locale) : v;
  };
  if (Array.isArray(value)) return value.map((v) => optionLabel(String(v))).join(", ");
  const v = String(value);
  if (field.type === "yesno") return v === "yes" ? { fr: "Oui", en: "Yes" }[locale] : v === "no" ? { fr: "Non", en: "No" }[locale] : v;
  if (field.type === "boolean") return v === "yes" ? { fr: "Oui", en: "Yes" }[locale] : v;
  if (field.type === "select" || field.type === "radio") return optionLabel(v);
  return v;
}

/** Random row id (browser and Node). */
export function newRowId(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("") + Date.now().toString(36).slice(-4);
}
