/**
 * Countries for the nationality and country fields: names in the form's language (the browser's
 * Intl.DisplayNames, nothing to translate by hand), Switzerland and its neighbours first, found
 * by any word's start (« sui » → Suisse) in either language. The answer stays the text the field
 * always held — a country name, or several separated by commas for a field that takes several —
 * so a name typed by hand or prefilled by Ark is still a valid answer.
 */
import type { KycLocale } from "./types";

/** The forms' languages: the KYC form's, and German for the tax questionnaire (shared field). */
export type CountryLocale = KycLocale | "de";

/** ISO 3166-1 alpha-2, every country and territory Intl names. */
const CODES = (
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ " +
  "DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP " +
  "KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ " +
  "OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TK TL TM TN TO TR TT TV TW TZ " +
  "UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW"
).split(" ");

/** Shown first, in this order: where most of Ark's clients and their people come from. */
const FIRST = ["CH", "FR", "DE", "IT", "AT", "LI"];

export interface Country {
  code: string;
  name: string;
  /** Lower-case, accent-free words of the names in both languages, for the search. */
  words: string[];
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const cache = new Map<CountryLocale, Country[]>();

export function countries(locale: CountryLocale): Country[] {
  const known = cache.get(locale);
  if (known) return known;
  const names = new Intl.DisplayNames([locale], { type: "region" });
  const other = new Intl.DisplayNames([locale === "fr" ? "en" : "fr"], { type: "region" });
  const list = CODES.map((code) => {
    const name = names.of(code) || code;
    const words = fold(`${name} ${other.of(code) || ""}`).split(/[^a-z0-9]+/).filter(Boolean);
    return { code, name, words };
  });
  const rank = (c: Country) => (FIRST.includes(c.code) ? FIRST.indexOf(c.code) : FIRST.length);
  list.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, locale));
  cache.set(locale, list);
  return list;
}

/** The countries whose name has a word starting with `query` (then containing it), first ones first. */
export function searchCountries(query: string, locale: CountryLocale, limit = 6): Country[] {
  const q = fold(query.trim());
  if (!q) return [];
  const all = countries(locale);
  const start = all.filter((c) => c.words.some((w) => w.startsWith(q)) || fold(c.name).startsWith(q));
  const inside = all.filter((c) => !start.includes(c) && fold(c.name).includes(q));
  return [...start, ...inside].slice(0, limit);
}

/** The names in a field that takes several (« Suisse, France »). */
export const splitCountries = (value: string) => value.split(/[,;/]/).map((s) => s.trim()).filter(Boolean);

/** What is being typed: the whole value, or the part after the last comma when several are taken. */
export function typedPart(value: string, several: boolean): string {
  if (!several) return value.trim();
  const cut = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"));
  return value.slice(cut + 1).trim();
}

/** The value once `name` is picked: replaces what was being typed, keeps the names before it. */
export function pickCountry(value: string, name: string, several: boolean): string {
  if (!several) return name;
  const cut = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"));
  const before = splitCountries(cut >= 0 ? value.slice(0, cut) : "");
  return [...before.filter((n) => fold(n) !== fold(name)), name].join(", ");
}

/** True when what is typed is already a full country name: nothing left to suggest. */
export function isCountryName(text: string, locale: CountryLocale): boolean {
  const q = fold(text.trim());
  return !!q && countries(locale).some((c) => fold(c.name) === q);
}

/** Offered on an empty field: the countries most of Ark's clients and their people name. */
const COMMON = ["CH", "FR", "IT", "DE", "AT", "GB", "US", "LI"];

/**
 * What the list under the field offers: the common countries while nothing is typed (minus the
 * ones already in the field), the matches of what is typed, nothing once the text typed is a full
 * country name. `browse`: the field was just entered, nothing typed yet — a full name already
 * there (prefilled « Suisse ») offers the common others, to replace it or, when several are
 * taken, to add one.
 */
export function suggestCountries(value: string, several: boolean, locale: CountryLocale, browse = false): Country[] {
  const typed = typedPart(value, several);
  const common = () => {
    const picked = new Set(splitCountries(several || browse ? value : "").map(fold));
    const all = countries(locale);
    return COMMON.map((code) => all.find((c) => c.code === code)!).filter((c) => c && !picked.has(fold(c.name)));
  };
  if (!typed) return common();
  if (isCountryName(typed, locale)) return browse ? common() : [];
  return searchCountries(typed, locale);
}

/** The value once `name` is chosen from the list (see suggestCountries for `browse`). */
export function chooseCountry(value: string, name: string, several: boolean, locale: CountryLocale, browse = false): string {
  const adding = several && browse && isCountryName(typedPart(value, true), locale);
  return pickCountry(adding ? `${value}, ` : value, name, several);
}

/** The answer once the field is left: only a trailing comma left by the last pick goes; never emptied. */
export const tidyCountries = (raw: string) => raw.replace(/[\s,;]+$/, "");
