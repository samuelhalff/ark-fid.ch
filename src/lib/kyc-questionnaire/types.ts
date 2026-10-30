/**
 * Types of the KYC questionnaire (kyc.ark-fid.ch).
 *
 * One schema (schema.ts) drives the screens, the branching per route (person, operating company,
 * non-operating company), the documents of section H and the PDF to sign. Pure module: usable in
 * the browser, on the server and in node tests.
 */

export const KYC_LOCALES = ["fr", "en"] as const;
export type KycLocale = (typeof KYC_LOCALES)[number];
export const KYC_DEFAULT_LOCALE: KycLocale = "fr";

/** A label in both languages. French is the reference (internal files). */
export type L = Record<KycLocale, string>;
export const t = (fr: string, en: string): L => ({ fr, en });

/**
 * Form chosen by Ark before the link exists (Henri's tree, 29.10.2026). The client never picks it.
 * - pp: natural person;
 * - pm-op: legal entity with an operating activity (art. 2a al. 3 LBA, controlling persons);
 * - pm-nonop: non-operating legal entity, in particular a domiciliary company (art. 2a al. 6 LBA,
 *   beneficial owners of the assets without threshold).
 * Trusts, foundations and other complex structures stay outside the web form (manual route).
 */
export const KYC_ROUTES = ["pp", "pm-op", "pm-nonop"] as const;
export type KycRoute = (typeof KYC_ROUTES)[number];

/** A row of a repeating group (directors, beneficial owners…). `_id` is a stable random id. */
export type Row = { _id: string } & { [field: string]: string | string[] | undefined };

export type AnswerValue = string | string[] | Row[] | undefined;
export type Answers = Record<string, AnswerValue>;

export type FieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "integer"
  | "money"
  | "percent"
  | "date" // dd.mm.yyyy
  | "yesno"
  | "select"
  | "radio"
  | "checkboxes"
  | "boolean"; // single checkbox: "yes" or absent

export interface Option {
  value: string;
  label: L;
  hint?: L;
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
  maxLength?: number;
  width?: "full" | "half";
}

export interface GroupDef {
  kind: "group";
  id: string;
  label: L;
  help?: L;
  itemLabel: L;
  /** Row fields joined to title a row (summaries, PDF), e.g. "lastName firstName". */
  titleFields?: string[];
  fields: FieldDef[];
  maxRows: number;
  minRows?: number;
  showIf?: Predicate;
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
  /** Letter of the section of Dima's Word form (A–I), shown in the PDF. */
  section?: string;
  title: L;
  intro?: L;
  showIf?: (answers: Answers) => boolean;
  blocks: Block[];
  /** Screens with their own UI: documents (section H) and review. */
  special?: "documents" | "review";
}

/** A document of section H, possibly one per row of a group (e.g. one ID per signatory). */
export interface DocItem {
  key: string;
  /** Short code (6 hex) put in the uploaded file names. */
  code: string;
  label: L;
  hint?: L;
  /** Must be uploaded (or marked "sent separately") before submitting. */
  required: boolean;
}

/** Client's answer per document: uploaded is derived from the files; these two are declared. */
export type DocDeclared = "later" | "na";
