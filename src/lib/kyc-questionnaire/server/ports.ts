import type { MailMessage, TaxStorage } from "../../tax-questionnaire/server/storage";

/**
 * What the KYC service needs from the outside, so tests run in memory: file storage (SharePoint
 * library or a local folder), the "Suivi KYC" list (one row per revision), the access store and
 * the mail sender (one-time codes only).
 */

export type RevisionState = "open" | "returned" | "awaiting_signature" | "signed" | "superseded" | "closed";

/** One row of "Suivi KYC": a revision of a case. */
export interface TrackerRow {
  caseId: string;
  revision: number;
  revisionId: string;
  clientRef: string;
  title: string;
  route: string;
  language: string;
  state: RevisionState;
  driveId: string;
  /** The case folder (inside the client's folder). */
  folderId: string;
  folderUrl: string;
  updatedAt: string;
  invitedAt?: string;
  submittedAt?: string;
  signedAt?: string;
  flags?: string;
  jsonSha256?: string;
  declarationId?: string;
  pdfUrl?: string;
  signedUrl?: string;
  /** Set on the first revision only: the create request's Idempotency-Key and payload hash. */
  idempotencyKey?: string;
  createdBy?: string;
}

export interface TrackerPort {
  /** Creates or updates the row of (caseId, revision); returns the list item id. */
  upsert(row: TrackerRow): Promise<string>;
  /** Rows of a case (all revisions). */
  ofCase(caseId: string): Promise<TrackerRow[]>;
  byIdempotencyKey(key: string): Promise<TrackerRow | null>;
  /** All rows (small volume: one client base), for the change feed. */
  all(): Promise<TrackerRow[]>;
}

export interface AccessRecord {
  keyHash: string;
  kind: "link" | "session";
  caseId: string;
  revision: number;
  emailHash: string;
  expiresAt: number;
  revoked: boolean;
}

export interface AccessPort {
  put(record: AccessRecord): Promise<void>;
  get(keyHash: string): Promise<AccessRecord | null>;
  revoke(keyHash: string): Promise<void>;
  revokeCase(caseId: string): Promise<void>;
}

export interface KycPorts {
  storage: TaxStorage;
  tracker: TrackerPort;
  access: AccessPort;
  sendMail(message: MailMessage): Promise<void>;
}

// ---- in memory (tests, mock mode) ----------------------------------------------------------------

export function memoryTracker(): TrackerPort & { rows: TrackerRow[] } {
  const rows: TrackerRow[] = [];
  return {
    rows,
    async upsert(row) {
      const index = rows.findIndex((r) => r.caseId === row.caseId && r.revision === row.revision);
      if (index >= 0) rows[index] = { ...rows[index], ...row };
      else rows.push({ ...row });
      return `${row.caseId}:${row.revision}`;
    },
    async ofCase(caseId) {
      return rows.filter((r) => r.caseId === caseId).map((r) => ({ ...r }));
    },
    async byIdempotencyKey(key) {
      const found = rows.find((r) => r.idempotencyKey === key);
      return found ? { ...found } : null;
    },
    async all() {
      return rows.map((r) => ({ ...r }));
    },
  };
}

export function memoryAccess(): AccessPort & { records: AccessRecord[] } {
  const records: AccessRecord[] = [];
  return {
    records,
    async put(record) {
      records.push({ ...record });
    },
    async get(keyHash) {
      const found = records.find((r) => r.keyHash === keyHash);
      return found ? { ...found } : null;
    },
    async revoke(keyHash) {
      for (const r of records) if (r.keyHash === keyHash) r.revoked = true;
    },
    async revokeCase(caseId) {
      for (const r of records) if (r.caseId === caseId) r.revoked = true;
    },
  };
}
