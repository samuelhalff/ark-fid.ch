/**
 * Who holds the company (section B, companies): one list of holders — persons, companies, trusts,
 * foundations, nominees — where a company holder has its own holders, three levels deep, then a
 * free text (mockup approved by Sam 2026-11-15, « Ok pour les propositions »).
 *
 * People facts are entered once, in `b.persons`; a person holder, a person who controls the company
 * otherwise and the senior managers point to a row of it by `_id`. The 25 % is computed here, never
 * asked: the shares are multiplied along the chain and summed per person. It is information for
 * the client and for Ark, never a reason to refuse an answer. Pure module (browser, server, tests).
 */
import { t, type Answers, type KycLocale, type L, type Row } from "./types";

export const HOLDERS = "b.holders";
export const PERSONS = "b.persons";
/** Row key of the holders of a company holder. */
export const NESTED = "holders";
/** Levels of holders asked as a list; below the last one a company's holders are free text. */
export const HOLDER_DEPTH = 3;
export const THRESHOLD = 25;

export type HolderKind = "person" | "company" | "trust" | "foundation" | "nominee";
export const HOLDER_KINDS: HolderKind[] = ["person", "company", "trust", "foundation", "nominee"];
export const KIND_LABEL: Record<HolderKind, L> = {
  person: t("Personne", "Person"),
  company: t("Société", "Company"),
  trust: t("Trust", "Trust"),
  foundation: t("Fondation", "Foundation"),
  nominee: t("Prête-nom", "Nominee"),
};

const isRow = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v) && typeof (v as Row)._id === "string";
export const rowList = (v: unknown): Row[] => (Array.isArray(v) ? v.filter(isRow) : []);
export const holdersOf = (a: Answers): Row[] => rowList(a[HOLDERS]);
export const childrenOf = (row: Row | undefined): Row[] => rowList(row?.[NESTED]);
export const personsOf = (a: Answers): Row[] => rowList(a[PERSONS]);
export const personById = (a: Answers, id: unknown): Row | undefined => (typeof id === "string" && id ? personsOf(a).find((p) => p._id === id) : undefined);
export const idList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : []);

const str = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

/** « Samuel Halff », as the client typed it. */
export const personName = (p: Row | undefined) => [str(p?.firstName), str(p?.lastName)].filter(Boolean).join(" ");

/** Title of a holder row: the person's name, or the name given to the company, trust… */
export const holderTitle = (a: Answers, row: Row) => (row.kind === "person" ? personName(personById(a, row.person)) : str(row.name));

/** « 60 », « 60,5 », « 60 % » → 60.5; null when it is not a share between 0 and 100. */
export function parsePercent(value: unknown): number | null {
  const text = str(value).replace(/%/g, "").replace(/['’\s]/g, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return n >= 0 && n <= 100 ? n : null;
}

/** « 60 % » (fr) or « 60% » (en), two decimals at most. */
export function formatPercent(n: number, locale: KycLocale): string {
  const rounded = Math.round(n * 100) / 100;
  const text = locale === "fr" ? String(rounded).replace(".", ",") : String(rounded);
  return locale === "fr" ? `${text} %` : `${text}%`;
}

export interface Stake {
  personId: string;
  /** Share of the client, in percent, summed over every line that leads to the person. */
  percent: number;
  /** At least part of it is held through a company. */
  indirect: boolean;
}

/**
 * Each person's share of the client: the shares multiplied along each chain of companies, summed
 * per person. A share left blank counts as nothing (the person still shows, at 0 %).
 */
export function stakes(a: Answers): Stake[] {
  const found = new Map<string, Stake>();
  const walk = (rows: Row[], factor: number, depth: number) => {
    for (const row of rows) {
      const share = (factor * (parsePercent(row.percent) ?? 0)) / 100;
      if (row.kind === "person" && typeof row.person === "string" && row.person) {
        const known = found.get(row.person) || { personId: row.person, percent: 0, indirect: false };
        known.percent += share * 100;
        known.indirect ||= depth > 1;
        found.set(row.person, known);
      } else if (row.kind === "company" && row.unknown !== "yes" && depth < HOLDER_DEPTH) walk(childrenOf(row), share, depth + 1);
    }
  };
  walk(holdersOf(a), 1, 1);
  const name = (s: Stake) => personName(personById(a, s.personId));
  return [...found.values()].sort((x, y) => y.percent - x.percent || name(x).localeCompare(name(y), "fr"));
}

/** Persons with 25 % or more of the client (art. 2a al. 3 LBA), computed. */
export const controllers25 = (a: Answers) => stakes(a).filter((s) => s.percent >= THRESHOLD - 1e-9);

/** « Mme Y (60 %), M. Z (40 %) ». */
export const stakesText = (a: Answers, list: Stake[], locale: KycLocale) =>
  list.map((s) => `${personName(personById(a, s.personId))} (${formatPercent(s.percent, locale)})`).join(", ");

/**
 * The computed line (« Personnes à 25 % ou plus », or every person behind a non-operating company)
 * is shown only when it tells something the list does not: someone held through a company.
 */
export const computedPeople = (a: Answers, operating: boolean) => (operating ? controllers25(a) : stakes(a));
export const showsComputedLine = (a: Answers, operating: boolean) => computedPeople(a, operating).some((s) => s.indirect);

/** Kinds of every holder, all levels (« trust », « nominee »… for Ark's flags and the chart document). */
export function holderKinds(a: Answers): string[] {
  const out: string[] = [];
  const walk = (rows: Row[]) => rows.forEach((row) => (typeof row.kind === "string" && out.push(row.kind), walk(childrenOf(row))));
  walk(holdersOf(a));
  return out;
}

/** Someone said « Je ne sais pas qui est derrière », for the company or one of its holders. */
export function anyUnknown(a: Answers): boolean {
  if (a["b.holdersUnknown"] === "yes") return true;
  const walk = (rows: Row[]): boolean => rows.some((row) => (row.kind === "company" && row.unknown === "yes") || walk(childrenOf(row)));
  return walk(holdersOf(a));
}

/** A controlling person is identified: 25 % or more, or control by other means (art. 2a al. 3 LBA). */
export const controllerFound = (a: Answers) => controllers25(a).length > 0 || (a["b.qOther"] === "yes" && idList(a["b.controlPersons"]).length > 0);

/** Every `b.persons` id something points to (holders at every level, other control, managers). */
export function referencedPersonIds(a: Answers): Set<string> {
  const ids = new Set<string>([...idList(a["b.controlPersons"]), ...idList(a["b.managers"])]);
  // The holders of a company said unknown are not asked any more (and pruned on save).
  const walk = (rows: Row[]) => {
    for (const row of rows) {
      if (row.kind === "person" && typeof row.person === "string" && row.person) ids.add(row.person);
      if (row.unknown !== "yes") walk(childrenOf(row));
    }
  };
  walk(holdersOf(a));
  return ids;
}

/**
 * Keeps the persons something points to, and drops what points to a person no longer there (so
 * the question is asked again rather than answered by a dangling id). Pure.
 */
export function prunePeople(input: Answers): Answers {
  if (!(PERSONS in input) && !(HOLDERS in input) && !("b.controlPersons" in input) && !("b.managers" in input)) return input;
  const out: Answers = { ...input };
  const known = new Set(personsOf(input).map((p) => p._id));
  const clean = (rows: Row[]): Row[] =>
    rows.map((row) => {
      const next: Row = { ...row };
      if (typeof next.person === "string" && !known.has(next.person)) delete next.person;
      if (Array.isArray(row[NESTED])) next[NESTED] = clean(childrenOf(row));
      return next;
    });
  if (HOLDERS in out) out[HOLDERS] = clean(holdersOf(input));
  for (const id of ["b.controlPersons", "b.managers"]) {
    if (!(id in out)) continue;
    const kept = idList(out[id]).filter((x) => known.has(x));
    if (kept.length) out[id] = kept;
    else delete out[id];
  }
  if (PERSONS in out) {
    const used = referencedPersonIds(out);
    out[PERSONS] = personsOf(input).filter((p) => used.has(p._id));
  }
  return out;
}

const SEP = " · ";
const WORDS = {
  unknown: t("Je ne sais pas qui est derrière", "I don't know who is behind it"),
  behind: t("Derrière", "Behind it"),
  owners: t("Détenteurs", "Holders"),
};

/**
 * The holders as indented lines, worded (review screen, PDF, Ark's mirror): « Holding X SA ·
 * Société · Suisse · CHE-… · 100 % », its holders one level deeper.
 */
export function holderLines(a: Answers): { depth: number; text: L }[] {
  const out: { depth: number; text: L }[] = [];
  const both = (make: (locale: KycLocale) => string): L => ({ fr: make("fr"), en: make("en") });
  const walk = (rows: Row[], depth: number) => {
    for (const row of rows) {
      const kind = HOLDER_KINDS.includes(row.kind as HolderKind) ? (row.kind as HolderKind) : null;
      const percent = parsePercent(row.percent);
      out.push({
        depth,
        text: both((locale) =>
          [holderTitle(a, row) || "…", kind ? KIND_LABEL[kind][locale] : "", str(row.country), str(row.uid), percent === null ? str(row.percent) : formatPercent(percent, locale)]
            .filter(Boolean)
            .join(SEP),
        ),
      });
      if (row.kind === "company" && row.unknown === "yes") out.push({ depth: depth + 1, text: WORDS.unknown });
      if (str(row.behind)) out.push({ depth: depth + 1, text: both((locale) => `${WORDS.behind[locale]}${locale === "fr" ? " : " : ": "}${str(row.behind)}`) });
      if (str(row.owners)) out.push({ depth: depth + 1, text: both((locale) => `${WORDS.owners[locale]}${locale === "fr" ? " : " : ": "}${str(row.owners)}`) });
      walk(childrenOf(row), depth + 1);
    }
  };
  walk(holdersOf(a), 1);
  if (a["b.holdersUnknown"] === "yes") out.push({ depth: 1, text: WORDS.unknown });
  return out;
}

/** The computed people line as words, or null when nobody is found. */
export function computedText(a: Answers, operating: boolean): L | null {
  const list = computedPeople(a, operating);
  return list.length ? { fr: stakesText(a, list, "fr"), en: stakesText(a, list, "en") } : null;
}

/** Choices of a `person` / `persons` answer: the persons of `b.persons`, by name. */
export const personOptions = (a: Answers) => personsOf(a).map((p) => ({ value: p._id, label: { fr: personName(p), en: personName(p) } as L }));

/** The row at a path of ids from the top of the tree (`[]` is the client itself: no row). */
export function rowAt(a: Answers, path: string[]): Row | undefined {
  let rows = holdersOf(a);
  let found: Row | undefined;
  for (const id of path) {
    found = rows.find((r) => r._id === id);
    if (!found) return undefined;
    rows = childrenOf(found);
  }
  return found;
}

/** The holders list at a path (the client's own at `[]`). */
export const holdersAt = (a: Answers, path: string[]): Row[] => (path.length ? childrenOf(rowAt(a, path)) : holdersOf(a));

/** `a` with the holders list at `path` replaced by `rows` (immutable). */
export function withHoldersAt(a: Answers, path: string[], rows: Row[]): Answers {
  if (!path.length) return { ...a, [HOLDERS]: rows };
  const replace = (list: Row[], [head, ...rest]: string[]): Row[] =>
    list.map((row) => (row._id !== head ? row : { ...row, [NESTED]: rest.length ? replace(childrenOf(row), rest) : rows }));
  return { ...a, [HOLDERS]: replace(holdersOf(a), path) };
}

/** Row indexes along a path of ids ([0, 1] for the second holder of the first), or null when a row is gone. */
export function indexPath(a: Answers, path: string[]): number[] | null {
  let rows = holdersOf(a);
  const out: number[] = [];
  for (const id of path) {
    const index = rows.findIndex((r) => r._id === id);
    if (index < 0) return null;
    out.push(index);
    rows = childrenOf(rows[index]);
  }
  return out;
}

/** Form field name of the holders list at `path` ("b__holders", "b__holders.0.holders"…), or null. */
export function listFieldName(a: Answers, path: string[]): string | null {
  const indexes = indexPath(a, path);
  return indexes ? ["b__holders", ...indexes.map((i) => `${i}.${NESTED}`)].join(".") : null;
}
