/**
 * Answers saved by an earlier version of the form, mapped to the current questions (form of
 * 2026-11-13). A merged question takes the old answers so nothing a client typed is lost: drafts
 * resume with them, and Ark reads them in the staff view. Questions simply no longer asked keep
 * their own id (retired blocks, schema.ts). Pure and idempotent.
 *
 * Drafts and submissions written by this version carry `formVersion: FORM_VERSION` and are read
 * as they are. Older ones are upgraded when read; a draft may also get the answers the old form
 * implied (`infer`), a submitted form never does: Ark reads what the client sent.
 */
import type { Answers, Row } from "./types";

/** Version of the questions answers are saved for (1: until 2026-11-13; 2: until the holders tree of 2026-11-15). */
export const FORM_VERSION = 4;

/** Answer ids merged into another one: provenance marks and prefill ids follow their answer. */
export const MOVED_IDS: Record<string, string> = {
  "a.employer": "a.profession",
  "d.sector": "d.activity",
  "g.countries": "d.countries",
  "f.holder": "f.bank",
  "f.otherOwner": "f.origin",
  "a.signatories": "a.directors",
};

export const upgradeId = (id: string) => MOVED_IDS[id] || id;
export const upgradeIds = (ids: readonly string[]) => [...new Set(ids.map(upgradeId))];
/** Provenance marks keyed by answer id, following merged answers (the first mark is kept). */
export function upgradeMarks(marks: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!marks) return marks;
  const out: Record<string, string> = {};
  for (const [id, by] of Object.entries(marks)) if (!(upgradeId(id) in out)) out[upgradeId(id)] = by;
  return out;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const rows = (v: unknown): Row[] => (Array.isArray(v) ? (v.filter((r) => r && typeof r === "object" && !Array.isArray(r)) as Row[]) : []);
const norm = (v: unknown) =>
  str(v).toLocaleLowerCase("fr-CH").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-‐‑'’.]/g, " ").replace(/\s+/g, " ").trim();

/** `base` then `extra` unless `base` already says it. */
function joined(base: unknown, extra: unknown, separator: string): string {
  const a = str(base);
  const b = str(extra);
  if (!b || norm(a).includes(norm(b))) return a;
  return a ? `${a}${separator}${b}` : b;
}

/** Moves `from` into `to` (text), then forgets `from`. */
function merge(out: Answers, from: string, to: string, separator: string) {
  if (!(from in out)) return;
  const value = joined(out[to], out[from], separator);
  if (value) out[to] = value;
  delete out[from];
}

export function upgradeAnswers(input: Answers, options: { infer?: boolean } = {}): Answers {
  const out: Answers = { ...input };
  merge(out, "a.employer", "a.profession", ", ");
  if ("d.sector" in out) {
    const sector = str(out["d.sector"]);
    const activity = str(out["d.activity"]);
    if (sector && !norm(activity).includes(norm(sector))) out["d.activity"] = activity ? `${activity} (${sector})` : sector;
    delete out["d.sector"];
  }
  merge(out, "g.countries", "d.countries", " ; ");
  merge(out, "f.holder", "f.bank", ", ");
  merge(out, "f.otherOwner", "f.origin", "\n");
  // Directors and signatories: one list, each person with their signature.
  if ("a.signatories" in out) {
    const signatories = rows(out["a.signatories"]);
    const people: Row[] = rows(out["a.directors"]).map((row) => ({ ...row }));
    const key = (r: Row) => `${norm(r.lastName)}|${norm(r.firstName)}`;
    const ids = new Set(people.map((r) => r._id));
    const matched = new Set<Row>();
    // Each person's key is computed once (a Map keeps the first of equal keys, as a scan would).
    const byKey = new Map<string, Row>();
    const index = (p: Row) => {
      const k = key(p);
      if (k !== "|" && !byKey.has(k)) byKey.set(k, p);
    };
    people.forEach(index);
    for (const s of signatories) {
      const person = byKey.get(key(s));
      if (person) {
        matched.add(person);
        if (!person.signing && s.signing) person.signing = s.signing;
        if (!person.function && s.function) person.function = s.function;
        continue;
      }
      const row: Row = { _id: s._id && !ids.has(s._id) ? s._id : `${String(s._id || "sig000").slice(0, 18)}x${people.length}` };
      for (const field of ["lastName", "firstName", "function", "signing"] as const) if (s[field] !== undefined) row[field] = s[field];
      ids.add(row._id);
      matched.add(row);
      people.push(row);
      index(row);
    }
    // A draft: the old list of signatories was complete, so a director not on it did not sign.
    if (options.infer && signatories.length) for (const person of people) if (!matched.has(person) && !person.signing) person.signing = "none";
    if (people.length) out["a.directors"] = people;
    delete out["a.signatories"];
  }
  if (options.infer) {
    const tree = holdersFromOldLists(out);
    Object.assign(out, tree);
    if ("b.qOther" in tree && tree["b.qOther"] === undefined) delete out["b.qOther"];
    Object.assign(out, controlFromOldLists(out));
    Object.assign(out, paymentsFromOldText(out));
  }
  // A draft: the old free text on where the company's money comes from is now « Autre ».
  if (options.infer && str(out["e.companyAssets"]) && out["e.companyAssetSources"] === undefined) out["e.companyAssetSources"] = ["other"];
  return out;
}

const ROW_ID = /^[a-z0-9]{6,24}$/;
const PERSON_FACTS = ["lastName", "firstName", "birthDate", "nationality", "address", "country"] as const;

/**
 * The holders tree from a draft's old lists (2026-11-15): each person of « 25 % ou plus »
 * (`b.controllers25`) or of a non-operating company's owners (`b.ubos`) becomes a person entered
 * once (`b.persons`) and a « Personne » holder with the share given. Only while the draft has no
 * holders yet; the old answers stay as they were (retired, read-only for Ark). Same mapping as
 * Cadence's `upgrade.py`.
 */
export function holdersFromOldLists(a: Answers): Answers {
  if (Array.isArray(a["b.holders"])) return {};
  const old = [...rows(a["b.controllers25"]).map((row) => ({ row, percent: str(row.percent) })), ...rows(a["b.ubos"]).map((row) => ({ row, percent: /^\d{1,3}([.,]\d+)?\s*%?$/.test(str(row.share)) ? str(row.share).replace(/\s*%$/, "") : "" }))];
  const out: Answers = {};
  if (a["b.q25"] === "unidentified" || a["b.qOther"] === "unidentified") out["b.holdersUnknown"] = "yes";
  if (a["b.qOther"] === "unidentified") out["b.qOther"] = undefined;
  if (!old.length) return out;
  const persons: Row[] = rows(a["b.persons"]).map((p) => ({ ...p }));
  const holders: Row[] = [];
  const key = (r: Row) => `${norm(r.lastName)}|${norm(r.firstName)}`;
  old.forEach(({ row, percent }, index) => {
    const base = typeof row._id === "string" && ROW_ID.test(row._id) ? row._id.slice(0, 23) : "";
    let person = key(row) !== "|" ? persons.find((p) => key(p) === key(row)) : undefined;
    if (!person) {
      person = { _id: base ? `${base}p` : `pers${String(index).padStart(4, "0")}` };
      for (const f of PERSON_FACTS) if (str(row[f])) person[f] = str(row[f]);
      if (str(row.wealth)) person.wealth = str(row.wealth);
      persons.push(person);
    }
    if (holders.some((h) => h.person === person!._id)) return;
    const holder: Row = { _id: base ? `${base}h` : `hold${String(index).padStart(4, "0")}`, kind: "person", person: person._id };
    if (percent) holder.percent = percent;
    holders.push(holder);
  });
  out["b.persons"] = persons;
  out["b.holders"] = holders;
  return out;
}

/** A `b.persons` row for an old row of section B: the same person (same name) when already there, else a new one. */
function personFor(persons: Row[], row: Row, fallback: string): Row {
  const key = (r: Row) => `${norm(r.lastName)}|${norm(r.firstName)}`;
  const found = key(row) !== "|" ? persons.find((p) => key(p) === key(row)) : undefined;
  if (found) {
    for (const f of PERSON_FACTS) if (str(row[f]) && !str(found[f])) found[f] = str(row[f]);
    return found;
  }
  const taken = new Set(persons.map((p) => p._id));
  const base = typeof row._id === "string" && ROW_ID.test(row._id) ? `${row._id.slice(0, 23)}p` : "";
  let id = base && !taken.has(base) ? base : "";
  for (let n = 1; !id; n++) if (!taken.has(`${fallback}${String(n).padStart(4, "0")}`)) id = `${fallback}${String(n).padStart(4, "0")}`;
  const person: Row = { _id: id };
  for (const f of PERSON_FACTS) if (str(row[f])) person[f] = str(row[f]);
  persons.push(person);
  return person;
}

/**
 * Other control and the senior manager from a draft's old lists (2026-11-15): each person of
 * « Qui, et comment ? » (`b.controllersOther`) becomes a person entered once (`b.persons`) named in
 * `b.controlPersons`, their « comment » joined in `b.controlHow`, and « contrôle autrement » is yes;
 * the old « Qui dirige la société ? » (`b.manager`) becomes the managers pick (`b.managers`). Only
 * where the new answer is still empty; the old answers stay (retired, read-only for Ark). Same
 * mapping as Cadence's `upgrade.py`.
 */
export function controlFromOldLists(a: Answers): Answers {
  const others = rows(a["b.controllersOther"]).filter((r) => str(r.lastName) || str(r.firstName));
  const managers = rows(a["b.manager"]).filter((r) => str(r.lastName) || str(r.firstName));
  const emptyIds = (id: string) => !Array.isArray(a[id]) || !(a[id] as unknown[]).length;
  const moveControl = others.length > 0 && emptyIds("b.controlPersons") && a["b.qOther"] !== "no";
  const moveManagers = managers.length > 0 && emptyIds("b.managers");
  if (!moveControl && !moveManagers) return {};
  const persons: Row[] = rows(a["b.persons"]).map((p) => ({ ...p }));
  const out: Answers = {};
  if (moveControl) {
    out["b.controlPersons"] = [...new Set(others.map((r) => personFor(persons, r, "ctrl")._id))];
    out["b.qOther"] = "yes";
    if (!str(a["b.controlHow"])) {
      const how = [...new Set(others.map((r) => str(r.controlType)).filter(Boolean))].join(" ; ");
      if (how) out["b.controlHow"] = how.length > 300 ? `${how.slice(0, 299)}…` : how;
    }
  }
  if (moveManagers) out["b.managers"] = [...new Set(managers.map((r) => personFor(persons, r, "mngr")._id))];
  out["b.persons"] = persons;
  return out;
}

const NUMBER = /(\d{1,3}(?:['’\u00a0\u202f ]\d{3})+|\d+)([.,]\d+)?/g;
const COUNT_AFTER = /^\s*(paiements?|versements?|virements?|op[ée]rations?|transactions?|payments?|transfers?|fois)/;
/** An amount per payment or per period (« 40 paiements de 5 000 CHF », « par mois »): not a yearly total. */
const PER_UNIT = /(\bde\b|\bx\b|×|(?:^|\s)à(?:\s|$)|chacune?|\beach\b|\bper\b|par (mois|semaine|jour)|mensuel|hebdo|month|week|\/\s*(mois|month))/;
const MONEY_AFTER = /^\s*(chf|fr\.?|francs?|eur|euros?|€|usd|\$)/;
const MONEY_BEFORE = /(chf|fr\.|eur|€|usd|\$)\s*$/;

/**
 * The old « Combien de paiements par an, pour quel total ? » read as its two numbers, only when
 * unambiguous: exactly two numbers, one of them marked as a count (« 40 paiements ») or as an
 * amount (« 200 000 CHF »), the other taking the other role; the count a whole number; no amount per
 * payment or per period (« de 5 000 », « par mois »), no bare year as the total. Else null.
 */
export function parseOperations(text: unknown): { perYear: string; total: string } | null {
  const s = str(text).toLocaleLowerCase("fr-CH");
  if (PER_UNIT.test(s)) return null;
  const found = [...s.matchAll(NUMBER)].map((m) => {
    const end = (m.index || 0) + m[0].length;
    return { whole: m[1].replace(/['’\u00a0\u202f ]/g, ""), decimals: m[2] || "", count: COUNT_AFTER.test(s.slice(end)), money: MONEY_AFTER.test(s.slice(end)) || MONEY_BEFORE.test(s.slice(0, m.index)) };
  });
  if (found.length !== 2) return null;
  const [x, y] = found;
  let count: typeof x | undefined;
  if ((x.count || y.money) && !(y.count || x.money)) count = x;
  else if ((y.count || x.money) && !(x.count || y.money)) count = y;
  if (!count || count.decimals || count.whole.length > 9) return null;
  const total = count === x ? y : x;
  if (total.whole.length > 13 || (!total.money && /^(19|20)\d\d$/.test(total.whole))) return null;
  return { perYear: String(Number(count.whole)), total: `${Number(total.whole)}${total.decimals.replace(",", ".")}` };
}

/**
 * The amount through the accounts (`g.amount`, 2026-11-15) from a draft's earlier payments answers:
 * the total per year when given, else the total read from the old one-field text when unambiguous.
 * Only while `g.amount` is empty; for an operating company it stays unasked (pruned).
 */
export function paymentsFromOldText(a: Answers): Answers {
  if (str(a["g.amount"])) return {};
  const total = str(a["g.paymentsTotal"]) || parseOperations(a["g.operations"])?.total || "";
  return total ? { "g.amount": total } : {};
}
