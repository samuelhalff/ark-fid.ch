/**
 * Form values of the questionnaires (KYC and tax), shared: react-hook-form uses dots for nesting,
 * the schema ids contain dots ("a.lastName", "start.email"), so form names replace them with "__".
 * Groups are arrays of rows (useFieldArray), each row keeps its `_id`. Pure module: browser, server
 * and node tests.
 */

export type FormValues = Record<string, unknown>;
/** Answers of either form: scalars are strings, checkboxes string arrays, groups arrays of rows. */
export type AnyAnswers = Record<string, unknown>;
export type AnyRow = { _id: string } & Record<string, unknown>;

export const toName = (id: string) => id.replace(/\./g, "__");
export const toId = (name: string) => name.replace(/__/g, ".");

export function toForm<A extends AnyAnswers>(answers: A): FormValues {
  const out: FormValues = {};
  for (const [id, value] of Object.entries(answers)) out[toName(id)] = Array.isArray(value) ? value.map((v) => (v && typeof v === "object" ? { ...(v as AnyRow) } : v)) : value;
  return out;
}

/** Form values back to answers: empty values dropped, rows kept with their non-empty fields. */
export function fromForm<A extends AnyAnswers = AnyAnswers>(values: FormValues): A {
  const out: AnyAnswers = {};
  for (const [name, value] of Object.entries(values || {})) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      out[toId(name)] = value.map((v) => {
        if (!v || typeof v !== "object") return v;
        const row: Record<string, unknown> = {};
        for (const [k, rv] of Object.entries(v as Record<string, unknown>)) if (rv !== undefined && rv !== null && rv !== "") row[k] = rv;
        return row;
      });
    } else {
      out[toId(name)] = value;
    }
  }
  return out as A;
}

/** Rows of a group (top level) or of a group nested under a row. */
export const rowsIn = (holder: Record<string, unknown> | undefined, id: string): AnyRow[] =>
  Array.isArray(holder?.[id]) ? (holder![id] as unknown[]).filter((r): r is AnyRow => !!r && typeof r === "object") : [];

/** An error key of a row: "group[rowid].field" (the field may itself be nested). */
export const ROW_KEY = /^(.+?)\[([a-z0-9]+)\]\.(.+)$/;

/**
 * react-hook-form path of an error key, nested groups included: "b.holders[r1].holders[r2].percent"
 * → ["b__holders", 0, "holders", 1, "percent"]. Null when a row is not (or no longer) there.
 */
export function keyPath(key: string, answers: AnyAnswers): (string | number)[] | null {
  const parts = key.split(/\[([a-z0-9]+)\]\./);
  const path: (string | number)[] = [toName(parts[0])];
  let rows = rowsIn(answers, parts[0]);
  for (let i = 1; i < parts.length; i += 2) {
    const index = rows.findIndex((r) => r._id === parts[i]);
    if (index < 0) return null;
    path.push(index, parts[i + 1]);
    rows = rowsIn(rows[index], parts[i + 1]);
  }
  return path;
}

/** The [data-field] of an error key: the control's react-hook-form name ("group.index.field"). */
export function keyName(key: string, answers: AnyAnswers): string | null {
  const path = keyPath(key, answers);
  return path ? path.join(".") : null;
}

/** Scrolls to a control (by its [data-field]) and focuses its first focusable element (never a hidden file input). */
export function focusField(name: string | undefined) {
  if (!name || typeof document === "undefined") return;
  const container = document.querySelector<HTMLElement>(`[data-field="${CSS.escape(name)}"]`);
  if (!container) return;
  container.scrollIntoView({ behavior: "smooth", block: "center" });
  const target = container.querySelector<HTMLElement>("input:not([type=hidden]):not([type=file]), textarea, button, [role=combobox], [role=radio], [role=checkbox], [tabindex]");
  (target || container).focus({ preventScroll: true });
}
