/** The KYC form's kit for the shared questionnaire components: FR/EN strings, wording per answers, help behind the (i). */
import { toName } from "../questionnaire/form-values";
import type { IssueAdapter } from "../questionnaire/issues";
import type { KitBase, KitField } from "../questionnaire/kit";
import { displayValue, fieldText, getField, getGroup, isFilled, isRowFieldVisible, label, LIMITS, nestedKeyLabel, newRowId, rowsOf, rowTitle, validateField } from "./engine";
import { choiceLabel, isUnnamedRow, knownPeople, rowFromPerson } from "./people";
import type { Answers, FieldDef, GroupDef, KycLocale, Row } from "./types";
import { UI } from "./ui";

export function kycKit(locale: KycLocale): KitBase {
  const s = (key: keyof typeof UI) => UI[key][locale];
  return {
    locale,
    strings: {
      optional: s("optional"),
      yes: s("yes"),
      no: s("no"),
      choose: s("choose"),
      datePlaceholder: s("datePlaceholder"),
      remove: s("remove"),
      noRows: s("noRows"),
      addRow: s("addRow"),
      addAnother: s("addAnother"),
      otherPerson: s("otherPerson"),
      edit: s("edit"),
      showAll: s("showAll"),
      showLess: s("showLess"),
      stepOf: s("stepOf"),
      saving: s("saving"),
      savedAt: s("savedAt"),
      saveFailed: s("saveFailed"),
      missingOne: s("missingOne"),
      missingMany: s("missingMany"),
      helpButton: s("helpButton"),
      ask: { reveal: s("askReveal"), label: s("askLabel"), send: s("askSend"), sending: s("askSending"), echo: s("askEcho"), offTopic: s("askOffTopic"), proposal: s("askProposal"), close: s("askClose"), use: s("askUse") },
      prefilled: s("prefilled"),
      rowDone: s("rowDone"),
    },
    t: (text) => label(text as Record<KycLocale, string>, locale),
    fieldText: (field, answers) => fieldText(field as FieldDef, answers as Answers),
    isFilled: (field, value) => isFilled(field as FieldDef, value),
    maxLength: (field: KitField) => field.maxLength || (field.type === "textarea" ? LIMITS.textarea : LIMITS.text),
    helpStyle: "hint",
    // The client's own name and e-mail (a person's form; the contact person of a company), never a third party's row.
    autofill: { a__firstName: "given-name", a__lastName: "family-name", a__email: "email", a__contactEmail: "email" },
    displayValue: (field, value, answers) => displayValue(field as FieldDef, value, locale, answers as Answers),
    validate: (field, value) => validateField(field as FieldDef, value),
    rowFieldVisible: (field, answers, row) => isRowFieldVisible(field as FieldDef, answers as Answers, row as Row),
    rowTitle: (group, row) => rowTitle(group as GroupDef, row as Row),
    newRowId,
    // People named earlier (directors, contact, persons of an earlier list): one tap copies them into an unnamed entry.
    reuse: (group, row, answers) => {
      const people = knownPeople(answers as Answers, group.id);
      if (!people.length || !isUnnamedRow(row as Row)) return null;
      return {
        choices: people.map((person) => ({ key: person.key, label: choiceLabel(person, locale) })),
        pick: (key) => {
          const person = people.find((p) => p.key === key);
          return person ? rowFromPerson(group as GroupDef, person, { ...(row as Row), _id: row._id || newRowId() }) : null;
        },
      };
    },
  };
}

/** Answers edited by the holders component of section B: their issues point to it. */
const HOLDER_BLOCKS = new Set(["b.holders", "b.persons", "b.holdersUnknown", "b.qOther", "b.controlPersons", "b.controlHow", "b.managers"]);

export function kycIssueAdapter(locale: KycLocale): IssueAdapter {
  return {
    fieldLabel: (id, a) => {
      const field = getField(id);
      return field ? label(fieldText(field, a as Answers).label, locale) : null;
    },
    groupLabel: (id) => {
      const group = getGroup(id);
      return group ? label(group.label, locale) : null;
    },
    rowFieldLabel: (groupId, fieldId) => {
      const f = getGroup(groupId)?.fields.find((x) => x.id === fieldId);
      return f ? label(f.label, locale) : null;
    },
    // « Directeur 2 · DUPONT Jean »: the row's number and, when known, its title.
    rowName: (groupId, index, a) => {
      const group = getGroup(groupId);
      if (!group) return "";
      const row = rowsOf(a as Answers, groupId)[index];
      const title = row ? rowTitle(group, row) : "";
      return `${label(group.itemLabel, locale)} ${index + 1}${title ? ` · ${title}` : ""}`;
    },
    delegated: (id, a, key) => {
      if (!HOLDER_BLOCKS.has(id)) return null;
      const holders = label(getGroup("b.holders")!.label, locale);
      // Client-side: one line for the groups of the holders tree (its fields show under their own label).
      // From the server: « Part détenue (Holding X SA › Mme Y) ».
      if (key === undefined) return getField(id) ? null : { name: toName("b.holders"), label: holders };
      const worded = key.includes("[") ? nestedKeyLabel(key, a as Answers, locale) : null;
      const field = getField(key);
      return { name: toName("b.holders"), label: worded || (field ? label(fieldText(field, a as Answers).label, locale) : getGroup(key) ? label(getGroup(key)!.label, locale) : holders) };
    },
  };
}

