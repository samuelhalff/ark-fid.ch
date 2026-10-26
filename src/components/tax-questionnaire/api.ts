"use client";

/** Browser calls to /api/tax-questionnaire/* (same origin, CSRF header, no PII in URLs). */

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: Record<string, unknown>;
  constructor(code: string, status: number, detail: Record<string, unknown> = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

async function call<T>(path: string, init: RequestInit & { action?: string } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("x-tqf", "1");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (init.action) headers.set("x-tqf-action", init.action);
  let res: Response;
  try {
    res = await fetch(`/api/tax-questionnaire/${path}`, { ...init, headers, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError("network", 0);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(typeof data.error === "string" ? data.error : "generic", res.status, data);
  return data as T;
}

export interface CaseFile {
  id: string;
  name: string;
  size: number;
  code: string | null;
  extra: boolean;
  year: number;
}

export interface CasePayload {
  caseId: string;
  scope: "edit" | "status";
  state: "draft" | "submitted" | "invited" | "declined";
  submittedAt: string | null;
  email: string;
  language: string;
  years: number[];
  draft: { savedAt: string; stepId: string; answers: Record<string, unknown>; docStatus: Record<string, "later" | "na">; locale: string; aiOptIn?: boolean; submitKey?: string } | null;
  files: CaseFile[];
  deadlines: { id: string; label: Record<string, string>; date: string | null; level: string; note?: Record<string, string> }[];
}

export const api = {
  config: () => call<{ turnstileSiteKey: string; aiEnabled: boolean; maxFileBytes: number }>("config"),
  getCase: () => call<CasePayload>("case"),
  auth: (body: Record<string, unknown>) => call<{ challenge?: string; emailHint?: string; ok?: boolean; scope?: string; optedOut?: boolean }>("auth", { method: "POST", body: JSON.stringify(body) }),
  caseAction: <T = { ok: boolean }>(action: string, body: Record<string, unknown> = {}) => call<T>("case", { method: "POST", action, body: JSON.stringify(body) }),
  ai: <T>(kind: "help" | "suggest" | "extract", body: Record<string, unknown>) => call<T>(`ai/${kind}`, { method: "POST", body: JSON.stringify({ ...body, aiOptIn: true }) }),
};

// ---- chunked upload (browser → SharePoint upload session, or the dev mock) ----------------------

export interface UploadHandle {
  promise: Promise<{ name: string; size: number }>;
  cancel: () => void;
}

export function uploadFile(file: File, target: { docKey: string; label: string }, onProgress: (fraction: number) => void): UploadHandle {
  const controller = new AbortController();
  const promise = (async () => {
    const session = await api.caseAction<{ uploadUrl: string; chunkBytes: number }>("upload", {
      docKey: target.docKey,
      label: target.label,
      fileName: file.name,
      size: file.size,
      mime: file.type || "",
    });
    const chunk = session.chunkBytes || 5 * 1024 * 1024;
    let result: { name: string; size: number } = { name: file.name, size: file.size };
    for (let start = 0; start < file.size; start += chunk) {
      const end = Math.min(start + chunk, file.size) - 1;
      let attempt = 0;
      for (;;) {
        try {
          // Pre-authenticated upload URL: no credentials, no custom headers besides Content-Range.
          const res = await fetch(session.uploadUrl, {
            method: "PUT",
            headers: { "Content-Range": `bytes ${start}-${end}/${file.size}` },
            body: file.slice(start, end + 1),
            signal: controller.signal,
            credentials: "omit",
          });
          if (res.status === 200 || res.status === 201) {
            const item = (await res.json().catch(() => ({}))) as { name?: string; size?: number };
            result = { name: item.name || file.name, size: item.size || file.size };
          } else if (res.status !== 202) {
            throw new ApiError("upload_failed", res.status);
          }
          break;
        } catch (error) {
          if (controller.signal.aborted) throw new ApiError("cancelled", 0);
          if (++attempt >= 3) throw error instanceof ApiError ? error : new ApiError("network", 0);
          await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        }
      }
      onProgress((end + 1) / file.size);
    }
    return result;
  })();
  return { promise, cancel: () => controller.abort() };
}

/** Submission key: date of the first attempt (yyyymmdd) + random part. */
export const newSubmitKey = () => {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return date + Array.from(bytes, (b) => (b % 36).toString(36)).join("");
};
