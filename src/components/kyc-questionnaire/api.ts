"use client";

/** Browser calls to /api/kyc-questionnaire/* (same origin, CSRF header, no PII in URLs). */
import type { Answers, DocDeclared, KycRoute } from "@/src/lib/kyc-questionnaire/types";

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
  headers.set("x-kqf", "1");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (init.action) headers.set("x-kqf-action", init.action);
  let res: Response;
  try {
    res = await fetch(`/api/kyc-questionnaire/${path}`, { ...init, headers, credentials: "same-origin", cache: "no-store" });
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
  /** Provided in an earlier revision: counts as provided, cannot be removed. */
  carried?: boolean;
}

export type CaseState = "open" | "returned" | "awaiting_signature" | "signed";

export interface CasePayload {
  caseId: string;
  revision: number;
  route: KycRoute;
  language: string;
  state: CaseState;
  displayName: string;
  prefilledIds: string[];
  draft: { savedAt: string; stepId: string; answers: Answers; docDeclared: Record<string, DocDeclared> } | null;
  /** Submitted answers once sent, else the draft's. */
  answers: Answers;
  files: CaseFile[];
  signedFiles: CaseFile[];
  declarationId: string | null;
  submittedAt: string | null;
  signedAt: string | null;
}

export const api = {
  config: () => call<{ maxFileBytes: number }>("config"),
  getCase: () => call<CasePayload>("case"),
  auth: (body: Record<string, unknown>) => call<{ challenge?: string; emailHint?: string; language?: string; ok?: boolean; choose?: { caseId: string; name: string }[]; pick?: string }>("auth", { method: "POST", body: JSON.stringify(body) }),
  caseAction: <T = { ok: boolean }>(action: string, body: Record<string, unknown> = {}) => call<T>("case", { method: "POST", action, body: JSON.stringify(body) }),
};

/** Link to the PDF to sign (GET with the session cookie; served as an attachment). */
export const PDF_URL = "/api/kyc-questionnaire/pdf";

// ---- chunked upload (browser → SharePoint upload session, or the dev mock) ----------------------

export interface UploadHandle {
  promise: Promise<{ name: string; size: number }>;
  cancel: () => void;
}

/** A document of section H (by its key) or the signed form. */
export type UploadTarget = { kind: "doc"; docKey: string } | { kind: "signed" };

export function uploadFile(file: File, target: UploadTarget, onProgress: (fraction: number) => void): UploadHandle {
  const controller = new AbortController();
  const promise = (async () => {
    const session = await api.caseAction<{ uploadUrl: string; chunkBytes: number }>("upload", {
      ...target,
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
