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

/**
 * Wording of a block for some answers only (e.g. the non-operating company): the first variant
 * whose `when` holds replaces the label and help. Same answer id, same meaning.
 */
export interface Variant {
  when: (answers: Answers) => boolean;
  label?: L;
  help?: L;
}

export interface FieldDef {
  kind: "field";
  id: string;
  type: FieldType;
  label: L;
  help?: L;
  variants?: Variant[];
  /** A link inside the label (single checkbox): the text of `label` equal to `link.label` becomes the link. */
  link?: { href: L; label: L };
  /**
   * No longer asked (form of 2026-11-13). Kept so the answers of earlier drafts and cases still
   * show to Ark (staff view, PDF) under their own label: never shown in the form, never required,
   * never prefilled by Cadence; visible to readers only when it has a value.
   */
  retired?: boolean;
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
  /** See FieldDef.retired. */
  retired?: boolean;
}

export interface NoteDef {
  kind: "note";
  id: string;
  text: L;
  tone?: "info" | "warning";
  /** Optional link shown after the text (opens in a new tab). */
  link?: { href: L; label: L };
  showIf?: Predicate;
}

export interface HeadingDef {
  kind: "heading";
  id: string;
  label: L;
  showIf?: Predicate;
  /**
   * Letter of a section of Dima's form that starts at this heading inside a screen (the money
   * screen holds E, F and G): printed as a section in the PDF, a sub-title in the form.
   */
  section?: string;
  /**
   * Title of the "already filled in, to check" block when the fields after it were prefilled by
   * Ark; `note` is said in that block only. `onlyWhenPrefilled`: not shown at all otherwise.
   * `ids`: the fields that belong to the block (others prefilled after it stand alone).
   */
  prefill?: { note?: L; onlyWhenPrefilled?: boolean; ids?: string[] };
}

export type Block = FieldDef | GroupDef | NoteDef | HeadingDef;

export interface StepDef {
  id: string;
  /** Letter of the section of Dima's Word form (A–I), shown in the PDF. */
  section?: string;
  title: L;
  intro?: L;
  /** Intro for some answers only (e.g. a company): the first whose `when` holds replaces `intro`. */
  variants?: { when: (answers: Answers) => boolean; intro: L }[];
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
