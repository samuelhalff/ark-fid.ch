import { createHash, createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import sharp from "sharp";
import { EMAIL_RE } from "../../tax-questionnaire/format";
import { checkUpload, extensionOf, safeName, sniffMismatch, UPLOAD_LIMITS } from "../../tax-questionnaire/files";
import { DOCS_FOLDER, docCode, documentList, documentsFor, declaredFor, holdsFile, itemKeys, KYC_UPLOAD_TYPES, retiredDocument, type Withheld } from "../documents";
import { fieldText, getField, stepText, isBlockAsked, isBlockVisible, isRetiredId, isStepVisible, pruneHidden, rowsOf, sanitizeAnswers, validateAll, validateField, validateStep, visibleSteps } from "../engine";
import { FLAG_LABELS, flagsOf, type Flag } from "../flags";
import { computedText, holderLines, personOptions } from "../holders";
import { clientName, declarations, isOp, isPM, routeDefaults, STEPS } from "../schema";
import { FORM_VERSION, upgradeAnswers, upgradeIds, upgradeMarks } from "../upgrade";
import { KYC_LOCALES, KYC_ROUTES, type Answers, type Block, type DocDeclared, type ExtraDocument, type KycLocale, type KycRoute } from "../types";
import { ASSIST_DEFAULT_MINUTES, ASSIST_MAX_MINUTES, emailHash, issueAssist, issueLink, STAFF_HASH } from "./access";
import { KYC_DRIVE_ID, mailSender, mockStorageEnabled, onlineSignatureEnabled, tokenSecret } from "./config";
import { plainHtml } from "../../tax-questionnaire/server/email";
import { toWinAnsi } from "../../tax-questionnaire/server/pdf";
import { appendOnlineSignatures, buildKycPdf } from "./pdf";
import { SIGNATURE_METHODS, signatureHash, signatureId, type SignatureMethod } from "./signature-proof";
import type { LinkReplacedVia, RevisionState, TrackerRow } from "./ports";
import { caseFileName, dataFileName, isOwnPiece, ONLINE_SIGNED_MARK, pieceFileName, SIGNED_SCAN_PREFIX, type CaseFolders } from "./layout";
import { getPorts } from "./sharepoint";
import { askCadence, companiesCadence, type AskReply, type RegisterCompany } from "./cadence";

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
  /** Who at Ark sent the form in an assistance session; then the contact signs with their own link. */
  submittedBy?: string;
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
  /** Row id of "i.signers", "client" for a natural person, or "ark…" for a signatory Ark named after submission. */
  id: string;
  name: string;
  /** The signatory's function in the company, and their name in two parts (as the form or Ark gave them). */
  function?: string;
  firstName?: string;
  lastName?: string;
  /** Ark named or changed this signatory after submission: who at Ark, and when. */
  setBy?: string;
  setAt?: string;
  email?: string;
  emailHash?: string;
  /** Who gave the address: the form (client), the case contact by default, or Ark. */
  emailBy?: "form" | "contact" | "ark";
  emailSetAt?: string;
  /** Signature request e-mailed (signers other than the contact). */
  invitedAt?: string;
  /**
   * Signature trace: who, when, from where. `ip` is the client address
   * seen by our front proxy, `linkRef` the personal link the session was opened through.
   */
  signature?: {
    typed: string; email: string; at: string; pdfSha256: string; drawnPng?: string; ip?: string; userAgent?: string; linkRef?: string;
    /** How the signature was made: the name in handwriting (auto), drawn, or an uploaded image. */
    method?: SignatureMethod;
    /** Ark staff member beside the signatory when the signature was given on the firm's screen. */
    presentBy?: string;
    /** SHA-256 over the signed PDF, answers, signatory, image, time, method and presence; its first 16 characters are the signature ID. */
    hash?: string;
  };
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
  /** Set when Cadence sent the case with its layout folders (see layout.ts): absent = the case's own `KYC <id>/` folders. */
  folders?: CaseFolders;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  closedAt?: string;
  /** Document keys Ark took off this case's list (Cadence): never asked of the client, never missing. */
  skippedDocuments?: string[];
  /** Document keys the office already holds (Cadence « Ajouter »): not asked of the client, never missing. */
  officeDocuments?: string[];
  /** Documents Ark asked for on this case only (Cadence): asked of the client after the standard ones. */
  extraDocuments?: ExtraDocument[];
  revisions: RevisionRecord[];
  /** Staff requests already applied: Idempotency-Key → payload hash and result. */
  idempotency: Record<string, { hash: string; at: string; revision: number }>;
}

interface Draft {
  savedAt: string;
  stepId: string;
  answers: Answers;
  docDeclared: Record<string, DocDeclared>;
  /** Incremented only when Ark adds answers, so an open client tab cannot erase them. */
  staffPrefillVersion?: number;
  /** Answer id → who at Ark entered its current value (assisted session or overwrite). Never sent to the client. */
  enteredBy?: Record<string, string>;
  /** Questions the answers were saved for (upgrade.ts); absent: the form before 2026-11-13. */
  formVersion?: number;
}

/**
 * Keeps `enteredBy` true after answers change: an answer whose value changed is marked with the
 * person who changed it when that is Ark staff, and unmarked when the client did.
 */
function trackEnteredBy(before: Answers, after: Answers, marks: Record<string, string> | undefined, staffBy: string | null): Record<string, string> {
  const next: Record<string, string> = {};
  for (const key of Object.keys(after)) {
    if (key === "route") continue;
    if (canonical(before[key]) !== canonical(after[key])) {
      if (staffBy) next[key] = staffBy;
    } else if (marks?.[key]) next[key] = marks[key];
  }
  return next;
}

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
  // The folder is the case's own (`case.json`) or the shared data folder (a file named for the case).
  let record: CaseRecord | null = null;
  for (const shared of [false, true]) {
    const found = await readJsonFile<CaseRecord>(row.driveId, row.folderId, caseFileName(caseId, shared));
    if (found?.caseId === caseId) {
      record = found;
      break;
    }
  }
  if (!record) throw new KycError("case_not_found", 404);
  return record;
}

async function saveCase(record: CaseRecord) {
  record.updatedAt = now();
  await getPorts().storage.putFile(record.driveId, record.folderId, caseFileName(record.caseId, !!record.folders), enc(record), "application/json");
}

/** A revision's data file: in its own folder, or among the shared data under a name that tells the case and revision. */
const dataName = (record: CaseRecord, rev: RevisionRecord, base: string) => dataFileName(record.caseId, rev.n, base, !!record.folders);

/** The folder of a revision's readable files (the form's PDFs): the shared `Pièces/`, or its own revision folder. */
const readableFolderId = (record: CaseRecord, rev: RevisionRecord) => (record.folders ? record.folders.piecesFolderId : rev.folderId);

/** The form's own PDFs: `kind` is « à signer » or « signé en ligne ». */
export function formPdfName(record: CaseRecord, rev: RevisionRecord, clientName: string, kind: string) {
  // The client's name is cut, never the kind: « à signer » and « signé en ligne » must stay two names in one folder.
  if (record.folders) return pieceFileName(`${safeName(`Formulaire KYC - ${clientName}`, 100)} - ${kind}`, "pdf", record.caseId, rev.n);
  return safeName(`Formulaire KYC - ${clientName} - R${rev.n} - ${kind}`, 120) + ".pdf";
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

/** Saved answers come back in the current form's shape (merged questions, upgrade.ts). */
async function readDraft(record: CaseRecord, rev: RevisionRecord): Promise<Draft | null> {
  const draft = await readJsonFile<Draft>(record.driveId, rev.folderId, dataName(record, rev, DRAFT_FILE));
  if (!draft?.answers || (draft.formVersion || 1) >= FORM_VERSION) return draft;
  return { ...draft, answers: upgradeAnswers(draft.answers, { infer: true }), enteredBy: upgradeMarks(draft.enteredBy) };
}

/** The answers a draft holds for questions the form no longer asks (retired): kept as they are. */
function retiredAnswers(answers: Answers | undefined): Answers {
  return Object.fromEntries(Object.entries(answers || {}).filter(([id, value]) => isRetiredId(id) && value !== undefined));
}

async function writeDraft(record: CaseRecord, rev: RevisionRecord, draft: Draft) {
  await getPorts().storage.putFile(record.driveId, rev.folderId, dataName(record, rev, DRAFT_FILE), enc({ ...draft, formVersion: FORM_VERSION }), "application/json");
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
  /** The case's `Pièces/` and `Données techniques/` (Cadence's layout); both or neither. */
  piecesFolder?: { driveId: string; itemId: string };
  technicalFolder?: { driveId: string; itemId: string };
  prefill?: unknown;
  /** Document keys Ark took off the list before sending (optional). */
  skippedDocuments?: unknown;
}

/** A list of document keys from Cadence: at most 100 distinct non-empty strings of 120 characters. */
function skippedKeys(raw: unknown, field = "skippedDocuments"): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw) || raw.length > 100 || raw.some((key) => typeof key !== "string" || !key.trim() || key.length > 120)) {
    throw new KycError("invalid_request", 400, { field });
  }
  return [...new Set(raw as string[])];
}

const EXTRA_KEY = /^extra:[A-Za-z0-9-]{1,64}$/;

/** Cadence's own documents for a case: at most 30, `extra:<id>` keys, a name, an optional help, required by default. First of a key wins. */
function extraDocs(raw: unknown): ExtraDocument[] {
  const bad = () => new KycError("invalid_request", 400, { field: "extraDocuments" });
  if (!Array.isArray(raw) || raw.length > 30) throw bad();
  const out: ExtraDocument[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw bad();
    const { key, label, help, required } = entry as Record<string, unknown>;
    if (typeof key !== "string" || !EXTRA_KEY.test(key) || typeof label !== "string") throw bad();
    const name = label.replace(/\s+/g, " ").trim();
    if (!name || name.length > 200) throw bad();
    if (help !== undefined && help !== null && typeof help !== "string") throw bad();
    const text = typeof help === "string" ? help.trim() : "";
    if (text.length > 1000) throw bad();
    if (required !== undefined && typeof required !== "boolean") throw bad();
    if (out.some((doc) => doc.key === key)) continue;
    out.push({ key, label: name, ...(text ? { help: text } : {}), required: required !== false });
  }
  return out;
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
  skippedKeys(input.skippedDocuments);
  if (!input.piecesFolder !== !input.technicalFolder) throw bad("piecesFolder");
  for (const folder of [input.piecesFolder, input.technicalFolder]) {
    if (folder && (!folder.driveId || !folder.itemId || folder.driveId !== input.clientFolder.driveId)) throw bad("piecesFolder");
  }
}

/** Answers Ark pre-filled: sanitised like client answers, the route always the case's. */
function prefillAnswers(raw: unknown, route: KycRoute): { answers: Answers; ids: string[] } {
  // Never a question that is no longer asked: the client could not see or correct it.
  const answers = Object.fromEntries(Object.entries(sanitizeAnswers(raw)).filter(([id]) => !isRetiredId(id)));
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
    // With Cadence's layout folders the case has no folders of its own: its data is in the shared
    // technical folder and its documents in the shared pieces folder (layout.ts).
    const pieces = input.piecesFolder ? await storage.getFolder(input.piecesFolder.driveId, input.piecesFolder.itemId) : null;
    const technical = input.technicalFolder ? await storage.getFolder(input.technicalFolder.driveId, input.technicalFolder.itemId) : null;
    if (input.piecesFolder && (!pieces || !technical)) throw new KycError("client_folder_not_found", 404);
    const folders: CaseFolders | undefined = pieces && technical ? { piecesFolderId: pieces.folderId, technicalFolderId: technical.folderId } : undefined;
    const caseFolderId = technical ? technical.folderId : await storage.ensureSubfolder(folder.driveId, folder.folderId, safeName(`KYC ${caseId}`));
    const existing = await readJsonFile<CaseRecord>(folder.driveId, caseFolderId, caseFileName(caseId, !!folders));
    if (existing) {
      // An earlier attempt got this far: same request → finish it; another request → conflict.
      if (existing.idempotency[meta.idempotencyKey]?.hash !== meta.payloadHash) throw new KycError("idempotency_conflict", 409);
      await track(existing, existing.revisions[0], { idempotencyKey: meta.idempotencyKey, createdBy: meta.keyId });
      return { summary: summarize(existing), link: await relink(existing), replayed: true };
    }
    const caseFolder = pieces || (await storage.getFolder(folder.driveId, caseFolderId));
    const revFolderId = folders ? caseFolderId : await storage.ensureSubfolder(folder.driveId, caseFolderId, "Révision 1");
    const revFolder = pieces || (await storage.getFolder(folder.driveId, revFolderId));
    const docsFolderId = folders ? folders.piecesFolderId : await storage.ensureSubfolder(folder.driveId, revFolderId, DOCS_FOLDER);
    const prefilled = prefillAnswers(input.prefill, route);
    const ids = prefilled.ids;
    const answers: Answers = { ...routeDefaults(route), ...prefilled.answers };
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
      ...(folders ? { folders } : {}),
      createdAt: created,
      updatedAt: created,
      createdBy: meta.keyId,
      ...(skippedKeys(input.skippedDocuments).length ? { skippedDocuments: skippedKeys(input.skippedDocuments) } : {}),
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

/**
 * A new link for the contact. `via` tells the holder of a replaced link where the new one went:
 * "email" when Cadence e-mails it (staff `link` with `notify: "email"`), "other" otherwise.
 */
async function relink(record: CaseRecord, via: LinkReplacedVia = "other"): Promise<LinkResult> {
  const rev = latest(record);
  // The contact's links and sessions are replaced; the signatories' stay (a reminder to the
  // contact must not cut another signer off).
  const signerHashes = (rev.signers || []).map((s) => s.emailHash).filter((h): h is string => !!h && h !== record.emailHash);
  await getPorts().access.revokeCase(record.caseId, rev.state === "awaiting_signature" ? signerHashes : [], { at: Date.now(), via });
  const link = await issueLink({ caseId: record.caseId, revision: rev.n, emailHash: record.emailHash, locale: record.language });
  rev.invitedAt = now();
  await saveCase(record);
  await track(record, rev);
  return link;
}

export type StaffAction = "link" | "reopen" | "close" | "signers" | "signatories" | "remind_signers" | "prefill" | "assist" | "documents";

export interface AssistResult {
  /** Opens the form for Ark staff (fragment `#assist=`); single use, shared with `code`. */
  link: string;
  /** The same single use as a short code to type on the access page ("Code cabinet"). */
  code: string;
  expiresAt: string;
}

/** Staff `link` field `notify`: "email" when Cadence e-mails the new link; anything else is "other". */
const notifyVia = (notify: unknown): LinkReplacedVia => (notify === "email" ? "email" : "other");

export async function staffAction(
  caseId: string,
  action: StaffAction,
  body: { expectedRevision?: unknown; prefill?: unknown; route?: unknown; email?: unknown; signers?: unknown; signatories?: unknown; signerIds?: unknown; by?: unknown; ttlMinutes?: unknown; overwrite?: unknown; skippedDocuments?: unknown; officeDocuments?: unknown; extraDocuments?: unknown; notify?: unknown },
  meta: { idempotencyKey: string; payloadHash: string },
): Promise<{ summary: StaffSummary; link?: LinkResult; assist?: AssistResult; reminded?: string[]; links?: ({ id: string } & LinkResult)[]; replayed: boolean }> {
  return locked(caseId, async () => {
    const record = await loadCase(caseId);
    const done = record.idempotency[meta.idempotencyKey];
    if (done) {
      if (done.hash !== meta.payloadHash) throw new KycError("idempotency_conflict", 409);
      const rev = latest(record);
      if (action === "signers" || action === "signatories") {
        // A replay sends the requests a mail failure left unsent, nothing else.
        if (rev.state === "awaiting_signature" && requestPending(record, rev)) {
          await requestSignatures(record, rev);
          await saveCase(record);
        }
        return { summary: summarize(record), replayed: true };
      }
      // A reminder replayed is not sent twice.
      if (action === "remind_signers") return { summary: summarize(record), reminded: [], replayed: true };
      // (A copied link is never stored nor remembered: each call issues a new one.)
      // Taking documents off the list issues no link: a replay answers the case as it is.
      if (action === "documents") return { summary: summarize(record), replayed: true };
      if (action === "assist") {
        // The secrets are never stored, so a replay issues a fresh access (still single use).
        const open = !record.closedAt && rev.state === "open";
        return { summary: summarize(record), assist: open ? await assistFor(record, rev, body) : undefined, replayed: true };
      }
      const relinkable = action !== "close" && !record.closedAt && (rev.state === "open" || rev.state === "awaiting_signature");
      return { summary: summarize(record), link: relinkable ? await relink(record, action === "link" ? notifyVia(body.notify) : "other") : undefined, replayed: true };
    }
    const rev = latest(record);
    // `assist` may omit expectedRevision (it always opens the latest open revision).
    if (!(action === "assist" && body.expectedRevision === undefined) && Number(body.expectedRevision) !== rev.n) throw new KycError("revision_conflict", 409, { latestRevision: rev.n });
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

    if (action === "documents") {
      // The documents Ark took off the list (Sam, 2026-11-13: « certains docs ne sont pas pertinents »):
      // the whole list, replaced. Not asked of the client from now on, never counted missing.
      // `officeDocuments`: the documents the office already holds (Cadence « Ajouter »), the whole list too.
      // `extraDocuments`: the documents Ark asked for on this case only, the whole list too.
      // Each list is replaced only when sent; at least one of them.
      const sentSkipped = body.skippedDocuments !== undefined;
      const sentOffice = body.officeDocuments !== undefined;
      const sentExtra = body.extraDocuments !== undefined;
      if (!sentSkipped && !sentOffice && !sentExtra) throw new KycError("invalid_request", 400, { field: "skippedDocuments" });
      if (sentSkipped && !Array.isArray(body.skippedDocuments)) throw new KycError("invalid_request", 400, { field: "skippedDocuments" });
      if (sentOffice && !Array.isArray(body.officeDocuments)) throw new KycError("invalid_request", 400, { field: "officeDocuments" });
      const keys = sentSkipped ? skippedKeys(body.skippedDocuments) : null;
      const office = sentOffice ? skippedKeys(body.officeDocuments, "officeDocuments") : null;
      const extra = sentExtra ? extraDocs(body.extraDocuments) : null;
      if (keys) {
        if (keys.length) record.skippedDocuments = keys;
        else delete record.skippedDocuments;
      }
      if (office) {
        if (office.length) record.officeDocuments = office;
        else delete record.officeDocuments;
      }
      if (extra) {
        if (extra.length) record.extraDocuments = extra;
        else delete record.extraDocuments;
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
      const link = await relink(record, notifyVia(body.notify));
      return { summary: summarize(record), link, replayed: false };
    }

    if (action === "prefill") {
      // Ark adds what it already holds to a form the client is filling: only empty answers are
      // filled, so nothing the client typed is overwritten (Sam, 2026-11-03).
      if (rev.state !== "open") throw new KycError("invalid_state", 409, { state: rev.state });
      if (body.overwrite !== undefined && typeof body.overwrite !== "boolean") throw new KycError("invalid_request", 400, { field: "overwrite" });
      // overwrite: Ark's values replace what the client typed (Ark's explicit choice, marked as Ark's).
      const overwrite = body.overwrite === true;
      const by = str(body.by).slice(0, 120) || "Cadence";
      const extra = prefillAnswers(body.prefill, record.route as KycRoute);
      const draft: Draft = (await readDraft(record, rev)) || { savedAt: now(), stepId: "start", answers: { route: record.route }, docDeclared: {} };
      const answered = (value: unknown) =>
        value !== undefined && value !== null && !(typeof value === "string" && !value.trim()) && !(Array.isArray(value) && !value.length);
      const current = draft.answers as Record<string, unknown>;
      const added: string[] = [];
      const marks = { ...(draft.enteredBy || {}) };
      for (const [key, value] of Object.entries(extra.answers as Record<string, unknown>)) {
        if (key === "route") continue;
        if (!answered(current[key])) {
          current[key] = value;
          added.push(key);
        } else if (overwrite && canonical(current[key]) !== canonical(value)) {
          current[key] = value;
          marks[key] = by;
          added.push(key);
        }
      }
      if (Object.keys(marks).length) draft.enteredBy = marks;
      rev.prefilledIds = [...new Set([...(rev.prefilledIds || []), ...added])];
      draft.staffPrefillVersion = (draft.staffPrefillVersion || 0) + 1;
      draft.savedAt = now();
      await writeDraft(record, rev, draft);
      remember(rev.n);
      await saveCase(record);
      await track(record, rev);
      return { summary: summarize(record), replayed: false };
    }

    if (action === "assist") {
      if (rev.state !== "open") throw new KycError("invalid_state", 409, { state: rev.state });
      const assist = await assistFor(record, rev, body);
      remember(rev.n);
      await saveCase(record);
      return { summary: summarize(record), assist, replayed: false };
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

    if (action === "signatories") {
      // Ark sets who signs, after submission and before the last signature (Sam, 2026-11-16: « quid si
      // soudainement on réalise qu'il faut 2 signatures ? »): the whole list, one or two people. A
      // signatory who has signed stays exactly as they signed; the others are replaced, removed or
      // added, and each new address gets its own request. The client's submitted answers and the PDF
      // stay as handed in (they are sealed): the signature page says whom Ark named.
      if (rev.state !== "awaiting_signature") throw new KycError("invalid_state", 409, { state: rev.state });
      if (!rev.signers) {
        const answers = await readSubmitted(record, rev);
        if (!answers) throw new KycError("invalid_state", 409, { state: rev.state });
        rev.signers = buildSigners(answers, record);
      }
      const by = str(body.by).slice(0, 120);
      if (!by) throw new KycError("invalid_request", 400, { field: "by" });
      const next = nextSignatories(rev.signers, body.signatories, by);
      if (duplicateAddress(next)) throw new KycError("signer_email_duplicate", 422);
      rev.signers = next;
      remember(rev.n);
      await saveCase(record);
      await requestSignatures(record, rev);
      await saveCase(record);
      // The one left unsigned taken off: everyone remaining has signed, the form is signed now.
      if (next.every((s) => s.signature)) await finishOnline(record, rev);
      await track(record, rev);
      return { summary: summarize(record), replayed: false };
    }

    if (action === "remind_signers") {
      // « Relancer » and Cadence's automatic reminders: each signatory who has not signed gets their
      // own request again, with a fresh link (a contact signing in the form is reminded by Cadence; one Ark filled it for is reminded here).
      // `signerIds`: only these (« Relancer » chooses; « Envoyer le lien » on one row); each must be a
      // signatory who has not signed and is not the contact. `notify: "none"` (one id): no e-mail,
      // the link comes back for Ark to copy — bound to that address, it opens only with a code sent there.
      if (rev.state !== "awaiting_signature") throw new KycError("invalid_state", 409, { state: rev.state });
      const only = chosenSigners(record, rev, body.signerIds);
      if (body.notify === "none") {
        if (!only || only.length !== 1) throw new KycError("invalid_request", 400, { field: "signerIds" });
        const signer = only[0];
        const issued = await issueLink({ caseId: record.caseId, revision: rev.n, emailHash: signer.emailHash!, locale: record.language });
        return { summary: summarize(record), links: [{ id: signer.id, ...issued }], replayed: false };
      }
      // Remembered before the mails: a retry of the same reminder never sends them twice.
      remember(rev.n);
      await saveCase(record);
      const reminded = await requestSignatures(record, rev, { again: true, only: only?.map((x) => x.id) });
      await saveCase(record);
      return { summary: summarize(record), reminded, replayed: false };
    }

    // reopen: a new revision pre-filled with the last answers (plus Ark's corrections).
    if (rev.state === "open" || rev.state === "superseded" || rev.state === "closed") throw new KycError("invalid_state", 409, { state: rev.state });
    const route = body.route === undefined ? record.route : String(body.route);
    if (!(KYC_ROUTES as readonly string[]).includes(route)) throw new KycError("invalid_request", 400, { field: "route" });
    const { storage } = getPorts();
    const previous = await readSubmission(record, rev);
    const previousDraft = previous?.answers ? null : await readDraft(record, rev);
    const previousAnswers = previous?.answers || previousDraft?.answers || {};
    const previousMarks = previous?.answers ? previous.enteredBy : previousDraft?.enteredBy;
    const extra = prefillAnswers(body.prefill, route as KycRoute);
    // The new draft takes the earlier answers in the current shape (moves of upgrade.ts) and keeps
    // the answers to questions no longer asked, read-only, like any draft.
    const earlier = upgradeAnswers(previousAnswers, { infer: true });
    const answers: Answers = { ...sanitizeAnswers(earlier), ...retiredAnswers(earlier), ...extra.answers, route };
    const n = rev.n + 1;
    // A case with the layout folders keeps filing into them; one without opens its next revision folder.
    const folderId = record.folders ? record.folders.technicalFolderId : await storage.ensureSubfolder(record.driveId, record.folderId, `Révision ${n}`);
    const folder = record.folders ? null : await storage.getFolder(record.driveId, folderId);
    const docsFolderId = record.folders ? record.folders.piecesFolderId : await storage.ensureSubfolder(record.driveId, folderId, DOCS_FOLDER);
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
      folderUrl: record.folders ? rev.folderUrl : folder?.webUrl || "",
      // Only what Ark pre-fills now is marked "to check": the rest was confirmed by the client.
      prefilledIds: extra.ids,
    };
    record.revisions.push(next);
    // Ark's entries stay marked unless the correction changed them.
    const marks = trackEnteredBy(previousAnswers, answers, previousMarks, null);
    await writeDraft(record, next, { savedAt: now(), stepId: "start", answers, docDeclared: {}, ...(Object.keys(marks).length ? { enteredBy: marks } : {}) });
    remember(n);
    await saveCase(record);
    await track(record, rev);
    const link = await relink(record);
    return { summary: summarize(record), link, replayed: false };
  });
}

/** Short-lived single-use access for Ark staff to the open revision (a link and a short code). */
async function assistFor(record: CaseRecord, rev: RevisionRecord, body: { by?: unknown; ttlMinutes?: unknown }): Promise<AssistResult> {
  const by = str(body.by).slice(0, 120);
  if (!by) throw new KycError("invalid_request", 400, { field: "by" });
  let minutes = ASSIST_DEFAULT_MINUTES;
  if (body.ttlMinutes !== undefined) {
    minutes = Number(body.ttlMinutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > ASSIST_MAX_MINUTES) throw new KycError("invalid_request", 400, { field: "ttlMinutes" });
  }
  return issueAssist({ caseId: record.caseId, revision: rev.n, by, locale: record.language, ttlMs: Math.round(minutes * 60 * 1000) });
}

async function readSubmission(record: CaseRecord, rev: RevisionRecord) {
  if (!rev.json) return null;
  const submission = await readJsonFile<{ answers?: Answers; enteredBy?: Record<string, string>; documents?: { key: string; label: string }[]; formVersion?: number }>(record.driveId, rev.folderId, dataName(record, rev, "questionnaire.json"));
  // A form sent before 2026-11-13: merged questions read in the current shape, nothing inferred.
  if (!submission?.answers || (submission.formVersion || 1) >= FORM_VERSION) return submission;
  return { ...submission, answers: upgradeAnswers(submission.answers), enteredBy: upgradeMarks(submission.enteredBy) };
}

async function readSubmitted(record: CaseRecord, rev: RevisionRecord): Promise<Answers | null> {
  return (await readSubmission(record, rev))?.answers || null;
}

export interface StaffSummary {
  caseId: string;
  clientRef: string;
  displayName: string;
  /** The contact's address: where the case link and its codes go. Cadence shows it before sending. */
  email: string;
  route: KycRoute;
  language: KycLocale;
  closed: boolean;
  updatedAt: string;
  folder: { driveId: string; itemId: string; webUrl: string };
  skippedDocuments: string[];
  officeDocuments: string[];
  extraDocuments: ExtraDocument[];
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
    signers?: { id: string; name: string; firstName?: string; lastName?: string; function?: string; email?: string; emailBy?: SignerRecord["emailBy"]; setBy?: string; setAt?: string; invitedAt?: string; signedAt?: string; typed?: string }[];
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
    email: record.email,
    route: record.route,
    language: record.language,
    closed: !!record.closedAt,
    updatedAt: record.updatedAt,
    folder: { driveId: record.driveId, itemId: record.folders ? record.folders.piecesFolderId : record.folderId, webUrl: record.folderUrl },
    skippedDocuments: record.skippedDocuments || [],
    officeDocuments: record.officeDocuments || [],
    extraDocuments: record.extraDocuments || [],
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
      signers: rev.signers?.map((x) => ({ id: x.id, name: x.name, firstName: x.firstName, lastName: x.lastName, function: x.function, email: x.email, emailBy: x.emailBy, setBy: x.setBy, setAt: x.setAt, invitedAt: x.invitedAt, signedAt: x.signature?.at, typed: x.signature?.typed })),
      documents: rev.documents,
      folder: { itemId: readableFolderId(record, rev), webUrl: rev.folderUrl },
    },
    revisions: record.revisions.map((r) => ({ n: r.n, id: r.id, state: r.state })),
  };
}

const hasAnswer = (value: unknown) => value !== undefined && value !== null && value !== "" && !(Array.isArray(value) && value.length === 0);

/**
 * The screens as Cadence shows them: per page its blocks with what Ark reads next to each answer
 * (the label and help of this route, notes, the declarations of this form).
 */
function pagesFor(current: Answers, shown: (block: Block) => boolean, sent = false) {
  const declaration = declarations(current);
  const declarationText = {
    fr: [declaration.intro.fr, ...declaration.items.map((item) => item.fr), declaration.closing.fr].join("\n\n"),
    en: [declaration.intro.en, ...declaration.items.map((item) => item.en), declaration.closing.en].join("\n\n"),
  };
  return visibleSteps(current).map((step) => {
    // A sent form is read as it was sent: never "missing" under rules it was not given.
    const missing = sent ? [] : Object.keys(validateStep(step, current));
    // A heading the form shows only over Ark's prefill (« Vous ») says nothing to a reader.
    const blocks = step.blocks.filter((block) => block.id !== "route" && shown(block) && !(block.kind === "heading" && block.prefill?.onlyWhenPrefilled));
    return {
      id: step.id, section: step.section || null, title: step.title, intro: stepText(step, current).intro,
      fieldIds: blocks.filter((block) => block.kind === "field" || block.kind === "group").map((block) => block.id),
      missingFieldIds: [...new Set(missing.map((id) => id.split("[")[0]))],
      parts: blocks.map((block) => {
        if (block.kind === "heading") return { kind: block.kind, id: block.id, text: block.label, ...(block.section ? { section: block.section } : {}) };
        if (block.kind === "note") return { kind: block.kind, id: block.id, text: block.id === "i.declarations" ? declarationText : block.text };
        const text = block.kind === "field" ? fieldText(block, current) : { label: block.label, help: block.help };
        return {
          kind: block.kind,
          id: block.id,
          label: text.label,
          ...(text.help ? { text: text.help } : {}),
          ...(block.retired ? { retired: true } : {}),
          // The holders tree as Ark reads it: worded, indented lines and the computed people (one computation, here).
          ...(block.kind === "group" && block.ui === "holders" ? holdersPart(current) : {}),
          ...(block.kind === "field" && (block.type === "person" || block.type === "persons") ? { options: personOptions(current) } : {}),
        };
      }),
    };
  });
}

/** The holders part for Cadence: `tree` (indented lines) and `controllers` (the computed people, when any). */
function holdersPart(current: Answers): { tree: { depth: number; text: { fr: string; en: string } }[]; controllers?: { fr: string; en: string } } {
  const computed = computedText(current, isOp(current));
  return { tree: holderLines(current), ...(computed ? { controllers: computed } : {}) };
}

/** Case summary for Cadence, with the current answers and exactly the pages visible to the client. */
export async function staffCase(caseId: string): Promise<StaffSummary & {
  answers?: Answers;
  draft?: Answers;
  /** Answer id → who at Ark entered its current value (assisted session, overwrite). Absent when none. */
  enteredBy?: Record<string, string>;
  pages: { id: string; section: string | null; title: { fr: string; en: string }; intro?: { fr: string; en: string }; fieldIds: string[]; missingFieldIds: string[]; parts: { kind: "field" | "group" | "heading" | "note"; id: string; label?: { fr: string; en: string }; text?: { fr: string; en: string }; section?: string; retired?: boolean; tree?: { depth: number; text: { fr: string; en: string } }[]; controllers?: { fr: string; en: string }; options?: { value: string; label: { fr: string; en: string } }[] }[] }[];
  documentItems: { key: string; label: { fr: string; en: string }; help?: { fr: string; en: string }; required: boolean; declared: DocDeclared | null; files: { name: string; webUrl: string; size?: number; receivedAt?: string }[]; unavailable: boolean; withheld: Withheld | null }[];
}> {
  await finishIfComplete(caseId);
  const record = await loadCase(caseId);
  const rev = latest(record);
  const submission = await readSubmission(record, rev);
  const answers = submission?.answers || null;
  // What the client has filled so far, for Ark to see and help (Sam, 2026-11-03).
  const openDraft = !answers && rev.state === "open" ? await readDraft(record, rev) : null;
  const draft = openDraft?.answers;
  // A submitted form is shown as it was sent: every answer it holds, even one the current form
  // would no longer ask on that route. A draft follows the current form.
  const current = answers ? { ...answers, route: record.route } : pruneHidden({ ...(draft || {}), route: record.route });
  const shown = (block: Block) => isBlockVisible(block, current) || (!!answers && block.kind !== "note" && block.kind !== "heading" && hasAnswer(current[block.id]));
  const pages = pagesFor(current, shown, !!answers);
  const currentFiles = await docFiles(record, rev);
  const files = [...currentFiles];
  // Carried documents live in the original revision's Documents folder. Resolve their current
  // SharePoint URL by item id; an old filename alone is not evidence that a file still exists.
  const carried = carriedFiles(rev);
  const carriedByRevision = new Map<number, Set<string>>();
  for (const file of Object.values(rev.carried || {}).flat()) {
    const ids = carriedByRevision.get(file.revision) || new Set<string>();
    ids.add(file.itemId);
    carriedByRevision.set(file.revision, ids);
  }
  for (const [n, ids] of carriedByRevision) {
    const source = record.revisions.find((entry) => entry.n === n);
    if (!source) continue;
    const present = await getPorts().storage.listFiles(record.driveId, source.docsFolderId);
    for (const file of carried.filter((entry) => ids.has(entry.id))) {
      const found = present.find((entry) => entry.id === file.id);
      if (found) files.push({ ...file, webUrl: found.webUrl, ...(found.createdAt ? { receivedAt: found.createdAt } : {}) });
    }
  }
  // Documents an earlier version of the form asked for (e.g. proof of listing) stay listed for
  // the cases that hold them, under the label the client saw.
  const listed = documentList(current, record.skippedDocuments, record.officeDocuments, record.extraDocuments);
  const known = new Set(listed.flatMap((item) => itemKeys(item)));
  const sentLabel = (key: string) => submission?.documents?.find((entry) => entry.key === key)?.label;
  for (const key of new Set([...(rev.documents || []).map((entry) => entry.key), ...Object.keys(rev.carried || {})])) {
    if (known.has(key)) continue;
    const old = retiredDocument(key) || (sentLabel(key) ? { key, code: docCode(key), label: { fr: sentLabel(key)!, en: sentLabel(key)! }, required: false } : null);
    if (old) listed.push({ ...old, withheld: null });
  }
  const documentItems = listed.map((item) => ({
    key: item.key,
    label: item.label,
    ...(item.hint ? { help: item.hint } : {}),
    required: item.required,
    withheld: item.withheld,
    declared: (rev.documents?.find((entry) => entry.key === item.key)?.status === "later" ? "later"
      : rev.documents?.find((entry) => entry.key === item.key)?.status === "na" ? "na"
      : declaredFor(item, openDraft?.docDeclared)) || null,
    files: files.filter((file) => holdsFile(item, file.code) && file.webUrl)
      .map((file) => ({ name: file.name, webUrl: file.webUrl!, size: file.size, ...(file.receivedAt ? { receivedAt: file.receivedAt } : {}) })),
    unavailable: (itemKeys(item).some((key) => rev.documents?.some((entry) => entry.key === key))
      ? itemKeys(item).reduce((n, key) => n + (rev.documents?.find((entry) => entry.key === key)?.files.length || 0), 0)
      : itemKeys(item).reduce((n, key) => n + (rev.carried?.[key]?.length || 0), 0) + currentFiles.filter((file) => holdsFile(item, file.code)).length)
      > files.filter((file) => holdsFile(item, file.code) && file.webUrl).length,
  }));
  const marks = answers ? submission?.enteredBy : openDraft?.enteredBy;
  const entered = Object.fromEntries(Object.entries(marks || {}).filter(([key]) => key in current));
  return { ...summarize(record), ...(answers ? { answers: current } : {}), ...(draft ? { draft: current } : {}), ...(Object.keys(entered).length ? { enteredBy: entered } : {}), pages, documentItems };
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
  /** Ark staff opened this session with an assist code or link: who. Role "staff". */
  staffBy?: string;
  /** The personal link the session was opened through (absent when opened by e-mail address). */
  linkRef?: string;
}

/** "staff": Ark helping the client; does everything the contact does except sign. */
type Role = "contact" | "signer" | "staff";

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
  const mine = signing && session.emailHash !== STAFF_HASH ? (rev.signers || []).filter((s) => s.emailHash === session.emailHash).map((s) => s.id) : [];
  const staff = !!session.staffBy && session.emailHash === STAFF_HASH;
  const role: Role | null = staff ? "staff" : session.emailHash === record.emailHash ? "contact" : mine.length ? "signer" : null;
  if (!role) throw new KycError("session_expired", 401);
  if (!allow.includes(role)) throw new KycError("not_allowed", 403);
  return { record, rev, role, mine };
}

export interface ClientFile {
  id: string;
  name: string;
  size: number;
  code: string | null;
  webUrl?: string;
  /** When the file reached the library (ISO). */
  receivedAt?: string;
}

const codeOf = (name: string) => /^\[([0-9a-f]{12})\] /.exec(name)?.[1] || null;

/** The documents the client uploaded to this revision (in the shared `Pièces/` only the ones carrying this case and revision). */
async function docFiles(record: CaseRecord, rev: RevisionRecord): Promise<ClientFile[]> {
  const files = await getPorts().storage.listFiles(record.driveId, rev.docsFolderId);
  const own = (f: { name: string }) => !record.folders || (codeOf(f.name) !== null && isOwnPiece(f.name, record.caseId, rev.n));
  return files.filter((f) => !f.folder && own(f)).map((f) => ({ id: f.id, name: f.name, size: f.size, code: codeOf(f.name), webUrl: f.webUrl, ...(f.createdAt ? { receivedAt: f.createdAt } : {}) }));
}

/** Documents provided in earlier revisions (read-only for the client). */
const carriedFiles = (rev: RevisionRecord): (ClientFile & { carried: true })[] =>
  Object.entries(rev.carried || {}).flatMap(([key, files]) => files.map((f) => ({ id: f.itemId, name: f.name, size: f.size, code: docCode(key), carried: true as const })));

/** Where the signed form of a revision is filed: its `Signé/` folder, or the shared `Pièces/`. */
async function signedFolderId(record: CaseRecord, rev: RevisionRecord): Promise<string> {
  return record.folders ? record.folders.piecesFolderId : getPorts().storage.ensureSubfolder(record.driveId, rev.folderId, SIGNED_FOLDER);
}

/** The signed form's files of a revision (scans and the online-signed PDF); in the shared `Pièces/` only this revision's. */
async function signedStored(record: CaseRecord, rev: RevisionRecord) {
  const folderId = await signedFolderId(record, rev);
  // A client's document (it starts with its code) is never a signed form, whatever its file name says.
  const own = (name: string) =>
    !record.folders || (isOwnPiece(name, record.caseId, rev.n) && codeOf(name) === null && (name.startsWith(SIGNED_SCAN_PREFIX) || (name.startsWith("Formulaire KYC - ") && name.includes(ONLINE_SIGNED_MARK))));
  // The PDF to sign is the server's own file: its id, not its name (which carries the client's company name), says so.
  const files = (await getPorts().storage.listFiles(record.driveId, folderId)).filter((f) => !f.folder && f.id !== rev.pdf?.itemId && own(f.name));
  return { folderId, files };
}

async function signedFiles(record: CaseRecord, rev: RevisionRecord): Promise<ClientFile[]> {
  return (await signedStored(record, rev)).files.map((f) => ({ id: f.id, name: f.name, size: f.size, code: null }));
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
  const { record, rev, role, mine } = await clientContext(session, ["contact", "signer", "staff"]);
  const signing = rev.state === "awaiting_signature" || rev.state === "signed" ? await signingView(record, rev, role, mine, session.staffBy) : null;
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
  // Provenance (`enteredBy`) is for Ark only: never part of what the form receives.
  const { enteredBy: _hidden, ...draft } = (await readDraft(record, rev)) || ({} as Draft);
  const hasDraft = !!draft.savedAt;
  const submitted = rev.state === "open" ? null : await readSubmitted(record, rev);
  return {
    caseId: record.caseId,
    revision: rev.n,
    route: record.route,
    language: record.language,
    state: rev.state,
    displayName: record.displayName,
    prefilledIds: upgradeIds(rev.prefilledIds || []),
    skippedDocuments: record.skippedDocuments || [],
    officeDocuments: record.officeDocuments || [],
    extraDocuments: record.extraDocuments || [],
    draft: rev.state === "open" && hasDraft ? draft : null,
    answers: submitted || draft.answers || { route: record.route },
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
async function signingView(record: CaseRecord, rev: RevisionRecord, role: Role, mine: string[], staffBy?: string) {
  const signers = rev.signers || [];
  const onlineStarted = signers.some((s) => s.signature);
  // Once online has started, a late scan no longer blocks it (the server ignores it too).
  const paperStarted = !onlineStarted && rev.state === "awaiting_signature" && (await signedFiles(record, rev)).length > 0;
  return {
    role,
    /** Who at Ark has the case open (staff session only): named on the signature dialog and on the proof. */
    staffName: role === "staff" ? traceText(staffBy || "", 100) || "Ark" : null,
    online: onlineReady(rev),
    onlineStarted,
    paperStarted,
    signers: signers.map((s) => ({
      id: s.id,
      name: s.name,
      signed: !!s.signature,
      signatureId: s.signature?.hash ? signatureId(s.signature.hash) : null,
      presentBy: s.signature?.presentBy || null,
      mine: mine.includes(s.id),
      emailHint: s.email ? maskAddress(s.email) : null,
      invitedAt: s.invitedAt || null,
      inForm: contactSignsInForm(record, rev, s),
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
    const role = { ...(str(row.function) ? { function: str(row.function) } : {}), ...(str(row.firstName) ? { firstName: str(row.firstName) } : {}), ...(str(row.lastName) ? { lastName: str(row.lastName) } : {}) };
    if (email && EMAIL_RE.test(email)) return { id: String(row._id), name, ...role, email, emailHash: emailHash(email), emailBy: "form" as const, emailSetAt: at };
    if (rows.length === 1) return { id: String(row._id), name, ...role, email: record.email, emailHash: record.emailHash, emailBy: "contact" as const, emailSetAt: at };
    return { id: String(row._id), name, ...role };
  });
}

const duplicateAddress = (signers: SignerRecord[]) => {
  const hashes = signers.map((s) => s.emailHash).filter(Boolean);
  return new Set(hashes).size !== hashes.length;
};

/**
 * The signatories after Ark's change: `items` is the whole list (one or two people). An entry with
 * the `id` of a signatory keeps that signatory (a signed one must come back unchanged); an entry
 * without `id` is a new signatory. A signatory left out is removed, never one who has signed.
 */
function nextSignatories(current: SignerRecord[], items: unknown, by: string): SignerRecord[] {
  const list = Array.isArray(items) ? items : [];
  if (list.length < 1 || list.length > 2) throw new KycError("invalid_request", 400, { field: "signatories" });
  const at = now();
  const kept = new Set<string>();
  // A function the record does not hold (signatories fixed before it was kept) is not a change.
  const sameRole = (signer: SignerRecord, role: string) => !signer.function || role === signer.function;
  const next = list.map((raw): SignerRecord => {
    const item = (raw && typeof raw === "object" ? raw : {}) as { id?: unknown; firstName?: unknown; lastName?: unknown; function?: unknown; email?: unknown };
    const firstName = str(item.firstName).slice(0, 100);
    const lastName = str(item.lastName).slice(0, 100);
    const name = `${firstName} ${lastName}`.trim();
    const role = str(item.function).slice(0, 120);
    const email = str(item.email);
    const id = item.id === undefined || item.id === null || item.id === "" ? null : String(item.id);
    let signer = id === null ? undefined : current.find((s) => s.id === id);
    if (id !== null && (!signer || kept.has(id))) throw new KycError("invalid_request", 400, { field: "signatories.id" });
    // A new entry at the address of a signatory not yet signed is that signatory (a retry after a
    // lost answer sends the list again without the id the first try created).
    if (!signer && email) signer = current.find((s) => !s.signature && !kept.has(s.id) && s.emailHash === emailHash(email));
    if (signer?.signature) {
      // Who signed stays as they signed.
      if (nameKey(name) !== nameKey(signer.name) || emailHash(email) !== signer.emailHash || !sameRole(signer, role)) throw new KycError("signer_signed", 409, { id: signer.id });
      kept.add(signer.id);
      return signer;
    }
    if (!lastName || !printable(name)) throw new KycError("invalid_request", 400, { field: "signatories.name" });
    if (!EMAIL_RE.test(email) || email.length > 200) throw new KycError("invalid_request", 400, { field: "signatories.email" });
    const parts = { firstName: firstName || undefined, lastName };
    if (signer) {
      kept.add(signer.id);
      const sameAddress = signer.emailHash === emailHash(email);
      if (sameAddress && name === signer.name && sameRole(signer, role)) return { ...signer, ...parts, function: signer.function || role || undefined };
      // Changed: a new address gets a new request; the same address keeps its request.
      return {
        ...signer, ...parts, name, function: role || undefined, setBy: by, setAt: at,
        ...(sameAddress ? {} : { email, emailHash: emailHash(email), emailBy: "ark" as const, emailSetAt: at, invitedAt: undefined }),
      };
    }
    return { id: `ark${randomBytes(6).toString("hex")}`, name, ...parts, ...(role ? { function: role } : {}), email, emailHash: emailHash(email), emailBy: "ark", emailSetAt: at, setBy: by, setAt: at };
  });
  const gone = current.find((s) => s.signature && !kept.has(s.id));
  if (gone) throw new KycError("signer_signed", 409, { id: gone.id });
  return next;
}

/**
 * The contact signs in the form they filled, with the case link. When Ark filled it for them in an
 * assistance session (Ricci, 2026-11-17), they were never in that session: they get a signing link
 * at their address like any other signatory.
 */
const contactSignsInForm = (record: CaseRecord, rev: RevisionRecord, signer: SignerRecord) => signer.emailHash === record.emailHash && !rev.submittedBy;

/** A signature request a failure left unsent: what a retry or a replay sends. */
const requestPending = (record: CaseRecord, rev: RevisionRecord) =>
  (rev.signers || []).some((s) => !s.invitedAt && !s.signature && s.emailHash && !contactSignsInForm(record, rev, s));

/**
 * The signatories Ark named for a reminder or a link (`signerIds`), or null for every one pending.
 * Each must exist, not have signed and not be the contact signing in the form (`contactSignsInForm`).
 */
function chosenSigners(record: CaseRecord, rev: RevisionRecord, ids: unknown): SignerRecord[] | null {
  if (ids === undefined || ids === null) return null;
  if (!Array.isArray(ids) || !ids.length || ids.length > 10) throw new KycError("invalid_request", 400, { field: "signerIds" });
  if (!onlineReady(rev)) throw new KycError("online_signature_unavailable", 409);
  return [...new Set(ids.map(String))].map((id) => {
    const signer = (rev.signers || []).find((s) => s.id === id);
    if (!signer) throw new KycError("invalid_request", 400, { field: "signerIds" });
    if (signer.signature) throw new KycError("signer_signed", 409, { id });
    if (!signer.emailHash || contactSignsInForm(record, rev, signer)) throw new KycError("signer_is_contact", 409, { id });
    return signer;
  });
}

/** Online signing is possible: every signatory has an address of their own and a printable name. */
function onlineReady(rev: RevisionRecord): boolean {
  const signers = rev.signers || [];
  return onlineSignatureEnabled() && signers.length > 0 && signers.every((s) => s.emailHash && printable(s.name)) && !duplicateAddress(signers);
}

const SIGN_MAIL = {
  fr: {
    subject: (company: string) => `Signature du formulaire KYC – ${company}`,
    reminder: "Rappel : ",
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
    reminder: "Reminder: ",
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
 * Signature requests to the signatories other than a contact signing in the form (`contactSignsInForm`):
 * a link bound to their address, and one e-mail with fixed wording. A failure leaves the signer
 * unrequested; the next submit retry or Ark's correction sends it. `again`: a reminder, to every
 * signatory who has not signed, requested before or not. Returns the ids of the signatories e-mailed.
 */
async function requestSignatures(record: CaseRecord, rev: RevisionRecord, options: { again?: boolean; only?: string[] } = {}): Promise<string[]> {
  if (rev.state !== "awaiting_signature" || !onlineReady(rev)) return [];
  const sent: string[] = [];
  for (const signer of rev.signers || []) {
    if (options.only && !options.only.includes(signer.id)) continue;
    if (signer.signature || (signer.invitedAt && !options.again) || !signer.email || !signer.emailHash || contactSignsInForm(record, rev, signer)) continue;
    try {
      const link = await issueLink({ caseId: record.caseId, revision: rev.n, emailHash: signer.emailHash, locale: record.language });
      const text = SIGN_MAIL[record.language];
      const subject = (options.again && signer.invitedAt ? text.reminder : "") + text.subject(record.displayName);
      await getPorts().sendMail({ from: mailSender(), to: [signer.email], cc: [], subject, html: plainHtml([...text.blocks(signer.name, record.displayName, link.url)]) });
      signer.invitedAt = now();
      sent.push(signer.id);
    } catch (error) {
      console.error("kyc signature request", error instanceof Error ? error.message : "error");
    }
  }
  return sent;
}

/**
 * A signatory signs in the form: their session (opened with the code sent to their address)
 * identifies them; they accept the declarations and type their name. The signature is recorded
 * at once; when the last one signs, the PDF they checked gets a signature page listing everyone
 * and is filed in "Signé" with its SHA-256, like a scan.
 */
async function checkedDrawing(value: unknown): Promise<string> {
  const encoded = typeof value === "string" ? /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)?.[1] : undefined;
  if (!encoded || encoded.length > 160_000) throw new KycError("signature_image", 422);
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length < 100 || bytes.length > 120_000) throw new KycError("signature_image", 422);
  try {
    const input = sharp(bytes, { limitInputPixels: 108_000, failOn: "error" });
    const metadata = await input.metadata();
    if (metadata.format !== "png" || metadata.width !== 600 || metadata.height !== 180 || (metadata.pages || 1) !== 1) {
      throw new Error("wrong drawing dimensions");
    }
    const { data, info } = await input.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) throw new Error("wrong drawing channels");
    let ink = 0;
    let minX = 600, maxX = 0, minY = 180, maxY = 0;
    for (let y = 0; y < 180; y++) for (let x = 0; x < 600; x++) {
      const at = (y * 600 + x) * 4;
      if (data[at + 3] < 48 || data[at] + data[at + 1] + data[at + 2] > 450) continue;
      ink++;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    if (ink < 24 || ink > 40_000 || (maxX - minX < 20 && maxY - minY < 20)) throw new Error("blank drawing");
    return (await sharp(data, { raw: { width: 600, height: 180, channels: 4 } }).png().toBuffer()).toString("base64");
  } catch {
    throw new KycError("signature_image", 422);
  }
}

/** Printable ASCII only, bounded: the trace is printed in the PDF and never logged. */
const traceText = (value: string, max: number) => value.replace(/[^\x20-\x7e]/g, "").trim().slice(0, max);

export async function signOnline(session: Session, body: { signerId?: unknown; method?: unknown; accept?: unknown; declarationId?: unknown; drawing?: unknown }, evidence: { ip?: string; userAgent?: string } = {}) {
  return locked(session.caseId, async () => {
    const { record, rev, role, mine } = await clientContext(session, ["contact", "signer", "staff"]);
    // The form shown in the browser must be this one (another tab may have opened another case).
    if (!rev.declarationId || str(body.declarationId) !== rev.declarationId) throw new KycError("case_changed", 409);
    if (rev.state === "signed") {
      // A retry after a failed tracker update brings "Suivi KYC" up to date.
      await track(record, rev);
      return { state: rev.state };
    }
    if (rev.state !== "awaiting_signature" || !rev.pdf) throw new KycError("not_editable", 409);
    const signers = rev.signers || [];
    // Staff signs for one named signatory of this case, present beside them; everyone else signs as themselves.
    const staffSigns = role === "staff";
    // Only staff names another signatory; everyone else signs as themselves.
    if (!staffSigns && body.signerId !== undefined && !mine.includes(str(body.signerId))) throw new KycError("not_a_signer", 403);
    const own = staffSigns ? signers.filter((s) => s.id === str(body.signerId)) : signers.filter((s) => mine.includes(s.id));
    if (!own.length) throw new KycError("not_a_signer", staffSigns ? 404 : 403);
    const pending = own.find((s) => !s.signature);
    if (!pending) {
      if (staffSigns) throw new KycError("signer_signed", 409, { id: own[0].id });
      // Already signed: finish if everyone has (a retry after a failure while filing the PDF).
      if (signers.every((s) => s.signature)) await finishOnline(record, rev);
      return { state: rev.state };
    }
    if (!onlineReady(rev)) throw new KycError("online_signature_unavailable", 409);
    // A scan blocks starting online; once online has started, a late scan upload is ignored.
    if (!signers.some((s) => s.signature) && (await signedFiles(record, rev)).length) throw new KycError("paper_started", 409);
    if (body.accept !== true) throw new KycError("signature_not_accepted", 422);
    const method = SIGNATURE_METHODS.find((m) => m === body.method);
    if (!method) throw new KycError("signature_image", 422);
    const drawnPng = await checkedDrawing(body.drawing);
    const original = await getPorts().storage.readFile(record.driveId, readableFolderId(record, rev), rev.pdf.name);
    if (!original) throw new KycError("pdf_not_ready", 409);
    const at = now();
    const presentBy = staffSigns ? traceText(session.staffBy || "", 100) || "Ark" : undefined;
    const pdfSha256 = sha256(original);
    // The evidence is saved before the PDF is built: a later failure never asks to sign again.
    pending.signature = { typed: pending.name, email: pending.email || "", at, pdfSha256, drawnPng, method, ...(presentBy ? { presentBy } : {}),
      hash: signatureHash({ pdfSha256, jsonSha256: rev.json?.sha256 || "", signerId: pending.id, png: drawnPng, at, method, presentBy }),
      ip: isIP(evidence.ip || "") ? evidence.ip : undefined,
      userAgent: traceText(evidence.userAgent || "", 200) || undefined,
      linkRef: staffSigns ? undefined : session.linkRef,
    };
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
  const original = await storage.readFile(record.driveId, readableFolderId(record, rev), rev.pdf!.name);
  if (!original) throw new KycError("pdf_not_ready", 409);
  const pdfSha256 = sha256(original);
  // Everyone signed this very document.
  if (signers.some((s) => s.signature?.pdfSha256 !== pdfSha256)) throw new KycError("pdf_changed", 409);
  const signedPdf = await appendOnlineSignatures(original, {
    language: record.language,
    declarationId: rev.declarationId || "",
    signers: signers.map((s) => ({ name: s.name, function: s.function, setByArk: !!s.setBy, typed: s.signature!.typed, email: s.signature!.email, at: s.signature!.at, drawnPng: s.signature!.drawnPng, ip: s.signature!.ip, userAgent: s.signature!.userAgent, linkRef: s.signature!.linkRef, byArk: s.emailBy === "ark", method: s.signature!.method, presentBy: s.signature!.presentBy, hash: s.signature!.hash })),
    pdfSha256,
    jsonSha256: rev.json?.sha256 || "",
  });
  const folderId = await signedFolderId(record, rev);
  const fileName = formPdfName(record, rev, record.displayName, "signé en ligne");
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

export async function saveDraft(session: Session, body: { answers?: unknown; stepId?: unknown; docDeclared?: unknown; staffPrefillVersion?: unknown }) {
  return locked(session.caseId, async () => {
    const { record, rev, role } = await clientContext(session, ["contact", "staff"]);
    if (rev.state !== "open") throw new KycError("not_editable", 409);
    const current = await readDraft(record, rev);
    const seen = body.staffPrefillVersion === undefined ? 0 : body.staffPrefillVersion;
    if (seen !== (current?.staffPrefillVersion || 0)) throw new KycError("draft_changed", 409);
    // Answers to questions no longer asked never come from the browser; the draft keeps its own.
    const answers = { ...sanitizeAnswers(body.answers), ...retiredAnswers(current?.answers), route: record.route };
    const stepId = /^[a-z.]{1,20}$/.test(str(body.stepId)) ? str(body.stepId) : "start";
    const savedAt = now();
    const marks = trackEnteredBy(current?.answers || {}, answers, current?.enteredBy, role === "staff" ? session.staffBy! : null);
    await writeDraft(record, rev, { savedAt, stepId, answers, docDeclared: sanitizeDeclared(body.docDeclared), staffPrefillVersion: current?.staffPrefillVersion || 0, ...(Object.keys(marks).length ? { enteredBy: marks } : {}) });
    if (!rev.startedAt) {
      rev.startedAt = savedAt;
      await saveCase(record);
      await track(record, rev);
    }
    return { savedAt };
  });
}

/**
 * The client's question about one field (its (i)): relayed to Cadence with the field and the other
 * answers of its step, never stored. The answer may propose a value; the form writes it only when
 * the client presses « Utiliser ». The route is the case's, never the browser's.
 */
/** Swiss companies of the register matching the client's typing (holders of section B); never an error. */
export async function searchCompanies(session: Session, body: { q?: unknown }, fetchImpl: typeof fetch = fetch): Promise<{ items: RegisterCompany[] }> {
  const { rev } = await clientContext(session, ["contact", "staff"]);
  if (rev.state !== "open") throw new KycError("not_editable", 409);
  return { items: (await companiesCadence(str(body.q), fetchImpl)).items };
}

export async function askField(
  session: Session,
  body: { fieldId?: unknown; question?: unknown; answers?: unknown; language?: unknown },
  fetchImpl: typeof fetch = fetch,
): Promise<AskReply> {
  const { record, rev } = await clientContext(session, ["contact", "staff"]);
  if (rev.state !== "open") throw new KycError("not_editable", 409);
  const fieldId = str(body.fieldId);
  const question = str(body.question).slice(0, 500);
  const field = getField(fieldId);
  const answers: Answers = { ...sanitizeAnswers(body.answers), route: record.route };
  const step = STEPS.find((s) => !s.special && s.blocks.some((b) => b.kind === "field" && b.id === fieldId));
  if (!field || !field.help || !step || !question || !isStepVisible(step, answers) || !isBlockAsked(field, answers)) {
    throw new KycError("invalid_request", 400);
  }
  const stepAnswers: Record<string, unknown> = {};
  for (const block of step.blocks) {
    if (block.kind !== "field" || block.id === "route" || !isBlockAsked(block, answers)) continue;
    const value = answers[block.id];
    if (value !== undefined && value !== "" && !(Array.isArray(value) && !value.length)) stepAnswers[block.id] = value;
  }
  const language = body.language === "en" ? "en" : "fr";
  const result = await askCadence({ caseId: record.caseId, route: record.route, fieldId, question, language, answers: stepAnswers }, fetchImpl);
  if (!result.ok) throw new KycError(result.error, result.status);
  // A proposal is only ever a valid value for this very field (right type, a listed option): anything else is dropped.
  const proposed = result.reply.proposal;
  const clean = proposed === null ? undefined : sanitizeAnswers({ [fieldId]: proposed })[fieldId];
  const proposal = clean !== undefined && JSON.stringify(clean) === JSON.stringify(proposed) && validateField(field, clean) === null ? (clean as string | string[]) : null;
  return { ...result.reply, proposal };
}

export async function createUpload(session: Session, body: { kind?: unknown; docKey?: unknown; fileName?: unknown; size?: unknown; mime?: unknown }) {
  return locked(session.caseId, async () => {
    const { record, rev, role } = await clientContext(session, ["contact", "staff"]);
    const fileName = str(body.fileName);
    const check = checkUpload(fileName, Number(body.size), str(body.mime));
    if (!check.ok) throw new KycError(check.error, 400);
    // PDF and images only: no office documents (macros) in the AML file.
    if (!KYC_UPLOAD_TYPES.has(check.ext)) throw new KycError("file_type", 400);
    const { storage } = getPorts();
    const base = safeName(fileName.replace(/\.[^.]+$/, ""), 70);
    if (body.kind === "signed") {
      // The signed scan is part of signing: not Ark's to give.
      if (role === "staff") throw new KycError("not_allowed", 403);
      if (rev.state !== "awaiting_signature") throw new KycError("not_editable", 409);
      // One way per revision: once someone has signed online, the others sign online too.
      if ((rev.signers || []).some((s) => s.signature)) throw new KycError("online_signing_started", 409);
      const folderId = await signedFolderId(record, rev);
      if ((await signedFiles(record, rev)).length >= 10) throw new KycError("too_many_files", 400);
      const name = record.folders ? pieceFileName(`${SIGNED_SCAN_PREFIX}${base}`, check.ext, record.caseId, rev.n) : `Formulaire signé R${rev.n} - ${base}.${check.ext}`;
      const { uploadUrl } = await storage.createUploadSession(record.driveId, folderId, name, Number(body.size));
      return { uploadUrl, chunkBytes: UPLOAD_LIMITS.chunkBytes };
    }
    if (rev.state !== "open") throw new KycError("not_editable", 409);
    const draft = await readDraft(record, rev);
    const items = documentsFor(pruneHidden({ ...(draft?.answers || {}), route: record.route }), record.skippedDocuments, record.officeDocuments, record.extraDocuments);
    const item = items.find((i) => i.key === str(body.docKey));
    if (!item) throw new KycError("unknown_document", 400);
    if (items.filter((i) => i.code === item.code).length > 1) throw new KycError("unknown_document", 400);
    const current = await docFiles(record, rev);
    if (current.length >= 80) throw new KycError("too_many_files", 400);
    if (current.reduce((sum, f) => sum + f.size, 0) + Number(body.size) > UPLOAD_LIMITS.maxTotalBytes) throw new KycError("file_size", 400);
    const short = safeName(item.label[record.language] || item.label.fr, 50);
    const name = record.folders ? pieceFileName(`[${item.code}] ${short} - ${base}`, check.ext, record.caseId, rev.n) : `[${item.code}] ${short} - ${base}.${check.ext}`;
    const { uploadUrl } = await storage.createUploadSession(record.driveId, rev.docsFolderId, name, Number(body.size));
    return { uploadUrl, chunkBytes: UPLOAD_LIMITS.chunkBytes };
  });
}

/** Removes a document the client uploaded by mistake (documents of an open revision only). */
export async function deleteUpload(session: Session, body: { fileId?: unknown }) {
  return locked(session.caseId, async () => {
    const { record, rev, role } = await clientContext(session, ["contact", "staff"]);
    if (role === "staff" && rev.state !== "open") throw new KycError("not_allowed", 403);
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
  /** Answer id → who at Ark entered its final value. Internal: absent when the client entered everything. */
  enteredBy?: Record<string, string>;
  /** Set when Ark staff submitted the form in an assisted session. */
  submittedBy?: string;
  /** Questions the answers were given for (upgrade.ts). */
  formVersion?: number;
}

export async function submit(session: Session, body: { answers?: unknown; docDeclared?: unknown; submitKey?: unknown }) {
  return locked(session.caseId, async () => {
    const { record, rev, role } = await clientContext(session, ["contact", "staff"]);
    const submitKey = str(body.submitKey).slice(0, 40);
    if (rev.state !== "open") {
      if (submitKey && rev.submitKey === submitKey) {
        // A retry sends the signature requests a failure left unsent.
        if (rev.state === "awaiting_signature" && requestPending(record, rev)) {
          await requestSignatures(record, rev);
          await saveCase(record);
        }
        return { state: rev.state, declarationId: rev.declarationId || null };
      }
      throw new KycError("not_editable", 409);
    }
    // Answers to questions no longer asked come from the draft, never the browser: they go with the
    // form read-only (Ark, PDF), and an earlier answer that stands for a new question counts.
    const before = await readDraft(record, rev);
    const answers = pruneHidden({ ...sanitizeAnswers(body.answers), ...retiredAnswers(before?.answers), route: record.route });
    const errors = validateAll(answers);
    if (Object.keys(errors).length) throw new KycError("invalid_answers", 422, { fields: Object.keys(errors).slice(0, 50) });
    const signers = buildSigners(answers, record);
    if (duplicateAddress(signers)) throw new KycError("signer_email_duplicate", 422, { fields: ["i.signers"] });
    const declared = sanitizeDeclared(body.docDeclared);
    const suspicious = await removeSuspicious(record, rev);
    if (suspicious.length) throw new KycError("file_rejected", 422, { files: suspicious });
    const files = await docFiles(record, rev);
    const items = documentsFor(answers, record.skippedDocuments, record.officeDocuments, record.extraDocuments);
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
      const frozen: FrozenFile[] = itemKeys(item).flatMap((key) => rev.carried?.[key] || []);
      for (const file of files.filter((f) => holdsFile(item, f.code))) {
        const bytes = await storage.readFile(record.driveId, rev.docsFolderId, file.name);
        if (bytes) frozen.push({ itemId: file.id, name: file.name, size: bytes.byteLength, sha256: sha256(bytes), revision: rev.n });
      }
      const status = frozen.length ? "uploaded" : declaredFor(item, declared) === "later" ? "later" : !item.required ? "na" : null;
      if (!status) missing.push(item.key);
      else {
        documents.push({ key: item.key, label: item.label.fr, status, files: frozen.map((f) => f.name) });
        manifest.push({ key: item.key, status, files: frozen });
      }
    }
    if (missing.length) throw new KycError("missing_documents", 422, { documents: missing });

    const flags = flagsOf(answers);
    const submittedAt = now();
    const staffBy = role === "staff" ? session.staffBy! : null;
    const marks = trackEnteredBy(before?.answers || {}, answers, before?.enteredBy, staffBy);
    const submission: SubmissionRecord = {
      formVersion: FORM_VERSION,
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
      ...(Object.keys(marks).length ? { enteredBy: marks } : {}),
      ...(staffBy ? { submittedBy: staffBy } : {}),
    };
    const jsonBytes = enc({ ...submission, documents: manifest.map((d) => ({ ...d, label: items.find((i) => i.key === d.key)?.label.fr || d.key })) });
    const digest = sha256(jsonBytes);
    const jsonFile = await storage.putFile(record.driveId, rev.folderId, dataName(record, rev, "questionnaire.json"), jsonBytes, "application/json");
    await storage.putFile(record.driveId, rev.folderId, dataName(record, rev, "questionnaire.sha256"), new TextEncoder().encode(`${digest}  questionnaire.json\n`), "text/plain");
    rev.json = { itemId: jsonFile.id, sha256: digest };
    rev.flags = flags;
    rev.documents = manifest;
    rev.submittedAt = submittedAt;
    rev.submittedBy = staffBy || undefined;
    rev.submitKey = submitKey || undefined;
    if (flags.includes("routeMismatch")) {
      // The client's description contradicts Ark's choice of form: back to Ark, nothing to sign.
      rev.state = "returned";
    } else {
      rev.declarationId = `${record.caseId}-R${rev.n}-${digest.slice(0, 8).toUpperCase()}`;
      rev.signers = signers;
      const pdf = await buildKycPdf(submission, rev.declarationId, { online: onlineReady(rev) });
      const pdfName = formPdfName(record, rev, submission.clientName, "à signer");
      const pdfFile = await storage.putFile(record.driveId, readableFolderId(record, rev), pdfName, pdf, "application/pdf");
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
  const { record, rev } = await clientContext(session, ["contact", "signer", "staff"]);
  if (!rev.pdf) throw new KycError("pdf_not_ready", 409);
  const bytes = await getPorts().storage.readFile(record.driveId, readableFolderId(record, rev), rev.pdf.name);
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
    const { folderId, files: listed } = await signedStored(record, rev);
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

/**
 * Cadence's « PDF » of a form not signed: the answers Cadence holds (prefill, the client's draft,
 * the paper form typed by staff, the answers handed in), printed with the form's own layout and
 * marked « Brouillon — non signé ». Read-only: nothing is stored.
 */
export async function previewPdf(route: string, answers: Record<string, unknown> | null, clientName: string, language: string): Promise<Uint8Array> {
  if (!(KYC_ROUTES as readonly string[]).includes(route)) throw new KycError("invalid_request", 400, { field: "route" });
  // Answers to questions the form no longer asks print read-only, as the mirror shows them:
  // sanitising drops them, so they are taken back from the upgraded answers.
  const upgraded = upgradeAnswers((answers || {}) as Answers);
  const retired = Object.fromEntries(Object.entries(upgraded).filter(([id]) => isRetiredId(id)));
  const current = pruneHidden({ ...sanitizeAnswers(answers || {}), ...retired, route });
  const L: KycLocale = language === "en" ? "en" : "fr";
  const printedAt = now();
  const record = {
    caseId: "", revision: 0, revisionId: "", route: route as KycRoute, language: L, submittedAt: printedAt,
    clientName: clientName.slice(0, 200) || "—", answers: current as Answers, documents: [], flags: [],
  } as SubmissionRecord;
  return buildKycPdf(record, "", { draft: { printedAt } });
}

/**
 * A read-only preview of what the client will see for a route and prefill, before
 * any case exists. Same engine as the real form: `visibleSteps` + `documentsFor`
 * over the pruned answers, so Cadence never keeps a second questionnaire engine.
 */
export function previewForm(route: string, prefill: Record<string, unknown> | null, skipped: readonly string[] = []) {
  const current = pruneHidden({ ...(prefill || {}), route });
  const pages = pagesFor(current, (block) => isBlockVisible(block, current));
  const documentItems = documentList(current, skipped).map((item) => ({
    key: item.key, label: item.label, ...(item.hint ? { help: item.hint } : {}), required: item.required, declared: null as null, files: [] as { name: string; webUrl: string; size?: number; receivedAt?: string }[], unavailable: false,
    withheld: item.withheld,
  }));
  return { pages, documentItems };
}
