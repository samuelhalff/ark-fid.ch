/**
 * The pure part of a questionnaire kit (KYC and tax): strings in the page's language and how the
 * form words and checks a field. The shared components (src/components/questionnaire) read it,
 * with the form's server calls and own field types added in the component layer (kit.tsx).
 * Pure module: node tests build both forms' kits.
 */
import type { AnyAnswers, AnyRow } from "./form-values";

/** A label in the form's languages (FR/EN for KYC, FR/EN/DE for tax). */
export type LabelText = Record<string, string>;

export interface KitOption {
  value: string;
  label: LabelText;
  hint?: LabelText;
  showIf?: (answers: never) => boolean;
}

/** The part of a field definition the shared renderer reads (both schemas fit it). */
export interface KitField {
  id: string;
  type: string;
  label: LabelText;
  help?: LabelText;
  options?: KitOption[];
  required?: boolean;
  width?: "full" | "half";
  maxLength?: number;
  suggest?: "country" | "countries";
  /** A link inside the label (single checkbox): the text equal to `link.label` becomes the link. */
  link?: { href: LabelText; label: LabelText };
}

export interface KitGroup {
  id: string;
  label: LabelText;
  help?: LabelText;
  itemLabel: LabelText;
  fields: KitField[];
  maxRows: number;
  minRows?: number;
}

export interface KitHeading {
  id: string;
  label: LabelText;
  /** One line under the heading (also the note of its prefilled block when it has none of its own). */
  help?: LabelText;
  /** A section starting inside a screen: a sub-title of its own. */
  section?: string;
  /** Title of the « déjà rempli » block of the prefilled fields after it (see the KYC schema). */
  prefill?: { note?: LabelText; onlyWhenPrefilled?: boolean; ids?: string[] };
}

export interface KitNote {
  id: string;
  text: LabelText;
  tone?: "info" | "warning";
  /** Optional link shown after the text (opens in a new tab). */
  link?: { href: LabelText; label: LabelText };
}

/** A block of a screen, as both schemas define it. */
export type KitBlock = ({ kind: "field" } & KitField) | ({ kind: "group" } & KitGroup) | ({ kind: "heading" } & KitHeading) | ({ kind: "note" } & KitNote);

/** Strings of the shared components, already in the page's language. */
export interface KitStrings {
  optional: string;
  yes: string;
  no: string;
  choose: string;
  datePlaceholder: string;
  remove: string;
  noRows: string;
  /** "Ajouter : {item}" / "Ajouter un autre élément : {item}". */
  addRow: string;
  addAnother: string;
  /** Under the one-tap names: someone else is typed below. */
  otherPerson: string;
  edit: string;
  showAll: string;
  showLess: string;
  stepOf: string;
  saving: string;
  savedAt: string;
  saveFailed: string;
  missingOne: string;
  missingMany: string;
  /** The (i) of a field and its « Poser une question » (forms whose help sits behind it). */
  helpButton?: string;
  ask?: { reveal: string; label: string; send: string; sending: string; echo: string; offTopic: string; proposal: string; close: string; use: string };
  /** Prefilled rows (« Déjà rempli, à vérifier », « Terminé »). */
  prefilled?: string;
  rowDone?: string;
}

export type AskReply = { offTopic: boolean; answer: string | null; proposal: string | string[] | null };

/** What a form contributes without React. */
export interface KitBase {
  locale: string;
  strings: KitStrings;
  /** A label in the page's language (the form's own interpolation, e.g. the tax year). */
  t: (text: LabelText, answers?: AnyAnswers) => string;
  /** A field's label and help for these answers (a form may word a field per answers). */
  fieldText: (field: KitField, answers: AnyAnswers) => { label: LabelText; help?: LabelText };
  /** A valid answer is there: the quiet green check. */
  isFilled: (field: KitField, value: unknown) => boolean;
  /** Text length cap of a field. */
  maxLength: (field: KitField) => number;
  /** Where a field's explanation shows: behind the (i) next to its label, or as a line under it. */
  helpStyle: "hint" | "inline";
  /** Browser autofill only on the client's own answers, never on third parties' rows: form name → token. */
  autofill: Record<string, string>;
  /** An answer as read back (option labels, Oui/Non, a person's name). */
  displayValue: (field: KitField, value: unknown, answers: AnyAnswers) => string;
  /** The form's validator for one answer: an error code, or null. */
  validate: (field: KitField, value: unknown) => string | null;
  /** A field of a group's row asked for these answers and this row. */
  rowFieldVisible: (field: KitField, answers: AnyAnswers, row: AnyRow) => boolean;
  /** A row's own name (« DUPONT Jean », « UBS »), empty while unnamed. */
  rowTitle: (group: KitGroup, row: AnyRow) => string;
  /** A stable random id for a new row. */
  newRowId: () => string;
  /**
   * One-tap names given earlier in the form (people, employers…) for a row still without one: the
   * choices, and the row once one is picked. Null when the group reuses nothing or the row is named.
   */
  reuse?: (group: KitGroup, row: AnyRow, answers: AnyAnswers) => { choices: { key: string; label: string }[]; pick: (key: string) => AnyRow | null } | null;
}

/** "{item}" / "{n}"… placeholders of a string. */
export const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));
