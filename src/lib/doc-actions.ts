/**
 * What one row of a documents step offers (KYC and tax questionnaires share it).
 *
 * - required, nothing yet: choose files, "I'll send it separately", and "not applicable" only
 *   where the item can really not apply;
 * - optional, nothing yet: add a file, nothing else (an optional document needs no declaration);
 * - files received: add more files;
 * - declared ("later" / "na") without a file: a quiet line, with "change" when declaring is allowed.
 */
export type DocDeclared = "later" | "na";
export type DocAction = "choose" | "addFile" | "addMore" | "later" | "na";

export interface DocRowState {
  required: boolean;
  /** The item can genuinely not apply to this client ("not applicable" is offered). */
  canNotApply: boolean;
  received: boolean;
  status?: DocDeclared | null;
  /** The page lets the client declare "later" / "na" (false on read-only status pages). */
  canDeclare: boolean;
}

export type DocRowView = { mode: "declared"; status: DocDeclared; canChange: boolean } | { mode: "actions"; actions: DocAction[] };

export function docRowView(s: DocRowState): DocRowView {
  if (s.status && !s.received) return { mode: "declared", status: s.status, canChange: s.canDeclare };
  if (s.received) return { mode: "actions", actions: ["addMore"] };
  if (!s.required) return { mode: "actions", actions: ["addFile"] };
  const actions: DocAction[] = ["choose"];
  if (s.canDeclare) {
    actions.push("later");
    if (s.canNotApply) actions.push("na");
  }
  return { mode: "actions", actions };
}

/* ---------- per-file upload rows: idle → uploading → received / error, remove ---------- */

export type UploadRowState = "uploading" | "received" | "error";

export interface UploadRow {
  id: string;
  name: string;
  size: number;
  state: UploadRowState;
  /** 0..1 while uploading. */
  progress: number;
  /** Error code (client check or server) when state is "error". */
  error?: string;
  /** Name the storage gave the file: the row hides once the case's file list holds it. */
  storedName?: string;
}

export type UploadEvent =
  | { type: "start"; id: string; name: string; size: number; error?: string }
  | { type: "progress"; id: string; progress: number }
  | { type: "done"; id: string; storedName: string }
  | { type: "fail"; id: string; error: string }
  | { type: "retry"; id: string }
  | { type: "remove"; id: string };

/** A file the client check refuses is never sent, and retrying it would fail the same way. */
export const CLIENT_REFUSALS = ["file_type", "file_size", "file_empty"];
export const isRetryable = (error?: string) => !!error && !CLIENT_REFUSALS.includes(error);

export function uploadReducer(rows: UploadRow[], event: UploadEvent): UploadRow[] {
  const patch = (fn: (row: UploadRow) => UploadRow) => rows.map((row) => (row.id === event.id ? fn(row) : row));
  switch (event.type) {
    case "start":
      return [...rows, { id: event.id, name: event.name, size: event.size, progress: 0, ...(event.error ? { state: "error", error: event.error } : { state: "uploading" }) }];
    case "progress":
      return patch((row) => (row.state === "uploading" ? { ...row, progress: Math.max(row.progress, Math.min(1, event.progress)) } : row));
    case "done":
      return patch((row) => ({ ...row, state: "received", progress: 1, storedName: event.storedName, error: undefined }));
    case "fail":
      return patch((row) => ({ ...row, state: "error", error: event.error }));
    case "retry":
      return patch((row) => (row.state === "error" && isRetryable(row.error) ? { ...row, state: "uploading", progress: 0, error: undefined } : row));
    case "remove":
      return rows.filter((row) => row.id !== event.id);
  }
}

/** Rows still worth showing next to the case's files (a received one shows until the list holds it). */
export const pendingRows = (rows: UploadRow[], stored: { name: string }[]) =>
  rows.filter((row) => !(row.state === "received" && row.storedName && stored.some((file) => file.name === row.storedName)));

/** The name shown to the client (without the internal "[code] " prefix). */
export const shownName = (name: string) => name.replace(/^\[[0-9a-f]{6,12}\] /, "");

/** "840 Ko", "1,2 Mo" (fr) / "840 KB", "1.2 MB" (en, de). */
export function formatSize(bytes: number, locale: string) {
  const fr = locale === "fr";
  const tag = fr ? "fr-CH" : locale === "de" ? "de-CH" : "en-GB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} ${fr ? "Ko" : "KB"}`;
  return `${new Intl.NumberFormat(tag, { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} ${fr ? "Mo" : "MB"}`;
}
