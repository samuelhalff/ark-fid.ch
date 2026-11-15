"use client";

/** Browser calls to /api/tax-questionnaire/* (same origin, CSRF header, no PII in URLs). */
import { apiCaller, uploadInChunks, type UploadHandle } from "@/src/lib/questionnaire/api-client";

export { ApiError, newSubmitKey, type UploadHandle } from "@/src/lib/questionnaire/api-client";

const call = apiCaller("tax-questionnaire", "x-tqf");

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
  /** Document keys the office already holds: not asked of the client. */
  officeDocs?: string[];
  deadlines: { id: string; label: Record<string, string>; date: string | null; level: string; note?: Record<string, string> }[];
  /** Office session (Ark staff filling the form for the client): who. */
  staffBy?: string;
}

export const api = {
  config: () => call<{ turnstileSiteKey: string; aiEnabled: boolean; maxFileBytes: number }>("config"),
  getCase: () => call<CasePayload>("case"),
  auth: (body: Record<string, unknown>) => call<{ challenge?: string; emailHint?: string; ok?: boolean; scope?: string; optedOut?: boolean }>("auth", { method: "POST", body: JSON.stringify(body) }),
  caseAction: <T = { ok: boolean }>(action: string, body: Record<string, unknown> = {}) => call<T>("case", { method: "POST", action, body: JSON.stringify(body) }),
  ai: <T>(kind: "help" | "suggest" | "extract", body: Record<string, unknown>) => call<T>(`ai/${kind}`, { method: "POST", body: JSON.stringify({ ...body, aiOptIn: true }) }),
};

export function uploadFile(file: File, target: { docKey: string; label: string }, onProgress: (fraction: number) => void): UploadHandle {
  return uploadInChunks(file, () => api.caseAction<{ uploadUrl: string; chunkBytes: number }>("upload", { docKey: target.docKey, label: target.label, fileName: file.name, size: file.size, mime: file.type || "" }), onProgress);
}
