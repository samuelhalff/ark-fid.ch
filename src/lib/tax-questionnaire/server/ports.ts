/**
 * Ports (interfaces) between the questionnaire and Ark's back office. Today they are implemented
 * by SharePoint adapters (sharepoint-registry.ts); when Ark's Cadence app (with Odoo as CRM)
 * takes over client management and the return workflow, only new adapters are needed — the
 * form, the Excel/PDF builders, the submission service and the campaign logic use these types.
 */

/** Identity as typed by the client (never trusted for CRM writes before e-mail verification). */
export interface ClientIdentity {
  email: string;
  lastName: string;
  firstName: string;
}

export type ClientMatch =
  | { status: "matched"; id: string; url: string; isClient: boolean; hasTaxScope: boolean }
  /** Same name, no e-mail match: never written to; staff decide. */
  | { status: "ambiguous"; candidateIds: string[] }
  | { status: "none" };

/** Master client registry (today: SharePoint CRM list "Clients"). */
export interface ClientRegistry {
  match(identity: ClientIdentity): Promise<ClientMatch>;
  /**
   * After a verified submission: matched client (Acquis=Client) → add "Fiscal" scope if missing;
   * no match → create a prospect (idempotent: re-checks by e-mail first). Ambiguous → no write.
   * Never overwrites other fields. Returns the registry id and link when known.
   */
  recordTaxClient(identity: ClientIdentity, documentsUrl: string, now: Date): Promise<{ id: string; url: string; created: boolean } | null>;
  /** Campaign audience: active clients with the tax scope and an e-mail. */
  listTaxClients(): Promise<{ id: string; email: string; lastName: string; firstName: string }[]>;
}

export type ReturnState = "draft" | "submitted" | "invited" | "declined";

/** One tax return = one taxpayer or married couple × one tax year. */
export interface ReturnRecord {
  caseId: string;
  householdId: string;
  clientKey: string;
  emailHash: string;
  name: string;
  email: string;
  language: string;
  canton: string;
  taxYear: number;
  state: ReturnState;
  regime: string;
  optIn: boolean;
  aiOptIn: boolean;
  submittedAt?: string;
  docsReceived?: number;
  docsExpected?: number;
  /** SharePoint drive/folder of the year folder. */
  driveId: string;
  folderId: string;
  folderUrl: string;
  excelUrl?: string;
  pdfUrl?: string;
  jsonUrl?: string;
  crmId?: string;
  crmUrl?: string;
  crmMatch?: "matched" | "ambiguous" | "created" | "none";
  source?: string;
  invitedAt?: string;
  remindersSent?: number;
  lastReminderAt?: string;
  /** Staff-owned (read only for the app). */
  staffStatus?: string;
  extendedTo?: string;
  pbmInvolved?: boolean;
  /** Staff-owned: "Exclure de la campagne" (no notice, invitation or reminder for this client). */
  excludedFromCampaign?: boolean;
  /** Missing documents after submission (one label per line), recounted on uploads and daily. */
  missingDocs?: string;
  missingRemindersSent?: number;
  lastMissingReminderAt?: string;
  /** Staff-owned "Documents à demander": extra items merged into the client's to-do. */
  staffDocs?: string;
  /** Item id in the tracker (opaque). */
  trackerId?: string;
}

/** Per-return workflow (today: SharePoint list "Suivi questionnaires"). */
export interface ReturnTracker {
  /** Creates or updates by (caseId, taxYear); never writes staff-owned columns after creation. */
  upsert(record: ReturnRecord): Promise<string>;
  findByCase(caseId: string): Promise<ReturnRecord[]>;
  findByEmailHash(emailHash: string): Promise<ReturnRecord[]>;
  findByClientKey(clientKey: string): Promise<ReturnRecord[]>;
  listByYear(taxYear: number): Promise<ReturnRecord[]>;
  /** Sets the staff status (the app only moves "Nouveau" ↔ "Documents manquants" → "Dossier complet"). */
  setStatus(trackerId: string, status: string): Promise<void>;
  /** Records a missing-documents reminder (only these two columns). */
  markMissingReminder(trackerId: string, sent: number, at: string): Promise<void>;
}

/** Client-level campaign preferences (independent of any return). */
export interface ClientPreferences {
  clientKey: string;
  email: string;
  name: string;
  language: string;
  optIn: boolean;
  excluded: boolean;
  excludedReason?: string;
  noticeSentYear?: number;
}

export interface PreferenceStore {
  get(clientKey: string): Promise<ClientPreferences | null>;
  upsert(prefs: ClientPreferences): Promise<void>;
  listOptedIn(): Promise<ClientPreferences[]>;
}

/** Opaque link tokens, OTP challenges and sessions; values are HMACs with a server key only. */
export interface AccessRecord {
  /** HMAC of the opaque secret (lookup key). */
  keyHash: string;
  kind: "link" | "session";
  caseId: string;
  emailHash: string;
  scope: "edit" | "status";
  expiresAt: number;
  revoked: boolean;
  /** For links: purpose (resume, invitation, partner). */
  purpose?: string;
}

export interface AccessStore {
  put(record: AccessRecord): Promise<void>;
  get(keyHash: string): Promise<AccessRecord | null>;
  revoke(keyHash: string): Promise<void>;
  revokeCase(caseId: string, kind?: AccessRecord["kind"]): Promise<void>;
}
