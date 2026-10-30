import { createHash, createHmac, randomBytes } from "node:crypto";
import { EMAIL_RE } from "../../tax-questionnaire/format";
import { checkUpload, extensionOf, safeName, sniffMismatch, UPLOAD_LIMITS } from "../../tax-questionnaire/files";
import { DOCS_FOLDER, docCode, documentsFor, KYC_UPLOAD_TYPES } from "../documents";
import { pruneHidden, sanitizeAnswers, validateAll } from "../engine";
import { FLAG_LABELS, flagsOf, type Flag } from "../flags";
import { clientName } from "../schema";
import { KYC_LOCALES, KYC_ROUTES, type Answers, type DocDeclared, type KycLocale, type KycRoute } from "../types";
import { emailHash, issueLink } from "./access";
import { KYC_DRIVE_ID, mockStorageEnabled, tokenSecret } from "./config";
import { buildKycPdf } from "./pdf";
import type { RevisionState, TrackerRow } from "./ports";
import { getPorts } from "./sharepoint";

/**
 * KYC cases. A case belongs to one client folder on LBA - OAR and has numbered revisions; a
 * revision is filled once, then frozen: its JSON (with its SHA-256), the PDF to sign and the
 * signed scan are never rewritten. A correction is a new revision (Henri, 29.10: the client
 * corrects and signs again). The case state lives in `case.json` in the case folder; the
 * "Suivi KYC" list mirrors it for Cadence and for people reading the list.
 */

export class KycError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: Record<string, unknown>;
  constructor(code: string, status = 400, detail?: Record<string, unknown>) {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/** A file of the client's documents, frozen at submission with its hash. */
export interface FrozenFile {
  itemId: string;
  name: string;
  size: number;
  sha256: string;
  /** Revision whose Documents folder holds the file. */
  revision: number;
}

export interface RevisionRecord {
  n: number;
  id: string;
  state: RevisionState;
  /** Route of this revision (Ark may change it on reopen; older rows keep theirs). */
  route: KycRoute;
  /** "Documents" folder of this revision (uploads); earlier revisions' folders are never touched. */
  docsFolderId: string;
  /** Documents already provided in earlier revisions, by document key: they count as provided. */
  carried?: Record<string, FrozenFile[]>;
  /** Manifest frozen at submission. */
  documents?: { key: string; status: "uploaded" | "later" | "na"; files: FrozenFile[] }[];
  createdAt: string;
  folderId: string;
  folderUrl: string;
  /** Ids of the answers pre-filled by Ark (marked "to check" in the form). */
  prefilledIds: string[];
  invitedAt?: string;
  startedAt?: string;
  submittedAt?: string;
  submitKey?: string;
  signedAt?: string;
  flags?: Flag[];
  json?: { itemId: string; sha256: string };
  pdf?: { itemId: string; name: string; webUrl: string };
  declarationId?: string;
  signed?: { itemId: string; name: string; sha256: string; size: number; webUrl: string }[];
}

export interface CaseRecord {
  v: 1;
  caseId: string;
  clientRef: string;
  displayName: string;
  route: KycRoute;
  language: KycLocale;
  email: string;
  emailHash: string;
  driveId: string;
  clientFolderId: string;
  folderId: string;
  folderUrl: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  closedAt?: string;
  revisions: RevisionRecord[];
  /** Staff requests already applied: Idempotency-Key → payload hash and result. */
  idempotency: Record<string, { hash: string; at: string; revision: number }>;
}

interface Draft {
  savedAt: string;
  stepId: string;
  answers: Answers;
  docDeclared: Record<string, DocDeclared>;
}

const CASE_FILE = "case.json";
const DRAFT_FILE = "draft.json";
const SIGNED_FOLDER = "Signé";
const now = () => new Date().toISOString();
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const sha256 = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const enc = (value: unknown) => new TextEncoder().encode(JSON.stringify(value, null, 2));

/** Stable JSON (sorted keys) for payload hashes. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

// ---- serialisation per case (single Node instance) -----------------------------------------------

const locks = new Map<string, Promise<unknown>>();
async function locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) || Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  locks.set(key, run);
  try {
    return await run;
  } finally {
    if (locks.get(key) === run) locks.delete(key);
  }
}

// ---- persistence ---------------------------------------------------------------------------------

async function readJsonFile<T>(driveId: string, folderId: string, name: string): Promise<T | null> {
  const bytes = await getPorts().storage.readFile(driveId, folderId, name);
  if (!bytes) return null;
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return null;
  }
}

export async function loadCase(caseId: string): Promise<CaseRecord> {
  if (!/^K[A-Z0-9]{12}$/.test(caseId)) throw new KycError("case_not_found", 404);
  const rows = await getPorts().tracker.ofCase(caseId);
  const row = rows[0];
  if (!row) throw new KycError("case_not_found", 404);
  const record = await readJsonFile<CaseRecord>(row.driveId, row.folderId, CASE_FILE);
  if (!record || record.caseId !== caseId) throw new KycError("case_not_found", 404);
  return record;
}

async function saveCase(record: CaseRecord) {
  record.updatedAt = now();
  await getPorts().storage.putFile(record.driveId, record.folderId, CASE_FILE, enc(record), "application/json");
}

const latest = (record: CaseRecord) => record.revisions[record.revisions.length - 1];
const revisionOf = (record: CaseRecord, n: number) => record.revisions.find((r) => r.n === n);

function trackerRow(record: CaseRecord, rev: RevisionRecord, extra: Partial<TrackerRow> = {}): TrackerRow {
  return {
    caseId: record.caseId,
    revision: rev.n,
    revisionId: rev.id,
    clientRef: record.clientRef,
    title: record.displayName,
    route: rev.route,
    language: record.language,
    state: rev.state,
    driveId: record.driveId,
    folderId: record.folderId,
    folderUrl: rev.folderUrl || record.folderUrl,
    updatedAt: now(),
    invitedAt: rev.invitedAt,
    submittedAt: rev.submittedAt,
    signedAt: rev.signedAt,
    flags: rev.flags?.length ? rev.flags.map((f) => FLAG_LABELS[f]).join("\n") : undefined,
    jsonSha256: rev.json?.sha256,
    declarationId: rev.declarationId,
    pdfUrl: rev.pdf?.webUrl,
    signedUrl: rev.signed?.[0]?.webUrl,
    ...extra,
  };
}

async function track(record: CaseRecord, rev: RevisionRecord, extra: Partial<TrackerRow> = {}) {
  await getPorts().tracker.upsert(trackerRow(record, rev, extra));
}

async function readDraft(record: CaseRecord, rev: RevisionRecord): Promise<Draft | null> {
  return readJsonFile<Draft>(record.driveId, rev.folderId, DRAFT_FILE);
}

async function writeDraft(record: CaseRecord, rev: RevisionRecord, draft: Draft) {
  await getPorts().storage.putFile(record.driveId, rev.folderId, DRAFT_FILE, enc(draft), "application/json");
}

/**
 * Case id derived from the creation's Idempotency-Key only (keyed hash): a retry after a partial
 * failure, even days later, lands on the same folder and resumes instead of creating a duplicate.
 */
const caseIdFor = (idempotencyKey: string) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const digest = createHmac("sha256", tokenSecret() || "kyc").update(`ark-kyc-qf|case|${idempotencyKey}`).digest();
  return `K${Array.from(digest.subarray(0, 12), (b) => alphabet[b % alphabet.length]).join("")}`;
};
const newRevisionId = () => randomBytes(9).toString("base64url");

// ---- staff (Cadence) ---------------------------------------------------------------------------

export interface CreateCaseInput {
  clientRef: string;
  displayName: string;
  route: string;
  language: string;
  email: string;
  clientFolder: { driveId: string; itemId: string };
  prefill?: unknown;
}

function checkCreate(input: CreateCaseInput) {
  const bad = (field: string) => new KycError("invalid_request", 400, { field });
  if (!(KYC_ROUTES as readonly string[]).includes(input.route)) throw bad("route");
  if (!(KYC_LOCALES as readonly string[]).includes(input.language)) throw bad("language");
  if (!EMAIL_RE.test(input.email) || input.email.length > 200) throw bad("email");
  if (!input.clientRef || input.clientRef.length > 100) throw bad("clientRef");
  if (!input.displayName || input.displayName.length > 200) throw bad("displayName");
  if (!input.clientFolder?.driveId || !input.clientFolder?.itemId) throw bad("clientFolder");
  if (!mockStorageEnabled() && input.clientFolder.driveId !== KYC_DRIVE_ID()) throw bad("clientFolder.driveId");
}

/** Answers Ark pre-filled: sanitised like client answers, the route always the case's. */
function prefillAnswers(raw: unknown, route: KycRoute): { answers: Answers; ids: string[] } {
  const answers = sanitizeAnswers(raw);
  const ids = Object.keys(answers).filter((id) => {
    const v = answers[id];
    return Array.isArray(v) ? v.length > 0 : !!v;
  });
  return { answers: { ...answers, route }, ids };
}

export interface LinkResult {
  url: string;
  expiresAt: string;
}

export async function createCase(input: CreateCaseInput, meta: { keyId: string; idempotencyKey: string; payloadHash: string }): Promise<{ summary: StaffSummary; link: LinkResult; replayed: boolean }> {
  checkCreate(input);
  return locked(`create:${meta.idempotencyKey}`, async () => {
    const { storage, tracker } = getPorts();
    const previous = await tracker.byIdempotencyKey(meta.idempotencyKey);
    if (previous) {
      const record = await loadCase(previous.caseId);
      if (record.idempotency[meta.idempotencyKey]?.hash !== meta.payloadHash) throw new KycError("idempotency_conflict", 409);
      // Replay: same case; the link token is never stored, so a fresh one replaces the old.
      return { summary: summarize(record), link: await relink(record), replayed: true };
    }
    const folder = await storage.getFolder(input.clientFolder.driveId, input.clientFolder.itemId);
    if (!folder) throw new KycError("client_folder_not_found", 404);
    const route = input.route as KycRoute;
    const created = now();
    const caseId = caseIdFor(meta.idempotencyKey);
    const caseFolderName = safeName(`KYC ${caseId}`);
    const caseFolderId = await storage.ensureSubfolder(folder.driveId, folder.folderId, caseFolderName);
    const existing = await readJsonFile<CaseRecord>(folder.driveId, caseFolderId, CASE_FILE);
    if (existing) {
      // An earlier attempt got this far: same request → finish it; another request → conflict.
      if (existing.idempotency[meta.idempotencyKey]?.hash !== meta.payloadHash) throw new KycError("idempotency_conflict", 409);
      await track(existing, existing.revisions[0], { idempotencyKey: meta.idempotencyKey, createdBy: meta.keyId });
      return { summary: summarize(existing), link: await relink(existing), replayed: true };
    }
    const caseFolder = await storage.getFolder(folder.driveId, caseFolderId);
    const revFolderId = await storage.ensureSubfolder(folder.driveId, caseFolderId, "Révision 1");
    const revFolder = await storage.getFolder(folder.driveId, revFolderId);
    const docsFolderId = await storage.ensureSubfolder(folder.driveId, revFolderId, DOCS_FOLDER);
    const { answers, ids } = prefillAnswers(input.prefill, route);
    const record: CaseRecord = {
      v: 1,
      caseId,
      clientRef: input.clientRef,
      displayName: input.displayName,
      route,
      language: input.language as KycLocale,
      email: input.email.trim(),
      emailHash: emailHash(input.email),
      driveId: folder.driveId,
      clientFolderId: folder.folderId,
      folderId: caseFolderId,
      folderUrl: caseFolder?.webUrl || "",
      createdAt: created,
      updatedAt: created,
      createdBy: meta.keyId,
      revisions: [{ n: 1, id: newRevisionId(), state: "open", route, docsFolderId, createdAt: created, folderId: revFolderId, folderUrl: revFolder?.webUrl || "", prefilledIds: ids }],
      idempotency: { [meta.idempotencyKey]: { hash: meta.payloadHash, at: created, revision: 1 } },
    };
    await writeDraft(record, record.revisions[0], { savedAt: created, stepId: "start", answers, docDeclared: {} });
    await saveCase(record);
    await track(record, record.revisions[0], { idempotencyKey: meta.idempotencyKey, createdBy: meta.keyId });
    const link = await relink(record);
    return { summary: summarize(record), link, replayed: false };
  });
}

async function relink(record: CaseRecord): Promise<LinkResult> {
  const rev = latest(record);
  await getPorts().access.revokeCase(record.caseId);
  const link = await issueLink({ caseId: record.caseId, revision: rev.n, emailHash: record.emailHash, locale: record.language });
  rev.invitedAt = now();
  await saveCase(record);
  await track(record, rev);
  return link;
}

export type StaffAction = "link" | "reopen" | "close";

export async function staffAction(
  caseId: string,
  action: StaffAction,
  body: { expectedRevision?: unknown; prefill?: unknown; route?: unknown },
  meta: { idempotencyKey: string; payloadHash: string },
): Promise<{ summary: StaffSummary; link?: LinkResult; replayed: boolean }> {
  return locked(caseId, async () => {
    const record = await loadCase(caseId);
    const done = record.idempotency[meta.idempotencyKey];
    if (done) {
      if (done.hash !== meta.payloadHash) throw new KycError("idempotency_conflict", 409);
      const rev = latest(record);
      const relinkable = action !== "close" && !record.closedAt && (rev.state === "open" || rev.state === "awaiting_signature");
      return { summary: summarize(record), link: relinkable ? await relink(record) : undefined, replayed: true };
    }
    const rev = latest(record);
    if (Number(body.expectedRevision) !== rev.n) throw new KycError("revision_conflict", 409, { latestRevision: rev.n });
    if (record.closedAt && action !== "close") throw new KycError("case_closed", 409);
    const remember = (n: number) => {
      record.idempotency[meta.idempotencyKey] = { hash: meta.payloadHash, at: now(), revision: n };
      const keys = Object.keys(record.idempotency);
      for (const key of keys.slice(0, Math.max(0, keys.length - 50))) delete record.idempotency[key];
    };

    if (action === "close") {
      if (!record.closedAt) {
        record.closedAt = now();
        // The revision's files stay as they are; only its state says the case is closed.
        rev.state = "closed";
        await getPorts().access.revokeCase(caseId);
      }
      remember(rev.n);
      await saveCase(record);
      await track(record, rev);
      return { summary: summarize(record), replayed: false };
    }

    if (action === "link") {
      if (rev.state !== "open" && rev.state !== "awaiting_signature") throw new KycError("invalid_state", 409, { state: rev.state });
      remember(rev.n);
      const link = await relink(record);
      return { summary: summarize(record), link, replayed: false };
    }

    // reopen: a new revision pre-filled with the last answers (plus Ark's corrections).
    if (rev.state === "open" || rev.state === "superseded" || rev.state === "closed") throw new KycError("invalid_state", 409, { state: rev.state });
    const route = body.route === undefined ? record.route : String(body.route);
    if (!(KYC_ROUTES as readonly string[]).includes(route)) throw new KycError("invalid_request", 400, { field: "route" });
    const { storage } = getPorts();
    const previousAnswers = (await readSubmitted(record, rev)) || (await readDraft(record, rev))?.answers || {};
    const extra = prefillAnswers(body.prefill, route as KycRoute);
    const answers: Answers = { ...sanitizeAnswers(previousAnswers), ...extra.answers, route };
    const n = rev.n + 1;
    const folderId = await storage.ensureSubfolder(record.driveId, record.folderId, `Révision ${n}`);
    const folder = await storage.getFolder(record.driveId, folderId);
    const docsFolderId = await storage.ensureSubfolder(record.driveId, folderId, DOCS_FOLDER);
    // Documents of earlier revisions stay where they are and count as provided.
    const carried: Record<string, FrozenFile[]> = { ...(rev.carried || {}) };
    for (const doc of rev.documents || []) {
      const own = doc.files.filter((f) => f.revision === rev.n);
      if (own.length) carried[doc.key] = [...(carried[doc.key] || []), ...own];
    }
    rev.state = "superseded";
    record.route = route as KycRoute;
    const next: RevisionRecord = {
      n,
      id: newRevisionId(),
      state: "open",
      route: route as KycRoute,
      docsFolderId,
      carried,
      createdAt: now(),
      folderId,
      folderUrl: folder?.webUrl || "",
      // Only what Ark pre-fills now is marked "to check": the rest was confirmed by the client.
      prefilledIds: extra.ids,
    };
    record.revisions.push(next);
    await writeDraft(record, next, { savedAt: now(), stepId: "start", answers, docDeclared: {} });
    remember(n);
    await saveCase(record);
    await track(record, rev);
    const link = await relink(record);
    return { summary: summarize(record), link, replayed: false };
  });
}

async function readSubmitted(record: CaseRecord, rev: RevisionRecord): Promise<Answers | null> {
  if (!rev.json) return null;
  const data = await readJsonFile<{ answers?: Answers }>(record.driveId, rev.folderId, "questionnaire.json");
  return data?.answers || null;
}

export interface StaffSummary {
  caseId: string;
  clientRef: string;
  displayName: string;
  route: KycRoute;
  language: KycLocale;
  closed: boolean;
  updatedAt: string;
  folder: { driveId: string; itemId: string; webUrl: string };
  actionRequired: "await_client" | "review_route" | "await_signature" | "review_kyc" | null;
  latestRevision: {
    n: number;
    id: string;
    state: RevisionState;
    createdAt: string;
    invitedAt?: string;
    startedAt?: string;
    submittedAt?: string;
    signedAt?: string;
    flags: Flag[];
    declarationId?: string;
    json?: { itemId: string; sha256: string };
    pdf?: { itemId: string; name: string };
    signed?: { itemId: string; name: string; sha256: string; size: number }[];
    /** Documents frozen at submission (item ids and SHA-256). */
    documents?: RevisionRecord["documents"];
    folder: { itemId: string; webUrl: string };
  };
  revisions: { n: number; id: string; state: RevisionState }[];
}

export function summarize(record: CaseRecord): StaffSummary {
  const rev = latest(record);
  const action: StaffSummary["actionRequired"] = record.closedAt
    ? null
    : rev.state === "open"
      ? "await_client"
      : rev.state === "returned"
        ? "review_route"
        : rev.state === "awaiting_signature"
          ? "await_signature"
          : rev.state === "signed"
            ? "review_kyc"
            : null;
  return {
    caseId: record.caseId,
    clientRef: record.clientRef,
    displayName: record.displayName,
    route: record.route,
    language: record.language,
    closed: !!record.closedAt,
    updatedAt: record.updatedAt,
    folder: { driveId: record.driveId, itemId: record.folderId, webUrl: record.folderUrl },
    actionRequired: action,
    latestRevision: {
      n: rev.n,
      id: rev.id,
      state: rev.state,
      createdAt: rev.createdAt,
      invitedAt: rev.invitedAt,
      startedAt: rev.startedAt,
      submittedAt: rev.submittedAt,
      signedAt: rev.signedAt,
      flags: rev.flags || [],
      declarationId: rev.declarationId,
      json: rev.json,
      pdf: rev.pdf ? { itemId: rev.pdf.itemId, name: rev.pdf.name } : undefined,
      signed: rev.signed?.map(({ itemId, name, sha256, size }) => ({ itemId, name, sha256, size })),
      documents: rev.documents,
      folder: { itemId: rev.folderId, webUrl: rev.folderUrl },
    },
    revisions: record.revisions.map((r) => ({ n: r.n, id: r.id, state: r.state })),
  };
}

/** Case summary for Cadence, with the submitted answers of the latest revision when there are some. */
export async function staffCase(caseId: string): Promise<StaffSummary & { answers?: Answers }> {
  const record = await loadCase(caseId);
  const answers = await readSubmitted(record, latest(record));
  return { ...summarize(record), ...(answers ? { answers } : {}) };
}

/**
 * Change feed: cases whose list rows changed after the cursor ("<updatedAt>|<caseId>"), oldest
 * first. Light rows from the list only; Cadence reads a case in full with staffCase.
 */
export async function changes(cursor: string, limit: number) {
  const rows = await getPorts().tracker.all();
  const byCase = new Map<string, TrackerRow>();
  for (const row of rows) {
    const current = byCase.get(row.caseId);
    if (!current || row.revision > current.revision || (row.revision === current.revision && row.updatedAt > current.updatedAt)) {
      byCase.set(row.caseId, { ...row, updatedAt: current && current.updatedAt > row.updatedAt ? current.updatedAt : row.updatedAt });
    }
  }
  const key = (r: TrackerRow) => `${r.updatedAt}|${r.caseId}`;
  const sorted = [...byCase.values()].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)).filter((r) => !cursor || key(r) > cursor);
  const page = sorted.slice(0, Math.max(1, Math.min(limit, 200)));
  return {
    items: page.map((r) => ({
      caseId: r.caseId,
      clientRef: r.clientRef,
      displayName: r.title,
      route: r.route,
      revision: r.revision,
      revisionId: r.revisionId,
      state: r.state,
      updatedAt: r.updatedAt,
      declarationId: r.declarationId || null,
      jsonSha256: r.jsonSha256 || null,
    })),
    nextCursor: page.length ? key(page[page.length - 1]) : cursor,
    more: sorted.length > page.length,
  };
}

// ---- client ---------------------------------------------------------------------------------------

export interface Session {
  caseId: string;
  revision: number;
}

async function clientContext(session: Session) {
  const record = await loadCase(session.caseId);
  const rev = revisionOf(record, session.revision);
  if (!rev) throw new KycError("case_not_found", 404);
  if (rev.state === "superseded") throw new KycError("revision_superseded", 410);
  if (record.closedAt || rev.state === "closed") throw new KycError("case_closed", 410);
  return { record, rev };
}

export interface ClientFile {
  id: string;
  name: string;
  size: number;
  code: string | null;
}

const codeOf = (name: string) => /^\[([0-9a-f]{12})\] /.exec(name)?.[1] || null;

async function docFiles(record: CaseRecord, rev: RevisionRecord): Promise<ClientFile[]> {
  const files = await getPorts().storage.listFiles(record.driveId, rev.docsFolderId);
  return files.filter((f) => !f.folder).map((f) => ({ id: f.id, name: f.name, size: f.size, code: codeOf(f.name) }));
}

/** Documents provided in earlier revisions (read-only for the client). */
const carriedFiles = (rev: RevisionRecord): (ClientFile & { carried: true })[] =>
  Object.entries(rev.carried || {}).flatMap(([key, files]) => files.map((f) => ({ id: f.itemId, name: f.name, size: f.size, code: docCode(key), carried: true as const })));

async function signedFiles(record: CaseRecord, rev: RevisionRecord): Promise<ClientFile[]> {
  const { storage } = getPorts();
  const folderId = await storage.ensureSubfolder(record.driveId, rev.folderId, SIGNED_FOLDER);
  const files = await storage.listFiles(record.driveId, folderId);
  return files.filter((f) => !f.folder).map((f) => ({ id: f.id, name: f.name, size: f.size, code: null }));
}

export async function clientCase(session: Session) {
  const { record, rev } = await clientContext(session);
  const draft = await readDraft(record, rev);
  const submitted = rev.state === "open" ? null : await readSubmitted(record, rev);
  return {
    caseId: record.caseId,
    revision: rev.n,
    route: record.route,
    language: record.language,
    state: rev.state,
    displayName: record.displayName,
    prefilledIds: rev.prefilledIds,
    draft: rev.state === "open" ? draft : null,
    answers: submitted || draft?.answers || { route: record.route },
    files: [...(await docFiles(record, rev)), ...carriedFiles(rev)],
    signedFiles: rev.state === "awaiting_signature" || rev.state === "signed" ? await signedFiles(record, rev) : [],
    declarationId: rev.declarationId || null,
    submittedAt: rev.submittedAt || null,
    signedAt: rev.signedAt || null,
  };
}

const sanitizeDeclared = (raw: unknown): Record<string, DocDeclared> => {
  const out: Record<string, DocDeclared> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, 200)) {
    if (/^[a-z.]{2,20}(:[a-z0-9]{6,24})?$/.test(key) && (value === "later" || value === "na")) out[key] = value;
  }
  return out;
};

export async function saveDraft(session: Session, body: { answers?: unknown; stepId?: unknown; docDeclared?: unknown }) {
  return locked(session.caseId, async () => {
    const { record, rev } = await clientContext(session);
    if (rev.state !== "open") throw new KycError("not_editable", 409);
    const answers = { ...sanitizeAnswers(body.answers), route: record.route };
    const stepId = /^[a-z.]{1,20}$/.test(str(body.stepId)) ? str(body.stepId) : "start";
    const savedAt = now();
    await writeDraft(record, rev, { savedAt, stepId, answers, docDeclared: sanitizeDeclared(body.docDeclared) });
    if (!rev.startedAt) {
      rev.startedAt = savedAt;
      await saveCase(record);
      await track(record, rev);
    }
    return { savedAt };
  });
}

export async function createUpload(session: Session, body: { kind?: unknown; docKey?: unknown; fileName?: unknown; size?: unknown; mime?: unknown }) {
  return locked(session.caseId, async () => {
    const { record, rev } = await clientContext(session);
    const fileName = str(body.fileName);
    const check = checkUpload(fileName, Number(body.size), str(body.mime));
    if (!check.ok) throw new KycError(check.error, 400);
    // PDF and images only: no office documents (macros) in the AML file.
    if (!KYC_UPLOAD_TYPES.has(check.ext)) throw new KycError("file_type", 400);
    const { storage } = getPorts();
    const base = safeName(fileName.replace(/\.[^.]+$/, ""), 70);
    if (body.kind === "signed") {
      if (rev.state !== "awaiting_signature") throw new KycError("not_editable", 409);
      const folderId = await storage.ensureSubfolder(record.driveId, rev.folderId, SIGNED_FOLDER);
      if ((await signedFiles(record, rev)).length >= 10) throw new KycError("too_many_files", 400);
      const name = `Formulaire signé R${rev.n} - ${base}.${check.ext}`;
      const { uploadUrl } = await storage.createUploadSession(record.driveId, folderId, name, Number(body.size));
      return { uploadUrl, chunkBytes: UPLOAD_LIMITS.chunkBytes };
    }
    if (rev.state !== "open") throw new KycError("not_editable", 409);
    const draft = await readDraft(record, rev);
    const items = documentsFor(pruneHidden({ ...(draft?.answers || {}), route: record.route }));
    const item = items.find((i) => i.key === str(body.docKey));
    if (!item) throw new KycError("unknown_document", 400);
    if (items.filter((i) => i.code === item.code).length > 1) throw new KycError("unknown_document", 400);
    const current = await storage.listFiles(record.driveId, rev.docsFolderId);
    if (current.length >= 80) throw new KycError("too_many_files", 400);
    if (current.reduce((sum, f) => sum + f.size, 0) + Number(body.size) > UPLOAD_LIMITS.maxTotalBytes) throw new KycError("file_size", 400);
    const short = safeName(item.label[record.language] || item.label.fr, 50);
    const name = `[${item.code}] ${short} - ${base}.${check.ext}`;
    const { uploadUrl } = await storage.createUploadSession(record.driveId, rev.docsFolderId, name, Number(body.size));
    return { uploadUrl, chunkBytes: UPLOAD_LIMITS.chunkBytes };
  });
}

/** Removes a document the client uploaded by mistake (documents of an open revision only). */
export async function deleteUpload(session: Session, body: { fileId?: unknown }) {
  return locked(session.caseId, async () => {
    const { record, rev } = await clientContext(session);
    const fileId = str(body.fileId);
    const signed = rev.state === "awaiting_signature" ? await signedFiles(record, rev) : [];
    const target = (rev.state === "open" ? await docFiles(record, rev) : signed).find((f) => f.id === fileId);
    if (!target) throw new KycError("file_not_found", 404);
    await getPorts().storage.deleteFile(record.driveId, target.id);
    return { ok: true };
  });
}

export interface SubmissionRecord {
  caseId: string;
  revision: number;
  revisionId: string;
  route: KycRoute;
  language: KycLocale;
  submittedAt: string;
  clientName: string;
  answers: Answers;
  documents: { key: string; label: string; status: "uploaded" | "later" | "na"; files: string[] }[];
  flags: Flag[];
}

export async function submit(session: Session, body: { answers?: unknown; docDeclared?: unknown; submitKey?: unknown }) {
  return locked(session.caseId, async () => {
    const { record, rev } = await clientContext(session);
    const submitKey = str(body.submitKey).slice(0, 40);
    if (rev.state !== "open") {
      if (submitKey && rev.submitKey === submitKey) return { state: rev.state, declarationId: rev.declarationId || null };
      throw new KycError("not_editable", 409);
    }
    const answers = pruneHidden({ ...sanitizeAnswers(body.answers), route: record.route });
    const errors = validateAll(answers);
    if (Object.keys(errors).length) throw new KycError("invalid_answers", 422, { fields: Object.keys(errors).slice(0, 50) });
    const declared = sanitizeDeclared(body.docDeclared);
    const suspicious = await removeSuspicious(record, rev);
    if (suspicious.length) throw new KycError("file_rejected", 422, { files: suspicious });
    const files = await docFiles(record, rev);
    const items = documentsFor(answers);
    // Two documents sharing a code would let one file count for both (row ids are the client's).
    if (new Set(items.map((i) => i.code)).size !== items.length) throw new KycError("invalid_answers", 422, { fields: [] });
    // Real sizes (the size declared when the upload started is the browser's word).
    const tooLarge = files.filter((f) => f.size > UPLOAD_LIMITS.maxFileBytes).map((f) => f.name);
    if (tooLarge.length || files.reduce((sum, f) => sum + f.size, 0) > UPLOAD_LIMITS.maxTotalBytes) throw new KycError("file_rejected", 422, { files: tooLarge });
    const documents: SubmissionRecord["documents"] = [];
    const manifest: NonNullable<RevisionRecord["documents"]> = [];
    const missing: string[] = [];
    const { storage } = getPorts();
    for (const item of items) {
      const frozen: FrozenFile[] = [...(rev.carried?.[item.key] || [])];
      for (const file of files.filter((f) => f.code === item.code)) {
        const bytes = await storage.readFile(record.driveId, rev.docsFolderId, file.name);
        if (bytes) frozen.push({ itemId: file.id, name: file.name, size: bytes.byteLength, sha256: sha256(bytes), revision: rev.n });
      }
      const status = frozen.length ? "uploaded" : declared[item.key] === "later" ? "later" : !item.required ? "na" : null;
      if (!status) missing.push(item.key);
      else {
        documents.push({ key: item.key, label: item.label.fr, status, files: frozen.map((f) => f.name) });
        manifest.push({ key: item.key, status, files: frozen });
      }
    }
    if (missing.length) throw new KycError("missing_documents", 422, { documents: missing });

    const flags = flagsOf(answers);
    const submittedAt = now();
    const submission: SubmissionRecord = {
      caseId: record.caseId,
      revision: rev.n,
      revisionId: rev.id,
      route: rev.route,
      language: record.language,
      submittedAt,
      clientName: clientName(answers) || record.displayName,
      answers,
      documents,
      flags,
    };
    const jsonBytes = enc({ ...submission, documents: manifest.map((d) => ({ ...d, label: items.find((i) => i.key === d.key)?.label.fr || d.key })) });
    const digest = sha256(jsonBytes);
    const jsonFile = await storage.putFile(record.driveId, rev.folderId, "questionnaire.json", jsonBytes, "application/json");
    await storage.putFile(record.driveId, rev.folderId, "questionnaire.sha256", new TextEncoder().encode(`${digest}  questionnaire.json\n`), "text/plain");
    rev.json = { itemId: jsonFile.id, sha256: digest };
    rev.flags = flags;
    rev.documents = manifest;
    rev.submittedAt = submittedAt;
    rev.submitKey = submitKey || undefined;
    if (flags.includes("routeMismatch")) {
      // The client's description contradicts Ark's choice of form: back to Ark, nothing to sign.
      rev.state = "returned";
    } else {
      rev.declarationId = `${record.caseId}-R${rev.n}-${digest.slice(0, 8).toUpperCase()}`;
      const pdf = await buildKycPdf(submission, rev.declarationId);
      const pdfName = safeName(`Formulaire KYC - ${submission.clientName} - R${rev.n} - à signer`, 120) + ".pdf";
      const pdfFile = await storage.putFile(record.driveId, rev.folderId, pdfName, pdf, "application/pdf");
      rev.pdf = { itemId: pdfFile.id, name: pdfFile.name, webUrl: pdfFile.webUrl };
      rev.state = "awaiting_signature";
    }
    if (submission.clientName) record.displayName = submission.clientName;
    await saveCase(record);
    await track(record, rev);
    return { state: rev.state, declarationId: rev.declarationId || null };
  });
}

export async function readPdf(session: Session): Promise<{ name: string; bytes: Uint8Array }> {
  const { record, rev } = await clientContext(session);
  if (!rev.pdf) throw new KycError("pdf_not_ready", 409);
  const bytes = await getPorts().storage.readFile(record.driveId, rev.folderId, rev.pdf.name);
  if (!bytes) throw new KycError("pdf_not_ready", 409);
  return { name: rev.pdf.name, bytes };
}

/** The client confirms the signed form is uploaded: files hashed, revision signed (frozen). */
export async function confirmSigned(session: Session) {
  return locked(session.caseId, async () => {
    const { record, rev } = await clientContext(session);
    if (rev.state === "signed") return { state: rev.state };
    if (rev.state !== "awaiting_signature") throw new KycError("not_editable", 409);
    const { storage } = getPorts();
    const folderId = await storage.ensureSubfolder(record.driveId, rev.folderId, SIGNED_FOLDER);
    const listed = (await storage.listFiles(record.driveId, folderId)).filter((f) => !f.folder);
    if (!listed.length) throw new KycError("signed_missing", 422);
    const signed: NonNullable<RevisionRecord["signed"]> = [];
    for (const file of listed) {
      const bytes = await storage.readFile(record.driveId, folderId, file.name);
      if (!bytes || !bytes.byteLength) throw new KycError("signed_missing", 422);
      const ext = extensionOf(file.name);
      if (sniffMismatch(ext, bytes.slice(0, 2048))) {
        await storage.deleteFile(record.driveId, file.id);
        throw new KycError("file_type", 400, { file: file.name });
      }
      signed.push({ itemId: file.id, name: file.name, sha256: sha256(bytes), size: bytes.byteLength, webUrl: file.webUrl });
    }
    rev.signed = signed;
    rev.signedAt = now();
    rev.state = "signed";
    await saveCase(record);
    await track(record, rev);
    return { state: rev.state };
  });
}

/** For the one-time code: the case's address and language (never sent to the browser in full). */
export async function contactOf(caseId: string) {
  const record = await loadCase(caseId);
  return { email: record.email, emailHash: record.emailHash, language: record.language, state: latest(record).state, revision: latest(record).n, closed: !!record.closedAt };
}

/** Uploaded documents whose content does not match their type (executables, scripts) are removed. */
async function removeSuspicious(record: CaseRecord, rev: RevisionRecord): Promise<string[]> {
  const { storage } = getPorts();
  const suspicious: string[] = [];
  for (const file of await docFiles(record, rev)) {
    const head = await storage.readHead(record.driveId, file.id, 2048);
    if (sniffMismatch(extensionOf(file.name), head)) {
      await storage.deleteFile(record.driveId, file.id);
      suspicious.push(file.name);
    }
  }
  return suspicious;
}
