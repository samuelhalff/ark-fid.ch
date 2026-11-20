"use client";

/** Browser calls to /api/kyc-questionnaire/* (same origin, CSRF header, no PII in URLs). */
import type { Answers, DocDeclared, ExtraDocument, KycRoute } from "@/src/lib/kyc-questionnaire/types";
import { apiCaller, uploadInChunks, type UploadHandle } from "@/src/lib/questionnaire/api-client";

export { ApiError, newSubmitKey, type UploadHandle } from "@/src/lib/questionnaire/api-client";

const call = apiCaller("kyc-questionnaire", "x-kqf");

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
  /** Document keys Ark took off this case's list: not asked here (absent on a signer's view). */
  skippedDocuments?: string[];
  officeDocuments?: string[];
  /** Documents Ark asked for on this case only, after the standard ones. */
  extraDocuments?: ExtraDocument[];
  draft: { savedAt: string; stepId: string; answers: Answers; docDeclared: Record<string, DocDeclared>; staffPrefillVersion?: number } | null;
  /** Submitted answers once sent, else the draft's. */
  answers: Answers;
  files: CaseFile[];
  signedFiles: CaseFile[];
  declarationId: string | null;
  submittedAt: string | null;
  signedAt: string | null;
  /** Once submitted: who signs, who has signed, and what this session may do. */
  signing: {
    role: "contact" | "signer" | "staff";
    /** The Ark staff member with the case open (staff session only). */
    staffName: string | null;
    online: boolean;
    onlineStarted: boolean;
    paperStarted: boolean;
    signers: { id: string; name: string; signed: boolean; signatureId: string | null; presentBy: string | null; mine: boolean; emailHint: string | null; invitedAt: string | null; inForm: boolean }[];
  } | null;
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

/** A document of section H (by its key) or the signed form. */
export type UploadTarget = { kind: "doc"; docKey: string } | { kind: "signed" };

export function uploadFile(file: File, target: UploadTarget, onProgress: (fraction: number) => void): UploadHandle {
  return uploadInChunks(file, () => api.caseAction<{ uploadUrl: string; chunkBytes: number }>("upload", { ...target, fileName: file.name, size: file.size, mime: file.type || "" }), onProgress);
}
