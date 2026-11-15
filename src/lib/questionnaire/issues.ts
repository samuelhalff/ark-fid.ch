/**
 * The « what is missing » lists of the questionnaires, shared: react-hook-form errors and the
 * server's error keys (422 invalid_answers) become issues (the control's name, for focusField, and
 * its label). Each form brings its schema through a small adapter. Pure module.
 */
import { z } from "zod";
import { fromForm, keyPath, ROW_KEY, rowsIn, toId, toName, type AnyAnswers } from "./form-values";

export interface Issue {
  /** react-hook-form name, or "doc:<key>" (a document), "consent.<x>"…: also the [data-field] of the control. */
  name: string;
  label: string;
}

/** What the shared lists need to know about a form's schema, in the page's language. */
export interface IssueAdapter {
  /** Label of a top-level field; null when the id is no field. */
  fieldLabel(id: string, answers: AnyAnswers): string | null;
  /** Label of a group; null when the id is no group. */
  groupLabel(id: string, answers: AnyAnswers): string | null;
  /** Label of a field of a group's rows; null when the group has no such field. */
  rowFieldLabel(groupId: string, fieldId: string, answers: AnyAnswers): string | null;
  /** How a row is named in a list (« Directeur 2 · DUPONT Jean », « UBS »). */
  rowName(groupId: string, index: number, answers: AnyAnswers): string;
  /**
   * An answer edited by a component of its own (the KYC holders tree): the one issue pointing to that
   * component, or null for an ordinary answer. `key` is the full error key when the server sent it.
   */
  delegated?(id: string, answers: AnyAnswers, key?: string): Issue | null;
}

/** zod schema for one screen: the form's own validator (the server's rules), its messages in the page's language. */
export function stepSchema(validate: (answers: AnyAnswers) => Record<string, string>, message: (code: string) => string, extra: AnyAnswers = {}) {
  return z.record(z.unknown()).superRefine((values, ctx) => {
    const answers = { ...fromForm(values), ...extra };
    for (const [key, code] of Object.entries(validate(answers))) {
      ctx.addIssue({ code: "custom", path: keyPath(key, answers) || [toName(key.split("[")[0])], message: message(code) || code });
    }
  });
}

type ErrorNode = { message?: string; root?: { message?: string } } & Record<string, unknown>;

/** Flattens react-hook-form errors into a list of fields (schema order is kept by the caller's step). */
export function collectIssues(errors: Record<string, unknown>, answers: AnyAnswers, adapter: IssueAdapter): Issue[] {
  const out: Issue[] = [];
  for (const [name, node] of Object.entries(errors || {})) {
    if (!node || typeof node !== "object") continue;
    const id = toId(name);
    const delegated = adapter.delegated?.(id, answers);
    if (delegated) {
      out.push(delegated);
      continue;
    }
    const fieldLabel = adapter.fieldLabel(id, answers);
    if (fieldLabel !== null) {
      out.push({ name, label: fieldLabel });
      continue;
    }
    const groupLabel = adapter.groupLabel(id, answers);
    if (groupLabel === null) continue;
    const n = node as ErrorNode;
    if (n.message || n.root?.message) out.push({ name, label: groupLabel });
    if (Array.isArray(node)) {
      node.forEach((rowErrors, index) => {
        if (!rowErrors || typeof rowErrors !== "object") return;
        for (const fieldId of Object.keys(rowErrors as Record<string, unknown>)) {
          const f = adapter.rowFieldLabel(id, fieldId, answers);
          if (f !== null) out.push({ name: `${name}.${index}.${fieldId}`, label: `${f} (${adapter.rowName(id, index, answers)})` });
        }
      });
    }
  }
  return dedupe(out);
}

/** Error keys of the shared validator ("start.email", "assets.banks[rowid].bank") as issues; a key of a row no longer there is dropped. */
export function issuesFromKeys(keys: string[], answers: AnyAnswers, adapter: IssueAdapter): Issue[] {
  const out: Issue[] = [];
  for (const key of keys) {
    const delegated = adapter.delegated?.(key.split("[")[0], answers, key);
    if (delegated) {
      out.push(delegated);
      continue;
    }
    const row = ROW_KEY.exec(key);
    if (row) {
      const [, groupId, rowId, fieldId] = row;
      const index = rowsIn(answers, groupId).findIndex((r) => r._id === rowId);
      const f = adapter.rowFieldLabel(groupId, fieldId, answers);
      if (index < 0 || f === null) continue;
      out.push({ name: `${toName(groupId)}.${index}.${fieldId}`, label: `${f} (${adapter.rowName(groupId, index, answers)})` });
      continue;
    }
    const label = adapter.fieldLabel(key, answers) ?? adapter.groupLabel(key, answers);
    if (label !== null) out.push({ name: toName(key), label });
  }
  return out;
}

/** One line per place (a component gathering several answers lists them once). */
const dedupe = (list: Issue[]) => list.filter((issue, index) => list.findIndex((o) => o.name === issue.name && o.label === issue.label) === index);
