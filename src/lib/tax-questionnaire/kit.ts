/** The tax form's kit for the shared questionnaire components: FR/EN/DE strings, labels with the tax year, help shown under the label. */
import type { IssueAdapter } from "../questionnaire/issues";
import type { KitBase, KitField } from "../questionnaire/kit";
import { displayValue, getField, getGroup, isFilled, isRowFieldVisible, label, newRowId, validateField } from "./logic";
import { choiceLabel, knownNames, NAME_REUSE } from "./people";
import { rowsOf } from "./schema";
import type { Answers, FieldDef, QfLocale, Row } from "./types";
import { UI, UI2 } from "./ui";

/** A row's title: the first filled of its title fields ("bank", "name|label"). */
export function taxRowTitle(group: { titleField?: string }, row: Record<string, unknown>): string {
  return (group.titleField || "").split("|").map((k) => (typeof row[k] === "string" ? (row[k] as string) : "")).find(Boolean) || "";
}

export function taxKit(locale: QfLocale): KitBase {
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
      otherPerson: s("otherName"),
      edit: s("edit"),
      showAll: s("showAll"),
      showLess: s("showLess"),
      stepOf: s("stepOf"),
      saving: UI2.saving[locale],
      savedAt: UI2.savedAt[locale],
      saveFailed: UI2.saveFailed[locale],
      missingOne: s("missingOne"),
      missingMany: s("missingMany"),
    },
    t: (text, answers) => label(text as Record<QfLocale, string>, locale, (answers || {}) as Answers),
    fieldText: (field) => ({ label: field.label, help: field.help }),
    isFilled: (field, value) => isFilled(field as FieldDef, value),
    maxLength: (field: KitField) => field.maxLength || (field.type === "textarea" ? 4000 : 200),
    helpStyle: "inline",
    // The client's own name and e-mail (start screen), never a child's, an employer's or a partner's row.
    autofill: { start__firstName: "given-name", start__lastName: "family-name", start__email: "email" },
    displayValue: (field, value, answers) => displayValue(field as FieldDef, value, locale, answers as Answers),
    validate: (field, value) => validateField(field as FieldDef, value),
    // Fields set by the app (hidden) are never asked.
    rowFieldVisible: (field, answers, row) => !(field as FieldDef).hidden && isRowFieldVisible(field as FieldDef, answers as Answers, row as Row),
    rowTitle: (group, row) => taxRowTitle(group as unknown as { titleField?: string }, row),
    newRowId,
    // Names given above (employers, children, the spouse…): one tap fills the name of an entry still without one.
    reuse: (group, row, answers) => {
      const target = NAME_REUSE[group.id];
      if (!target || row.carried || String(row[target.field] || "").trim()) return null;
      const names = knownNames(answers as Answers, group.id);
      return {
        choices: names.map((n) => ({ key: n.key, label: choiceLabel(n, locale) })),
        pick: (key) => {
          const picked = names.find((n) => n.key === key);
          return picked ? { ...row, _id: row._id || newRowId(), [target.field]: picked.value } : null;
        },
      };
    },
  };
}

export function taxIssueAdapter(locale: QfLocale): IssueAdapter {
  return {
    fieldLabel: (id, a) => {
      const field = getField(id);
      return field ? label(field.label, locale, a as Answers) : null;
    },
    groupLabel: (id, a) => {
      const group = getGroup(id);
      return group ? label(group.label, locale, a as Answers) : null;
    },
    rowFieldLabel: (groupId, fieldId, a) => {
      const f = getGroup(groupId)?.fields.find((x) => x.id === fieldId);
      return f ? label(f.label, locale, a as Answers) : null;
    },
    // The row's own name when known ("UBS"), else "Banque 2".
    rowName: (groupId, index, a) => {
      const group = getGroup(groupId);
      if (!group) return "";
      const title = taxRowTitle(group, rowsOf(a as Answers, groupId)[index] || {});
      return title || `${label(group.itemLabel, locale, a as Answers)} ${index + 1}`;
    },
  };
}

