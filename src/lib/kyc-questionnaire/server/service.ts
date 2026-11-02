import { createHash, createHmac, randomBytes } from "node:crypto";
import { EMAIL_RE } from "../../tax-questionnaire/format";
import { checkUpload, extensionOf, safeName, sniffMismatch, UPLOAD_LIMITS } from "../../tax-questionnaire/files";
import { DOCS_FOLDER, docCode, documentsFor, KYC_UPLOAD_TYPES } from "../documents";
import { pruneHidden, rowsOf, sanitizeAnswers, validateAll } from "../engine";
import { FLAG_LABELS, flagsOf, type Flag } from "../flags";
import { clientName, isPM } from "../schema";
import { KYC_LOCALES, KYC_ROUTES, type Answers, type DocDeclared, type KycLocale, type KycRoute } from "../types";
import { emailHash, issueLink } from "./access";
import { KYC_DRIVE_ID, mailSender, mockStorageEnabled, onlineSignatureEnabled, tokenSecret } from "./config";
import { plainHtml } from "../../tax-questionnaire/server/email";
import { toWinAnsi } from "../../tax-questionnaire/server/pdf";
import { appendOnlineSignatures, buildKycPdf } from "./pdf";
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
  /** Form signatories, fixed at submission (Ark may correct an address before they sign). */
  signers?: SignerRecord[];
}

/**
 * A form signatory. Each signs online in their own session, opened with a code sent to their
 * address (one code per person); the evidence is kept on the signer, then on the final PDF.
 */
export interface SignerRecord {
  /** Row id of "i.signers", or "client" for a natural person. */
  id: string;
  name: string;
  email?: string;
  emailHash?: string;
  /** Who gave the address: the form (client), the case contact by default, or Ark. */
  emailBy?: "form" | "contact" | "ark";
  emailSetAt?: string;
  /** Signature request e-mailed (signers other than the contact). */
  invitedAt?: string;
  signature?: { typed: string; email: string; at: string; pdfSha256: string };
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
  // The contact's links and sessions are replaced; the signatories' stay (a reminder to the
  // contact must not cut another signer off).
  const signerHashes = (rev.signers || []).map((s) => s.emailHash).filter((h): h is string => !!h && h !== record.emailHash);
  await getPorts().access.revokeCase(record.caseId, rev.state === "awaiting_signature" ? signerHashes : []);
  const link = await issueLink({ caseId: record.caseId, revision: rev.n, emailHash: record.emailHash, locale: record.language });
  rev.invitedAt = now();
  await saveCase(record);
  await track(record, rev);
  return link;
}

export type StaffAction = "link" | "reopen" | "close" | "signers";

export async function staffAction(
  caseId: string,
  action: StaffAction,
  body: { expectedRevision?: unknown; prefill?: unknown; route?: unknown; email?: unknown; signers?: unknown },
  meta: { idempotencyKey: string; payloadHash: string },
): Promise<{ summary: StaffSummary; link?: LinkResult; replayed: boolean }> {
  return locked(caseId, async () => {
    const record = await loadCase(caseId);
    const done = record.idempotency[meta.idempotencyKey];
    if (done) {
      if (done.hash !== meta.payloadHash) throw new KycError("idempotency_conflict", 409);
      const rev = latest(record);
      if (action === "signers") {
        // A replay sends the requests a mail failure left unsent, nothing else.
        if (rev.state === "awaiting_signature" && (rev.signers || []).some((x) => !x.invitedAt && !x.signature && x.emailHash && x.emailHash !== record.emailHash)) {
          await requestSignatures(record, rev);
          await saveCase(record);
        }
        return { summary: summarize(record), replayed: true };
      }
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
      // A new contact address: the new link and codes go to it; old links and sessions are revoked.
      if (body.email !== undefined) {
        const email = typeof body.email === "string" ? body.email.trim() : "";
        if (!EMAIL_RE.test(email) || email.length > 200) throw new KycError("invalid_request", 400, { field: "email" });
        // A signatory who signs at the contact address moves with it (unless already signed).
        for (const signer of rev.signers || []) {
          if (signer.emailBy === "contact" && signer.emailHash === record.emailHash && !signer.signature) {
            Object.assign(signer, { email, emailHash: emailHash(email), emailSetAt: now() });
          }
        }
        record.email = email;
        record.emailHash = emailHash(email);
      }
      remember(rev.n);
      const link = await relink(record);
      return { summary: summarize(record), link, replayed: false };
    }

    if (action === "signers") {
      // Ark gives or corrects signatories' addresses before they sign; each new address gets a request.
      if (rev.state !== "awaiting_signature") throw new KycError("invalid_state", 409, { state: rev.state });
      if (!rev.signers) {
        const answers = await readSubmitted(record, rev);
        if (!answers) throw new KycError("invalid_state", 409, { state: rev.state });
        rev.signers = buildSigners(answers, record);
      }
      const items = Array.isArray(body.signers) ? (body.signers as unknown[]).slice(0, 10) : [];
      if (!items.length) throw new KycError("invalid_request", 400, { field: "signers" });
      for (const raw of items) {
        const item = (raw || {}) as { id?: unknown; email?: unknown };
        const signer = rev.signers.find((s) => s.id === item.id);
        const email = typeof item.email === "string" ? item.email.trim() : "";
        if (!signer) throw new KycError("invalid_request", 400, { field: "signers.id" });
        if (signer.signature) throw new KycError("signer_signed", 409, { id: signer.id });
        if (!EMAIL_RE.test(email) || email.length > 200) throw new KycError("invalid_request", 400, { field: "signers.email" });
        // A new address gets a new request; the same address keeps its request (sent or still due).
        if (signer.emailHash !== emailHash(email)) Object.assign(signer, { email, emailHash: emailHash(email), emailBy: "ark", emailSetAt: now(), invitedAt: undefined });
      }
      if (duplicateAddress(rev.signers)) throw new KycError("signer_email_duplicate", 422);
      remember(rev.n);
      await saveCase(record);
      await requestSignatures(record, rev);
      await saveCase(record);
      await track(record, rev);
      return { summary: summarize(record), replayed: false };
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
    /** Form signatories and their online signatures (none when signed on paper). */
    signers?: { id: string; name: string; email?: string; emailBy?: SignerRecord["emailBy"]; invitedAt?: string; signedAt?: string; typed?: string }[];
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
      signers: rev.signers?.map((x) => ({ id: x.id, name: x.name, email: x.email, emailBy: x.emailBy, invitedAt: x.invitedAt, signedAt: x.signature?.at, typed: x.signature?.typed })),
      documents: rev.documents,
      folder: { itemId: rev.folderId, webUrl: rev.folderUrl },
    },
    revisions: record.revisions.map((r) => ({ n: r.n, id: r.id, state: r.state })),
  };
}

/** Case summary for Cadence, with the submitted answers of the latest revision when there are some. */
export async function staffCase(caseId: string): Promise<StaffSummary & { answers?: Answers }> {
  await finishIfComplete(caseId);
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
  /** The address the session was opened with; set for every real session. */
  emailHash?: string;
}

type Role = "contact" | "signer";

/**
 * The session's case and role. The contact (current address of the case) fills the form; a
 * signer (address of a form signatory, once submitted) only reads the PDF and signs. A session
 * whose address is neither (contact changed, signer corrected by Ark) ends.
 */
async function clientContext(session: Session, allow: Role[]) {
  const record = await loadCase(session.caseId);
  if (!session.emailHash) throw new KycError("session_expired", 401);
  const rev = revisionOf(record, session.revision);
  if (!rev) throw new KycError("case_not_found", 404);
  if (rev.state === "superseded") throw new KycError("revision_superseded", 410);
  if (record.closedAt || rev.state === "closed") throw new KycError("case_closed", 410);
  const signing = rev.state === "awaiting_signature" || rev.state === "signed";
  const mine = signing ? (rev.signers || []).filter((s) => s.emailHash === session.emailHash).map((s) => s.id) : [];
  const role: Role | null = session.emailHash === record.emailHash ? "contact" : mine.length ? "signer" : null;
  if (!role) throw new KycError("session_expired", 401);
  if (!allow.includes(role)) throw new KycError("not_allowed", 403);
  return { record, rev, role, mine };
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

/**
 * Everyone signed but the PDF was not filed (a failure after the last signature was saved):
 * finish now. Called when the case is read, so no one has to sign again.
 */
async function finishIfComplete(caseId: string) {
  await locked(caseId, async () => {
    const record = await loadCase(caseId);
    const rev = latest(record);
    if (rev.state === "awaiting_signature" && rev.signers?.length && rev.signers.every((s) => s.signature)) await finishOnline(record, rev);
  }).catch((error) => console.error("kyc finish online", error instanceof Error ? error.message : "error"));
}

export async function clientCase(session: Session) {
  await finishIfComplete(session.caseId);
  const { record, rev, role, mine } = await clientContext(session, ["contact", "signer"]);
  const signing = rev.state === "awaiting_signature" || rev.state === "signed" ? await signingView(record, rev, role, mine) : null;
  // A signer sees the signing screen only: not the answers, documents or scans.
  if (role === "signer") {
    return {
      caseId: record.caseId,
      revision: rev.n,
      route: record.route,
      language: record.language,
      state: rev.state,
      displayName: record.displayName,
      prefilledIds: [],
      draft: null,
      answers: { route: record.route },
      files: [],
      signedFiles: [],
      declarationId: rev.declarationId || null,
      submittedAt: rev.submittedAt || null,
      signedAt: rev.signedAt || null,
      signing,
    };
  }
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
    signing,
  };
}

const maskAddress = (email: string) => email.replace(/^(.)(.*)(@.*)$/, (_m, a: string, b: string, c: string) => `${a}${"•".repeat(Math.min(6, b.length))}${c}`);

/** What the signing screen shows: who signs, who has signed, and what this session may do. */
async function signingView(record: CaseRecord, rev: RevisionRecord, role: Role, mine: string[]) {
  const signers = rev.signers || [];
  const onlineStarted = signers.some((s) => s.signature);
  // Once online has started, a late scan no longer blocks it (the server ignores it too).
  const paperStarted = !onlineStarted && rev.state === "awaiting_signature" && (await signedFiles(record, rev)).length > 0;
  return {
    role,
    online: onlineReady(rev),
    onlineStarted,
    paperStarted,
    signers: signers.map((s) => ({
      id: s.id,
      name: s.name,
      signed: !!s.signature,
      mine: mine.includes(s.id),
      emailHint: s.email ? maskAddress(s.email) : null,
    })),
  };
}

/** Names compared without case, accents, punctuation or word order. */
const nameKey = (v: string) =>
  v
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .sort()
    .join(" ");

/** The name prints in the PDF (its fonts are Latin only) and can be compared. */
const printable = (name: string) => !!name && !!nameKey(name) && nameKey(toWinAnsi(name)) === nameKey(name);

/**
 * Signatories fixed at submission: the client (natural person, at the case address), or the
 * company's signatories with the addresses given in the form. A company's sole signatory with no
 * address signs at the case address. Two signatories never share an address (one mailbox would
 * sign for both).
 */
function buildSigners(answers: Answers, record: CaseRecord): SignerRecord[] {
  const at = now();
  if (!isPM(answers)) {
    return [{ id: "client", name: clientName(answers) || record.displayName, email: record.email, emailHash: record.emailHash, emailBy: "contact", emailSetAt: at }];
  }
  const rows = rowsOf(answers, "i.signers");
  return rows.map((row) => {
    const email = str(row.email);
    const name = `${str(row.firstName)} ${str(row.lastName)}`.trim();
    if (email && EMAIL_RE.test(email)) return { id: String(row._id), name, email, emailHash: emailHash(email), emailBy: "form" as const, emailSetAt: at };
    if (rows.length === 1) return { id: String(row._id), name, email: record.email, emailHash: record.emailHash, emailBy: "contact" as const, emailSetAt: at };
    return { id: String(row._id), name };
  });
}

const duplicateAddress = (signers: SignerRecord[]) => {
  const hashes = signers.map((s) => s.emailHash).filter(Boolean);
  return new Set(hashes).size !== hashes.length;
};

/** Online signing is possible: every signatory has an address of their own and a printable name. */
function onlineReady(rev: RevisionRecord): boolean {
  const signers = rev.signers || [];
  return onlineSignatureEnabled() && signers.length > 0 && signers.every((s) => s.emailHash && printable(s.name)) && !duplicateAddress(signers);
}

const SIGN_MAIL = {
  fr: {
    subject: (company: string) => `Signature du formulaire KYC – ${company}`,
    blocks: (name: string, company: string, url: string) => [
      `Bonjour ${name},`,
      `Ark Fiduciaire SA vous invite à signer en ligne le formulaire de connaissance du client (KYC) de ${company}, dont vous êtes signataire.`,
      { link: url, label: "Ouvrir le formulaire à signer" },
      "Un code à 6 chiffres vous sera envoyé à cette adresse pour vous identifier. Le lien est valable 21 jours. Vous pouvez aussi demander un code sur kyc.ark-fid.ch avec cette adresse.",
      "Ark Fiduciaire SA",
    ],
  },
  en: {
    subject: (company: string) => `Signing the KYC form – ${company}`,
    blocks: (name: string, company: string, url: string) => [
      `Dear ${name},`,
      `Ark Fiduciaire SA invites you to sign online the know-your-customer (KYC) form of ${company}, as one of its signatories.`,
      { link: url, label: "Open the form to sign" },
      "A 6-digit code will be sent to this address to identify you. The link is valid for 21 days. You can also request a code at kyc.ark-fid.ch with this address.",
      "Ark Fiduciaire SA",
    ],
  },
} as const;

/**
 * Signature requests to the signatories other than the contact (who is already on the form):
 * a link bound to their address, and one e-mail with fixed wording. A failure leaves the signer
 * unrequested; the next submit retry or Ark's correction sends it.
 */
async function requestSignatures(record: CaseRecord, rev: RevisionRecord) {
  if (rev.state !== "awaiting_signature" || !onlineReady(rev)) return;
  for (const signer of rev.signers || []) {
    if (signer.signature || signer.invitedAt || !signer.email || !signer.emailHash || signer.emailHash === record.emailHash) continue;
    try {
      const link = await issueLink({ caseId: record.caseId, revision: rev.n, emailHash: signer.emailHash, locale: record.language });
      const text = SIGN_MAIL[record.language];
      await getPorts().sendMail({ from: mailSender(), to: [signer.email], cc: [], subject: text.subject(record.displayName), html: plainHtml([...text.blocks(signer.name, record.displayName, link.url)]) });
      signer.invitedAt = now();
    } catch (error) {
      console.error("kyc signature request", error instanceof Error ? error.message : "error");
    }
  }
}

/**
 * A signatory signs in the form: their session (opened with the code sent to their address)
 * identifies them; they accept the declarations and type their name. The signature is recorded
 * at once; when the last one signs, the PDF they checked gets a signature page listing everyone
 * and is filed in "Signé" with its SHA-256, like a scan.
 */
export async function signOnline(session: Session, body: { name?: unknown; accept?: unknown; declarationId?: unknown }) {
  return locked(session.caseId, async () => {
    const { record, rev, mine } = await clientContext(session, ["contact", "signer"]);
    // The form shown in the browser must be this one (another tab may have opened another case).
    if (!rev.declarationId || str(body.declarationId) !== rev.declarationId) throw new KycError("case_changed", 409);
    if (rev.state === "signed") {
      // A retry after a failed tracker update brings "Suivi KYC" up to date.
      await track(record, rev);
      return { state: rev.state };
    }
    if (rev.state !== "awaiting_signature" || !rev.pdf) throw new KycError("not_editable", 409);
    const signers = rev.signers || [];
    const own = signers.filter((s) => mine.includes(s.id));
    if (!own.length) throw new KycError("not_a_signer", 403);
    const pending = own.find((s) => !s.signature);
    if (!pending) {
      // Already signed: finish if everyone has (a retry after a failure while filing the PDF).
      if (signers.every((s) => s.signature)) await finishOnline(record, rev);
      return { state: rev.state };
    }
    if (!onlineReady(rev)) throw new KycError("online_signature_unavailable", 409);
    // A scan blocks starting online; once online has started, a late scan upload is ignored.
    if (!signers.some((s) => s.signature) && (await signedFiles(record, rev)).length) throw new KycError("paper_started", 409);
    if (body.accept !== true) throw new KycError("signature_not_accepted", 422);
    const typed = str(body.name).slice(0, 200);
    if (!typed || nameKey(typed) !== nameKey(pending.name)) throw new KycError("signature_name", 422);
    const original = await getPorts().storage.readFile(record.driveId, rev.folderId, rev.pdf.name);
    if (!original) throw new KycError("pdf_not_ready", 409);
    // The evidence is saved before the PDF is built: a later failure never asks to sign again.
    pending.signature = { typed, email: pending.email || "", at: now(), pdfSha256: sha256(original) };
    await saveCase(record);
    await track(record, rev);
    if (signers.every((s) => s.signature)) await finishOnline(record, rev);
    return { state: rev.state };
  });
}

/** Every signatory has signed: the checked PDF plus the signature page, filed in "Signé". */
async function finishOnline(record: CaseRecord, rev: RevisionRecord) {
  const signers = rev.signers || [];
  const { storage } = getPorts();
  const original = await storage.readFile(record.driveId, rev.folderId, rev.pdf!.name);
  if (!original) throw new KycError("pdf_not_ready", 409);
  const pdfSha256 = sha256(original);
  // Everyone signed this very document.
  if (signers.some((s) => s.signature?.pdfSha256 !== pdfSha256)) throw new KycError("pdf_changed", 409);
  const signedPdf = await appendOnlineSignatures(original, {
    language: record.language,
    declarationId: rev.declarationId || "",
    signers: signers.map((s) => ({ name: s.name, typed: s.signature!.typed, email: s.signature!.email, at: s.signature!.at, byArk: s.emailBy === "ark" })),
    pdfSha256,
    jsonSha256: rev.json?.sha256 || "",
  });
  const folderId = await storage.ensureSubfolder(record.driveId, rev.folderId, SIGNED_FOLDER);
  const fileName = safeName(`Formulaire KYC - ${record.displayName} - R${rev.n} - signé en ligne`, 120) + ".pdf";
  const file = await storage.putFile(record.driveId, folderId, fileName, signedPdf, "application/pdf");
  rev.signed = [{ itemId: file.id, name: file.name, sha256: sha256(signedPdf), size: signedPdf.byteLength, webUrl: file.webUrl }];
  rev.signedAt = signers.map((s) => s.signature!.at).sort().pop();
  rev.state = "signed";
  await saveCase(record);
  await track(record, rev);
}

/**
 * Who may receive a code for this case at this address: the contact, or a signatory who has not
 * signed yet while the form awaits signature (latest revision). Null otherwise.
 */
export async function accessFor(caseId: string, hash: string) {
  const record = await loadCase(caseId);
  const rev = latest(record);
  const base = { caseId, displayName: record.displayName, language: record.language, revision: rev.n, state: rev.state, closed: !!record.closedAt };
  if (hash === record.emailHash) return { ...base, email: record.email };
  if (rev.state !== "awaiting_signature" || !onlineReady(rev)) return null;
  const signer = (rev.signers || []).find((s) => s.emailHash === hash && !s.signature);
  return signer?.email ? { ...base, email: signer.email } : null;
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
    const { record, rev } = await clientContext(session, ["contact"]);
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
    const { record, rev } = await clientContext(session, ["contact"]);
    const fileName = str(body.fileName);
    const check = checkUpload(fileName, Number(body.size), str(body.mime));
    if (!check.ok) throw new KycError(check.error, 400);
    // PDF and images only: no office documents (macros) in the AML file.
    if (!KYC_UPLOAD_TYPES.has(check.ext)) throw new KycError("file_type", 400);
    const { storage } = getPorts();
    const base = safeName(fileName.replace(/\.[^.]+$/, ""), 70);
    if (body.kind === "signed") {
      if (rev.state !== "awaiting_signature") throw new KycError("not_editable", 409);
      // One way per revision: once someone has signed online, the others sign online too.
      if ((rev.signers || []).some((s) => s.signature)) throw new KycError("online_signing_started", 409);
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
    const { record, rev } = await clientContext(session, ["contact"]);
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
    const { record, rev } = await clientContext(session, ["contact"]);
    const submitKey = str(body.submitKey).slice(0, 40);
    if (rev.state !== "open") {
      if (submitKey && rev.submitKey === submitKey) {
        // A retry sends the signature requests a failure left unsent.
        if (rev.state === "awaiting_signature" && (rev.signers || []).some((s) => !s.invitedAt && s.emailHash && s.emailHash !== record.emailHash)) {
          await requestSignatures(record, rev);
          await saveCase(record);
        }
        return { state: rev.state, declarationId: rev.declarationId || null };
      }
      throw new KycError("not_editable", 409);
    }
    const answers = pruneHidden({ ...sanitizeAnswers(body.answers), route: record.route });
    const errors = validateAll(answers);
    if (Object.keys(errors).length) throw new KycError("invalid_answers", 422, { fields: Object.keys(errors).slice(0, 50) });
    const signers = buildSigners(answers, record);
    if (duplicateAddress(signers)) throw new KycError("signer_email_duplicate", 422, { fields: ["i.signers"] });
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
      rev.signers = signers;
      const pdf = await buildKycPdf(submission, rev.declarationId, { online: onlineReady(rev) });
      const pdfName = safeName(`Formulaire KYC - ${submission.clientName} - R${rev.n} - à signer`, 120) + ".pdf";
      const pdfFile = await storage.putFile(record.driveId, rev.folderId, pdfName, pdf, "application/pdf");
      rev.pdf = { itemId: pdfFile.id, name: pdfFile.name, webUrl: pdfFile.webUrl };
      rev.state = "awaiting_signature";
    }
    if (submission.clientName) record.displayName = submission.clientName;
    await saveCase(record);
    await track(record, rev);
    if (rev.state === "awaiting_signature") {
      await requestSignatures(record, rev);
      await saveCase(record);
    }
    return { state: rev.state, declarationId: rev.declarationId || null };
  });
}

export async function readPdf(session: Session): Promise<{ name: string; bytes: Uint8Array }> {
  const { record, rev } = await clientContext(session, ["contact", "signer"]);
  if (!rev.pdf) throw new KycError("pdf_not_ready", 409);
  const bytes = await getPorts().storage.readFile(record.driveId, rev.folderId, rev.pdf.name);
  if (!bytes) throw new KycError("pdf_not_ready", 409);
  return { name: rev.pdf.name, bytes };
}

/** The client confirms the signed form is uploaded: files hashed, revision signed (frozen). */
export async function confirmSigned(session: Session) {
  return locked(session.caseId, async () => {
    const { record, rev } = await clientContext(session, ["contact"]);
    if (rev.state === "signed") {
      await track(record, rev);
      return { state: rev.state };
    }
    if (rev.state !== "awaiting_signature") throw new KycError("not_editable", 409);
    if ((rev.signers || []).some((s) => s.signature)) throw new KycError("online_signing_started", 409);
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
  return { email: record.email, emailHash: record.emailHash, language: record.language, displayName: record.displayName, state: latest(record).state, revision: latest(record).n, closed: !!record.closedAt };
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
