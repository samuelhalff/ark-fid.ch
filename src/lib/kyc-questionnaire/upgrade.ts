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

/** Version of the questions answers are saved for (1: until 2026-11-13). */
export const FORM_VERSION = 2;

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
    for (const s of signatories) {
      const person = people.find((p) => key(p) === key(s) && key(s) !== "|");
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
    }
    // A draft: the old list of signatories was complete, so a director not on it did not sign.
    if (options.infer && signatories.length) for (const person of people) if (!matched.has(person) && !person.signing) person.signing = "none";
    if (people.length) out["a.directors"] = people;
    delete out["a.signatories"];
  }
  // A draft: the old free text on where the company's money comes from is now « Autre ».
  if (options.infer && str(out["e.companyAssets"]) && out["e.companyAssetSources"] === undefined) out["e.companyAssetSources"] = ["other"];
  return out;
}
