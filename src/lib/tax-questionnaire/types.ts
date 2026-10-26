/**
 * Types of the tax questionnaire schema (tax.ark-fid.ch).
 *
 * One schema (schema.ts) drives the steps, fields, branching, the document checklist
 * (documents.ts), the Excel workbook (excel.ts) and the fr/en/de labels. Pure module: no
 * imports, usable in the browser, on the server and in node tests.
 */

export const QF_LOCALES = ["fr", "en", "de"] as const;
export type QfLocale = (typeof QF_LOCALES)[number];
export const QF_DEFAULT_LOCALE: QfLocale = "fr";

/** A label in the three languages. French is the reference (Excel, internal emails). */
export type L = Record<QfLocale, string>;
export const t = (fr: string, en: string, de: string): L => ({ fr, en, de });

/** A row of a repeating group (children, employers, accounts…). `_id` is a stable random id. */
export type Row = { _id: string } & { [field: string]: string | string[] | undefined };

/**
 * All answers, keyed by field id. Scalars are strings (amounts and dates exactly as typed,
 * normalised by format.ts), checkboxes are string arrays, groups are arrays of rows.
 */
export type AnswerValue = string | string[] | Row[] | undefined;
export type Answers = Record<string, AnswerValue>;

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "integer"
  | "money" // amount, Swiss format 1'234.50 (currency given by the label or a sibling field)
  | "percent"
  | "date" // dd.mm.yyyy
  | "yesno" // "yes" | "no"
  | "select"
  | "radio"
  | "checkboxes"
  | "taxyears" // checkboxes of tax years (latest selected = main year)
  | "boolean" // single checkbox: "yes" or absent
  | "commune"; // Swiss commune (official BFS list) or free text; BFS number in the "<id>Bfs" sibling

export interface Option {
  value: string;
  label: L;
  /** Short explanation shown under the option (router cards). */
  hint?: L;
  /** Visual group of the option (router: family, work, assets, property, other). */
  group?: string;
  showIf?: (answers: Answers) => boolean;
}

export type Predicate = (answers: Answers, row?: Row) => boolean;

export interface FieldDef {
  kind: "field";
  id: string;
  type: FieldType;
  label: L;
  help?: L;
  options?: Option[];
  required?: boolean;
  showIf?: Predicate;
  /** Text length cap (defaults: 200 for text, 4000 for textarea). */
  maxLength?: number;
  /** Layout hint for the form. */
  width?: "full" | "half";
  /** Set by the app, not shown as a question (e.g. "last return uploaded"). */
  hidden?: boolean;
  /** commune fields: id of the canton field that filters the list (top-level id, or row field id). */
  cantonField?: string;
}

export interface GroupDef {
  kind: "group";
  id: string;
  label: L;
  help?: L;
  /** Title of one row ("Employeur", "Compte"…), numbered in the form. */
  itemLabel: L;
  /** Field shown as the row title in summaries and document labels. */
  titleField?: string;
  fields: FieldDef[];
  maxRows: number;
  /** At least this many rows when the group is visible (0 by default). */
  minRows?: number;
  showIf?: Predicate;
  /** Set by Ark (prepared case), not shown as a question. */
  hidden?: boolean;
}

export interface NoteDef {
  kind: "note";
  id: string;
  text: L;
  tone?: "info" | "warning";
  showIf?: Predicate;
}

export interface HeadingDef {
  kind: "heading";
  id: string;
  label: L;
  showIf?: Predicate;
}

export type Block = FieldDef | GroupDef | NoteDef | HeadingDef;

export interface StepDef {
  id: string;
  title: L;
  intro?: L;
  /** Excel sheet name (French, ≤ 31 characters, no []:*?/\). */
  sheet: string;
  showIf?: (answers: Answers) => boolean;
  blocks: Block[];
  /** Screens with their own UI: base documents upload, documents checklist, review. */
  special?: "baseDocs" | "documents" | "review";
}

/** Document checklist categories; `folder` is the SharePoint sub-folder (French, stable). */
export type DocCategory =
  | "base"
  | "personal"
  | "work"
  | "pensions"
  | "wealth"
  | "property"
  | "debts"
  | "deductions"
  | "admin"
  | "other"
  | "extra";

export interface DocRule {
  id: string;
  category: DocCategory;
  /** Label with placeholders: {year}, {prevYear}, {row} (row title) and {row:<fieldId>}. */
  label: L;
  hint?: L;
  when?: (answers: Answers) => boolean;
  /** One document per row of this group (rows filtered by whenRow). */
  forEach?: string;
  whenRow?: (row: Row, answers: Answers) => boolean;
  /** Asked early, on the "key documents" screen. */
  base?: boolean;
}

export interface DocItem {
  /** Stable key: rule id, or `<rule id>:<row id>`. */
  key: string;
  /** Short code (6 hex) put in the uploaded file names; derived from the key. */
  code: string;
  ruleId: string;
  category: DocCategory;
  label: L;
  hint?: L;
  base?: boolean;
  /** Arrears: the earlier tax year this item belongs to (its own year folder). */
  year?: number;
}

export type DocStatus = "uploaded" | "later" | "na" | "missing";
