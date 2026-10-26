/**
 * Access: opaque magic links, e-mailed one-time codes and sessions (no accounts).
 * IMPLEMENTATION IN PROGRESS — signatures are stable (used by routes and the campaign).
 */
export type Scope = "edit" | "status";

export interface SessionInfo {
  caseId: string;
  emailHash: string;
  scope: Scope;
}

export interface IssueLinkOptions {
  caseId: string;
  emailHash: string;
  scope: Scope;
  /** resume | invitation | partner | status */
  purpose: string;
  ttlMs: number;
  /** Public origin for the link (default https://tax.ark-fid.ch). */
  origin?: string;
  locale?: string;
}

/** Creates a single-purpose link token (only its HMAC is stored) and returns the full URL. */
export async function issueLink(_options: IssueLinkOptions): Promise<string> {
  throw new Error("issueLink not implemented yet");
}
