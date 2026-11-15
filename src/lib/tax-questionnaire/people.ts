/**
 * Names the client already gave earlier in the form, offered as one-tap choices where the same
 * person or company is asked again (Sam 2026-11-15, same logic as the KYC form: one person typed
 * once, only the missing facts asked). A choice copies the name into the row, still editable;
 * the answers keep their shape, nothing points to another block.
 */
import { isBlockVisible, isStepVisible } from "./logic";
import { isCouple, rowsOf, STEPS } from "./schema";
import { t, type Answers, type L, type QfLocale } from "./types";

export interface KnownName {
  /** Same name, whatever the case or spacing. */
  key: string;
  value: string;
  /** Who it is, as given above (« employeur », « enfant »). */
  role: L;
}

type Source = { group: string; field: string; role: L } | { spouse: true; role: L };

const ROLE = {
  employer: t("employeur", "employer", "Arbeitgeber"),
  company: t("société", "company", "Gesellschaft"),
  child: t("enfant", "child", "Kind"),
  dependant: t("personne soutenue", "person you support", "unterstützte Person"),
  spouse: t("conjoint", "spouse", "Ehegatte"),
};
const employers: Source = { group: "work.employers", field: "name", role: ROLE.employer };
const companies: Source = { group: "work.companies", field: "name", role: ROLE.company };
const children: Source = { group: "family.children", field: "firstName", role: ROLE.child };
const dependants: Source = { group: "family.dependants", field: "name", role: ROLE.dependant };
const spouse: Source = { spouse: true, role: ROLE.spouse };

/** Where a name is asked again (group → its name field), and the earlier answers it may be. */
export const NAME_REUSE: Record<string, { field: string; from: Source[] }> = {
  "work.companies": { field: "name", from: [employers] },
  "family.alimony": { field: "counterparty", from: [children] },
  "assets.loans": { field: "borrower", from: [companies, children, dependants] },
  "assets.debts": { field: "lender", from: [companies, employers, dependants] },
  "other.inheritance": { field: "counterparty", from: [spouse, dependants, children] },
};

const clean = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
export const nameKey = (v: unknown) => clean(v).toLocaleLowerCase("fr-CH");

/** Is the group (by id) on a screen the client is asked, and itself asked? */
function groupAsked(groupId: string, answers: Answers): boolean {
  for (const step of STEPS) {
    const block = step.blocks.find((b) => b.id === groupId);
    if (block) return isStepVisible(step, answers) && isBlockVisible(block, answers);
  }
  return false;
}

/** The names given before that may be the one asked in `groupId` (each once), not already in that group. */
export function knownNames(answers: Answers, groupId: string): KnownName[] {
  const target = NAME_REUSE[groupId];
  if (!target) return [];
  const already = new Set(rowsOf(answers, groupId).map((r) => nameKey(r[target.field])).filter(Boolean));
  const found = new Map<string, KnownName>();
  const add = (value: string, role: L) => {
    const key = nameKey(value);
    if (key && !already.has(key) && !found.has(key)) found.set(key, { key, value: clean(value), role });
  };
  for (const source of target.from) {
    if ("spouse" in source) {
      if (isCouple(answers)) add(`${clean(answers["start.spouseFirstName"])} ${clean(answers["start.spouseLastName"])}`, source.role);
      continue;
    }
    if (!groupAsked(source.group, answers)) continue;
    for (const row of rowsOf(answers, source.group)) add(clean(row[source.field]), source.role);
  }
  return [...found.values()];
}

/** « C'est Acme SA (employeur, indiqué plus haut) ». */
export function choiceLabel(name: KnownName, locale: QfLocale): string {
  const role = name.role[locale];
  if (locale === "de") return `Es ist ${name.value} (${role}, oben angegeben)`;
  if (locale === "en") return `It's ${name.value} (${role}, given above)`;
  return `C'est ${name.value} (${role}, indiqué plus haut)`;
}
