/**
 * People the client already named earlier in the form, offered as one-tap choices where a person
 * is asked again (Sam 2026-11-15: « sélectionner une option au nom de la personne remplie juste
 * avant »). A choice copies what both blocks ask (name, birth date, nationality, address…) into the
 * row, still editable: the answers keep their shape, nothing points to another block.
 */
import { splitPersonName } from "../tax-questionnaire/format";
import { isBlockAsked, rowsOf } from "./engine";
import { STEPS } from "./schema";
import { UI } from "./ui";
import type { Answers, GroupDef, KycLocale, Row } from "./types";

export interface KnownPerson {
  /** Same person, whatever the case or spacing: "halff samuel". */
  key: string;
  firstName: string;
  lastName: string;
  /** What was given about them, by the row field ids of the person blocks. */
  values: Record<string, string>;
  /** Their position as given above (« administrateur »), to tell who the choice is. */
  role?: string;
  /** Named as the company's contact person. */
  contact?: boolean;
}

/** Field types a choice copies: what the client typed, never an option picked for one block. */
const COPIED = new Set(["text", "textarea", "date", "email", "tel"]);

const clean = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
export const personKey = (lastName: unknown, firstName: unknown) => `${clean(lastName)} ${clean(firstName)}`.toLocaleLowerCase("fr-CH").trim();

const isPersonGroup = (g: GroupDef) => g.fields.some((f) => f.id === "lastName") && g.fields.some((f) => f.id === "firstName");

/** The company's contact person as one name: « HALFF Samuel » (house format) or « Samuel Halff ». */
function contactPerson(answers: Answers): KnownPerson | null {
  const name = clean(answers["a.contactName"]);
  if (!name) return null;
  let { lastName, firstName } = splitPersonName(name);
  if (!firstName) {
    const cut = name.lastIndexOf(" ");
    if (cut <= 0) return null; // one word: not enough to fill a name and a first name
    firstName = name.slice(0, cut);
    lastName = name.slice(cut + 1);
  }
  const values: Record<string, string> = { lastName, firstName };
  const email = clean(answers["a.contactEmail"]);
  if (email) values.email = email;
  return { key: personKey(lastName, firstName), lastName, firstName, values, contact: true };
}

/**
 * The persons named before `groupId` in the form (in form order, each once), not yet in that
 * group. Only blocks the client is asked count; the same person met twice gathers both rows' values.
 */
export function knownPeople(answers: Answers, groupId: string): KnownPerson[] {
  const found = new Map<string, KnownPerson>();
  const add = (person: KnownPerson) => {
    if (!person.key || !person.lastName || !person.firstName) return;
    const known = found.get(person.key);
    if (!known) found.set(person.key, { ...person, values: { ...person.values } });
    else {
      for (const [k, v] of Object.entries(person.values)) if (!known.values[k]) known.values[k] = v;
      known.role ||= person.role;
      known.contact ||= person.contact;
    }
  };
  let target: GroupDef | null = null;
  outer: for (const step of STEPS) {
    for (const block of step.blocks) {
      if (block.id === groupId && block.kind === "group") {
        target = block;
        break outer;
      }
      if (!isBlockAsked(block, answers)) continue;
      if (block.kind === "heading" && block.id === "a.contactHeading") {
        const contact = contactPerson(answers);
        if (contact) add(contact);
      }
      if (block.kind !== "group" || !isPersonGroup(block)) continue;
      for (const row of rowsOf(answers, block.id)) {
        const values: Record<string, string> = {};
        for (const f of block.fields) if (COPIED.has(f.type) && clean(row[f.id])) values[f.id] = clean(row[f.id]);
        add({ key: personKey(row.lastName, row.firstName), lastName: clean(row.lastName), firstName: clean(row.firstName), values, role: clean(row.function) || undefined });
      }
    }
  }
  if (!target || !isPersonGroup(target)) return [];
  const already = new Set(rowsOf(answers, groupId).map((r) => personKey(r.lastName, r.firstName)));
  return [...found.values()].filter((p) => !already.has(p.key));
}

/** `row` (an entry of `group`) with what the group asks that is known of `person`; its other answers stay. */
export function rowFromPerson(group: GroupDef, person: KnownPerson, base: Row): Row {
  const row: Row = { ...base };
  for (const f of group.fields) if (COPIED.has(f.type) && person.values[f.id]) row[f.id] = person.values[f.id];
  return row;
}

/** An entry still without a name: where the choices are offered. */
export const isUnnamedRow = (row: Row | undefined) => !clean(row?.lastName) && !clean(row?.firstName);

/** « C'est Samuel Halff (administrateur, indiqué plus haut) », in the form's language. */
export function choiceLabel(person: KnownPerson, locale: KycLocale): string {
  const role = person.role || (person.contact ? UI.contactRole[locale] : "");
  return UI.personChoice[locale].replace("{name}", `${person.firstName} ${person.lastName}`).replace("{role}", role ? `${role}, ` : "");
}
