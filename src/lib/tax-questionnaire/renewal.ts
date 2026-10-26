/**
 * Renewal (annual campaign): what is carried over from last year's questionnaire, shown on the
 * router next to "unchanged since {year}" so the client only opens the areas that changed.
 */
import { ROUTER_GROUPS, ROUTER_OPTIONS, prefilled, routerItems, rowsOf } from "./schema";
import type { Answers, QfLocale } from "./types";

const PROPERTY_KIND: Record<string, Record<QfLocale, string>> = {
  house: { fr: "Maison", en: "House", de: "Haus" },
  ppe: { fr: "PPE", en: "Condominium", de: "Stockwerkeigentum" },
  building: { fr: "Immeuble", en: "Building", de: "Mehrfamilienhaus" },
  land: { fr: "Terrain", en: "Land", de: "Grundstück" },
  parking: { fr: "Parking", en: "Parking", de: "Parkplatz" },
  construction: { fr: "En construction", en: "Under construction", de: "Im Bau" },
};
const MORTGAGE: Record<QfLocale, string> = { fr: "hypothèque", en: "mortgage", de: "Hypothek" };
const SECURITIES: Record<QfLocale, string> = { fr: "titres", en: "securities", de: "Wertschriften" };

const s = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Concrete items known from last year, per router group (empty when not a renewal). */
export function knownItems(answers: Answers, locale: QfLocale): Record<string, string[]> {
  if (!prefilled(answers)) return {};
  const items = routerItems(answers);
  const optionLabels = (group: string, skip: string[] = []) =>
    items
      .filter((i) => !skip.includes(i))
      .map((i) => ROUTER_OPTIONS.find((o) => o.value === i && o.group === group))
      .filter((o): o is (typeof ROUTER_OPTIONS)[number] => !!o)
      .map((o) => o.label[locale].replace("{year}", ""));
  const names = (groupId: string, field: string) => rowsOf(answers, groupId).map((r) => s(r[field])).filter(Boolean);

  const children = rowsOf(answers, "family.children").map((r) => [s(r.firstName), s(r.birthYear) ? `(${s(r.birthYear)})` : ""].filter(Boolean).join(" ")).filter(Boolean);
  const banks = rowsOf(answers, "assets.banks").map((r) => (r.securities === "yes" ? `${s(r.bank)} (${SECURITIES[locale]})` : s(r.bank))).filter(Boolean);
  const property = rowsOf(answers, "property.items").map((r) => {
    const kind = PROPERTY_KIND[s(r.kind)]?.[locale] || "";
    const place = s(r.commune) || s(r.city);
    const lenders = r.mortgage === "yes" && s(r.lenders) ? `${MORTGAGE[locale]} ${s(r.lenders)}` : "";
    return [kind, place, lenders].filter(Boolean).join(" · ");
  });
  return {
    family: [...children, ...optionLabels("family", ["children"])],
    work: [...names("work.employers", "name"), ...names("work.pensions", "payer"), ...names("work.companies", "name")],
    assets: [...banks, ...names("assets.insurances", "insurer"), ...names("assets.debts", "lender")],
    property: property.filter(Boolean),
    other: optionLabels("other"),
  };
}

/** Groups offered as "unchanged" (those with concrete items from last year). */
export const unchangeableGroups = (answers: Answers, locale: QfLocale = "fr") => {
  const known = knownItems(answers, locale);
  return ROUTER_GROUPS.map((g) => g.id).filter((id) => (known[id] || []).length > 0);
};
