/**
 * Case flow, independent of HTTP (routes in app/api/tax-questionnaire/* call it; tests run it
 * against MockStorage + memoryPorts).
 *
 * A case = one taxpayer or married couple; one folder and one tracker row per tax year (arrears
 * years get their own). The latest year's folder holds draft.json, _events/ and the "Envoi …"
 * sub-folders (immutable submitted versions: questionnaire.json, consent.json, Excel, PDF).
 */
import { createHash, randomBytes } from "node:crypto";
import { attentionPoints } from "../attention";
import { DOC_CATEGORIES, docRuleById, selectedYears, taxYearOf } from "../documents";
import { personName, splitPersonName } from "../format";
import { ALLOWED_TYPES, checkUpload, codeFromFileName, extensionOf, safeName, sniffMismatch, uploadFileName, UPLOAD_LIMITS } from "../files";
import { checklistFor, getField, getGroup, newRowId, pruneHidden, sanitizeAnswers, validateAll } from "../logic";
import { has, isCouple, sourceTaxed, sourceTaxedResident, STEPS } from "../schema";
import { QF_LOCALES, type Answers, type DocStatus, type QfLocale, type Row } from "../types";
import { PRIVACY_VERSION, UI } from "../ui";
import { emailHash, INVITATION_LINK_TTL_MS, issueLink, RESUME_LINK_TTL_MS } from "./access";
import { clientMail, internalMail, isInternalCase } from "./email";
import { buildDocsWorkbook, buildWorkbook, excelFileName, regimeSummary, type DocResult, type SubmissionRecord } from "./excel";
import { linkMail, regularisationClientMail, staffAlert } from "./mails";
import { buildPdf, pdfFileName } from "./pdf";
import type { ReturnRecord } from "./ports";
import { normalise, sharePointPorts } from "./sharepoint-registry";
import type { StoredFile, TaxStorage } from "./storage";

export const DRAFT_FILE = "draft.json";
export const FLAGGED_FOLDER = "_A verifier";
const SYSTEM_FOLDERS = new Set(["_events", FLAGGED_FOLDER]);
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

export class ServiceError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail?: unknown;
  constructor(code: string, status = 400, detail?: unknown) {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

const env = (name: string) => (process.env[name] || "").trim();
const str = (v: unknown) => (typeof v === "string" ? v : "");
const asLocale = (v: unknown): QfLocale => ((QF_LOCALES as readonly string[]).includes(String(v)) ? (v as QfLocale) : "fr");

export interface Identity {
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Stable client key (renewals, preferences): normalised e-mail + name, hashed. Never shown to the
 * client; a renewal link still requires an e-mailed code before any answers are returned.
 */
export function clientKey(email: string, lastName: string, firstName: string): string {
  return createHash("sha256").update(`ark-tax-qf-client|${normalise(email)}|${normalise(lastName)}|${normalise(firstName)}`).digest("hex").slice(0, 24);
}

export function caseFolderName(identity: Identity, caseId: string, now = new Date()): string {
  const name = safeName(personName(identity.lastName, identity.firstName), 60);
  return `${process.env.TAX_QF_FOLDER_PREFIX || ""}${name} - ${now.toISOString().slice(0, 10)} - ${caseId}`;
}

// ---- case lookup ------------------------------------------------------------------------------------

export interface CaseInfo {
  caseId: string;
  householdId: string;
  email: string;
  emailHash: string;
  name: string;
  language: QfLocale;
  /** One record per tax year, latest first. */
  records: ReturnRecord[];
  main: ReturnRecord;
}

const caseCache = new Map<string, { info: CaseInfo; at: number }>();
const forget = (caseId: string) => caseCache.delete(caseId);
/** Drops the cached case (after a write made outside this module, e.g. by the staff API). */
export const forgetCase = forget;

export async function getCase(caseId: string): Promise<CaseInfo> {
  // Rows without a case (staff inventory) never resolve to a case.
  if (!caseId) throw new ServiceError("session_expired", 401);
  const cached = caseCache.get(caseId);
  if (cached && Date.now() - cached.at < 60_000) return cached.info;
  const records = (await sharePointPorts().tracker.findByCase(caseId)).filter((r) => r.state !== "declined").sort((x, y) => y.taxYear - x.taxYear);
  if (!records.length) throw new ServiceError("session_expired", 401);
  const main = records[0];
  const info: CaseInfo = { caseId, householdId: main.householdId, email: main.email, emailHash: main.emailHash, name: main.name, language: asLocale(main.language), records, main };
  caseCache.set(caseId, { info, at: Date.now() });
  return info;
}

async function event(storage: TaxStorage, info: CaseInfo, type: string, data: Record<string, unknown> = {}) {
  try {
    await storage.appendEvent(info.main.driveId, info.main.folderId, { type, at: new Date().toISOString(), caseId: info.caseId, ...data });
  } catch (error) {
    console.error("[tax-qf] event write failed", info.caseId, type, error instanceof Error ? error.message : "");
  }
}

// ---- drafts ----------------------------------------------------------------------------------------

export interface Draft {
  version: 1;
  savedAt: string;
  stepId: string;
  answers: Answers;
  docStatus: Record<string, "later" | "na">;
  locale: QfLocale;
  aiOptIn?: boolean;
  /** Key of the pending submission attempt (survives a reload: a retry reuses the same version). */
  submitKey?: string;
  /**
   * « Rempli par Ark »: answer key → who at Ark entered its current value (office session). A later
   * change of that answer by the client removes the mark. Never sent to the client's browser.
   */
  filledBy?: Record<string, string>;
}

export function cleanFilledBy(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, 2000)) {
    if (key.length <= 120 && typeof value === "string" && value.trim()) out[key] = value.trim().slice(0, 120);
  }
  return Object.keys(out).length ? out : undefined;
}

/** JSON with sorted object keys: the same answer compares equal whatever the key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return value === undefined ? "undefined" : JSON.stringify(value);
}

/**
 * The « Rempli par Ark » marks after a save: every answer whose value changed is marked with the
 * staff member (office session) or unmarked (the client's own change, or an answer staff cleared).
 */
export function markFilledBy(previous: Record<string, string> | undefined, before: Answers | undefined, after: Answers, staffBy?: string): Record<string, string> | undefined {
  const out: Record<string, string> = { ...(previous || {}) };
  for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after)])) {
    if (canonical(before?.[key]) === canonical(after[key])) continue;
    if (staffBy && after[key] !== undefined && after[key] !== "") out[key] = staffBy;
    else delete out[key];
  }
  return Object.keys(out).length ? out : undefined;
}

/** The draft as the browser may see it (without the office marks). */
export function clientDraft<T extends Draft | null>(draft: T): T {
  if (!draft || !draft.filledBy) return draft;
  const { filledBy: _marks, ...rest } = draft;
  return rest as T;
}

export function cleanDocStatus(raw: unknown): Record<string, "later" | "na"> {
  const out: Record<string, "later" | "na"> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>).slice(0, 400)) {
    if (/^[a-z0-9-]{2,40}(:[a-z0-9]{6,24})?$/.test(key) && (value === "later" || value === "na")) out[key] = value;
  }
  return out;
}

async function writeDraft(storage: TaxStorage, info: CaseInfo, draft: Draft) {
  await storage.putFile(info.main.driveId, info.main.folderId, DRAFT_FILE, new TextEncoder().encode(JSON.stringify(draft)), "application/json");
}

export async function readDraft(storage: TaxStorage, info: CaseInfo): Promise<Draft | null> {
  const raw = await storage.readFile(info.main.driveId, info.main.folderId, DRAFT_FILE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(raw)) as Draft;
    const filledBy = cleanFilledBy(parsed.filledBy);
    const { filledBy: _raw, ...rest } = parsed;
    return { ...rest, answers: sanitizeAnswers(parsed.answers), docStatus: cleanDocStatus(parsed.docStatus), locale: asLocale(parsed.locale), ...(filledBy ? { filledBy } : {}) };
  } catch {
    return null;
  }
}

function baseRecord(
  head: Omit<CaseInfo, "records" | "main">,
  year: number,
  folder: { driveId: string; folderId: string; webUrl: string },
  answers: Answers,
  extra: Partial<ReturnRecord> = {},
): ReturnRecord {
  return {
    caseId: head.caseId,
    householdId: head.householdId,
    clientKey: clientKey(head.email, str(answers["start.lastName"]), str(answers["start.firstName"])),
    emailHash: head.emailHash,
    name: head.name,
    email: head.email,
    language: head.language,
    canton: str(answers["start.canton"]),
    taxYear: year,
    state: "draft",
    regime: "",
    optIn: false,
    aiOptIn: false,
    driveId: folder.driveId,
    folderId: folder.folderId,
    folderUrl: folder.webUrl,
    ...extra,
  };
}

/** Creates the case after the e-mail was verified: folders and tracker rows per year, first draft. */
export async function createCase(
  storage: TaxStorage,
  input: { identity: Identity; locale: QfLocale; answers: unknown; householdId?: string; source?: string; emailVerified?: boolean; stepId?: string; clientKey?: string; planned?: ReturnRecord; caseId?: string; cadence?: Pick<ReturnRecord, "clientRef" | "spouseRef" | "createKey"> },
) {
  // The staff API passes a case id derived from its Idempotency-Key (a retry finds the same case).
  const caseId = input.caseId || randomBytes(6).toString("hex");
  const answers = sanitizeAnswers(input.answers);
  // Annual service reminder: on by default (the client can untick it; each e-mail has an opt-out).
  if (answers["review.reminder"] === undefined) answers["review.reminder"] = "yes";
  answers["start.email"] = input.identity.email;
  answers["start.firstName"] = input.identity.firstName;
  answers["start.lastName"] = input.identity.lastName;
  if (!selectedYears(answers).length) answers["start.years"] = [String(taxYearOf(answers))];
  const years = selectedYears(answers);
  const head = {
    caseId,
    householdId: input.householdId || caseId,
    email: input.identity.email,
    emailHash: emailHash(input.identity.email),
    name: personName(input.identity.lastName, input.identity.firstName),
    language: input.locale,
  };
  const folderName = caseFolderName(input.identity, caseId);
  const records: ReturnRecord[] = [];
  for (const year of years) {
    const folder = await storage.createSubmissionFolder(year, folderName);
    const record = baseRecord(head, year, folder, answers, { source: input.source, ...(input.emailVerified ? { emailVerified: true } : {}), ...(input.clientKey ? { clientKey: input.clientKey } : {}), ...(input.cadence || {}) });
    // A planned row (staff inventory) becomes the main year's row instead of a duplicate; what the
    // inventory knew (canton, CRM link) is kept when the answers do not say otherwise.
    if (input.planned?.trackerId && year === years[0]) {
      const p = input.planned;
      record.trackerId = p.trackerId;
      record.canton = record.canton || p.canton;
      record.crmId = record.crmId || p.crmId;
      record.crmUrl = record.crmUrl || p.crmUrl;
      record.crmMatch = record.crmMatch || p.crmMatch;
    }
    record.trackerId = await sharePointPorts().tracker.upsert(record);
    records.push(record);
  }
  const info: CaseInfo = { ...head, records, main: records[0] };
  caseCache.set(caseId, { info, at: Date.now() });
  await writeDraft(storage, info, { version: 1, savedAt: new Date().toISOString(), stepId: input.stepId || "regime", answers, docStatus: {}, locale: input.locale });
  await event(storage, info, "created", { years });
  return info;
}

/** Arrears years added after creation get their own folder and tracker row. */
async function ensureYears(storage: TaxStorage, info: CaseInfo, answers: Answers) {
  const missing = selectedYears(answers).filter((y) => !info.records.some((r) => r.taxYear === y));
  if (!missing.length) return info;
  const identity = { email: info.email, firstName: str(answers["start.firstName"]), lastName: str(answers["start.lastName"]) };
  for (const year of missing) {
    const folder = await storage.createSubmissionFolder(year, caseFolderName(identity, info.caseId));
    const record = baseRecord(info, year, folder, answers);
    record.trackerId = await sharePointPorts().tracker.upsert(record);
  }
  forget(info.caseId);
  return getCase(info.caseId);
}

/**
 * Answers owned by the server (set when Ark prepares or renews a case): the browser's version is
 * ignored, the stored one is kept. The free-text pre-fill marker of the AI reading (not a year)
 * may still be set by the client while none is stored.
 */
export const SERVER_OWNED = ["start.arkPrefilled", "start.arkDocs"];
export function keepServerOwned(answers: Answers, stored: Answers | undefined): Answers {
  const out = { ...answers };
  for (const key of SERVER_OWNED) {
    if (stored && stored[key] !== undefined) out[key] = stored[key];
    else delete out[key];
  }
  // Carried-over rows (renewal): the "carried" mark is the server's, and such a row cannot be
  // removed by the browser (the client marks it "ended" instead).
  for (const [id, value] of Object.entries(stored || {})) {
    if (!Array.isArray(value) || !value.length || typeof value[0] !== "object") continue;
    const storedRows = value as Row[];
    const carried = new Map(storedRows.filter((r) => r.carried).map((r) => [r._id, r]));
    const incoming = Array.isArray(out[id]) ? (out[id] as Row[]) : [];
    const kept = incoming.map((r) => {
      const next: Row = { ...r };
      if (carried.has(r._id)) next.carried = carried.get(r._id)!.carried;
      else delete next.carried;
      return next;
    });
    for (const [rowId, row] of carried) if (!kept.some((r) => r._id === rowId)) kept.push(row);
    if (carried.size || incoming.length) out[id] = kept;
  }
  for (const [id, value] of Object.entries(out)) {
    if (stored?.[id] !== undefined || !Array.isArray(value)) continue;
    out[id] = (value as Row[]).map((r) => (typeof r === "object" && r && r.carried ? (({ carried: _c, ...rest }) => rest as Row)(r) : r)) as Answers[string];
  }
  const storedMarker = str(stored?.["base.prefilledFrom"]);
  if (storedMarker) out["base.prefilledFrom"] = storedMarker;
  else if (/^\d{4}$/.test(str(out["base.prefilledFrom"]))) delete out["base.prefilledFrom"];
  return out;
}

/** `staffBy`: saved in an office session (Ark staff filling for the client): the changed answers are marked. */
export async function saveDraft(storage: TaxStorage, info: CaseInfo, body: { answers: unknown; stepId: unknown; docStatus: unknown; locale: unknown; aiOptIn?: unknown; submitKey?: unknown }, staffBy?: string) {
  if (info.main.state === "submitted") throw new ServiceError("already_submitted", 409);
  const stored = await readDraft(storage, info);
  const answers = keepServerOwned(sanitizeAnswers(body.answers), stored?.answers);
  // The identity stays the verified one.
  answers["start.email"] = info.email;
  const stepId = STEPS.some((s) => s.id === body.stepId) ? String(body.stepId) : "start";
  const updated = await ensureYears(storage, info, answers);
  const submitKey = typeof body.submitKey === "string" && /^[a-z0-9]{8,32}$/.test(body.submitKey) ? body.submitKey : undefined;
  const filledBy = markFilledBy(stored?.filledBy, stored?.answers, answers, staffBy);
  const draft: Draft = { version: 1, savedAt: new Date().toISOString(), stepId, answers, docStatus: cleanDocStatus(body.docStatus), locale: asLocale(body.locale), aiOptIn: body.aiOptIn === true, submitKey, ...(filledBy ? { filledBy } : {}) };
  await writeDraft(storage, updated, draft);
  return { savedAt: draft.savedAt };
}

/**
 * Cadence's pre-fill (staff action `prefill`): answers already validated by the staff API, merged
 * over the stored draft and saved as an office session would save them — the changed answers are
 * marked « rempli par Ark » with `by`. Never clears an answer. A group answer is the whole list of
 * rows: a row whose `_id` is a stored row's keeps that row's hidden fields (renewal status,
 * carried mark, BFS number of an unchanged commune), any other row gets a new id. A commune typed
 * here is the free-text form, so a stored BFS number of another commune goes.
 */
export async function prefillDraft(storage: TaxStorage, info: CaseInfo, given: Answers, by: string) {
  if (info.main.state === "submitted") throw new ServiceError("already_submitted", 409);
  const stored = await readDraft(storage, info);
  if (!stored) throw new ServiceError("not_started", 409);
  const merged: Answers = { ...stored.answers };
  for (const [id, value] of Object.entries(given)) {
    const group = getGroup(id);
    if (!group) {
      merged[id] = value;
      if (getField(id)?.type === "commune" && canonical(value) !== canonical(stored.answers[id])) delete merged[`${id}Bfs`];
      continue;
    }
    const storedRows = new Map((Array.isArray(stored.answers[id]) ? (stored.answers[id] as Row[]) : []).map((r) => [r._id, r]));
    const used = new Set<string>();
    merged[id] = ((value as Row[]) || []).map((row) => {
      const before = storedRows.get(row._id);
      if (!before || used.has(row._id)) return { ...row, _id: newRowId() };
      used.add(row._id);
      const kept: Row = { _id: row._id };
      for (const field of group.fields) {
        if (!field.hidden || before[field.id] === undefined) continue;
        const commune = group.fields.find((c) => c.type === "commune" && `${c.id}Bfs` === field.id);
        if (commune && row[commune.id] !== undefined && canonical(row[commune.id]) !== canonical(before[commune.id])) continue;
        kept[field.id] = before[field.id];
      }
      return { ...kept, ...row, _id: row._id };
    });
  }
  const answers = keepServerOwned(sanitizeAnswers(merged), stored.answers);
  // The identity stays the verified one.
  answers["start.email"] = info.email;
  const written = Object.keys(given).filter((id) => canonical(stored.answers[id]) !== canonical(answers[id]));
  const unchanged = Object.keys(given).filter((id) => !written.includes(id));
  if (written.length) {
    const updated = await ensureYears(storage, info, answers);
    const filledBy = markFilledBy(stored.filledBy, stored.answers, answers, by);
    const { filledBy: _old, ...rest } = stored;
    await writeDraft(storage, updated, { ...rest, savedAt: new Date().toISOString(), answers, ...(filledBy ? { filledBy } : {}) });
  }
  return { written, unchanged, answers };
}

/** "Delete my draft": removes the folders of an unsubmitted case and revokes its access. */
export async function deleteDraft(storage: TaxStorage, info: CaseInfo) {
  if (info.records.some((r) => r.state === "submitted" || r.submittedAt)) throw new ServiceError("already_submitted", 409);
  for (const record of info.records) {
    await storage.deleteFile(record.driveId, record.folderId);
    await sharePointPorts().tracker.upsert({ ...record, state: "declined" });
  }
  await sharePointPorts().access.revokeCase(info.caseId);
  forget(info.caseId);
}

// ---- uploads -----------------------------------------------------------------------------------------

export interface UploadInput {
  docKey: string; // "<ruleId>", "<ruleId>:<rowId>", "older-years:y<year>xx" or "extra"
  label: string;
  fileName: string;
  size: number;
  mime: string;
}

export function parseDocKey(docKey: string): { ruleId: string | null; category: keyof typeof DOC_CATEGORIES; year?: number } | null {
  if (docKey === "extra") return { ruleId: null, category: "extra" };
  const match = /^([a-z0-9-]{2,40})(?::([a-z0-9]{6,24}))?$/.exec(docKey);
  if (!match) return null;
  const rule = docRuleById(match[1]);
  if (!rule || !!rule.forEach !== !!match[2]) return null;
  const year = rule.id === "older-years" ? Number(/^y(\d{4})xx$/.exec(match[2] || "")?.[1]) : undefined;
  if (rule.id === "older-years" && !year) return null;
  return { ruleId: rule.id, category: rule.category, year };
}

/**
 * Checks every uploaded file (actual size, type, first bytes); suspicious ones are moved to
 * "_A verifier" (never deleted). Used at submission and when documents are added afterwards.
 */
async function screenFiles(storage: TaxStorage, info: CaseInfo) {
  const flagged: { file: StoredFile; reason: string }[] = [];
  const accepted: (StoredFile & { year: number })[] = [];
  for (const record of info.records) {
    const files = await storage.listFiles(record.driveId, record.folderId);
    let flaggedFolderId = "";
    for (const file of files) {
      if (file.folder === FLAGGED_FOLDER) {
        flagged.push({ file, reason: "déjà signalé" });
        continue;
      }
      if (!clientFiles([file]).length) continue;
      const ext = extensionOf(file.name);
      let reason: string | null = null;
      if (file.size === 0) reason = "fichier vide (envoi interrompu ?)";
      else if (file.size > UPLOAD_LIMITS.maxFileBytes) reason = "fichier plus grand que la limite";
      else if (!ALLOWED_TYPES[ext]) reason = "type non autorisé";
      else reason = sniffMismatch(ext, await storage.readHead(record.driveId, file.id, 1024));
      if (!reason) {
        accepted.push({ ...file, year: record.taxYear });
        continue;
      }
      if (!flaggedFolderId) flaggedFolderId = await storage.ensureSubfolder(record.driveId, record.folderId, FLAGGED_FOLDER);
      await storage.moveFile(record.driveId, file.id, flaggedFolderId);
      flagged.push({ file: { ...file, folder: FLAGGED_FOLDER }, reason });
    }
  }
  const total = accepted.reduce((sum, f) => sum + f.size, 0);
  if (total > UPLOAD_LIMITS.maxTotalBytes) flagged.push({ file: { id: "-", name: "(ensemble des fichiers)", size: total, webUrl: "", folder: "" }, reason: "volume total au-delà de la limite" });
  return { accepted, flagged };
}

/** Files uploaded by the client: in category sub-folders (system folders, versions and root files excluded). */
const clientFiles = (files: StoredFile[]) => files.filter((f) => f.folder !== "" && !SYSTEM_FOLDERS.has(f.folder) && !f.folder.startsWith("Envoi "));

async function allClientFiles(storage: TaxStorage, info: CaseInfo) {
  const out: (StoredFile & { year: number })[] = [];
  for (const record of info.records) for (const file of clientFiles(await storage.listFiles(record.driveId, record.folderId))) out.push({ ...file, year: record.taxYear });
  return out;
}

export async function createUpload(storage: TaxStorage, info: CaseInfo, input: UploadInput) {
  const parsed = parseDocKey(input.docKey);
  if (!parsed) throw new ServiceError("invalid_request");
  const check = checkUpload(input.fileName, input.size, input.mime);
  if (!check.ok) throw new ServiceError(check.error);
  const existing = await allClientFiles(storage, info);
  const total = existing.reduce((sum, f) => sum + f.size, 0);
  if (existing.length >= UPLOAD_LIMITS.maxFiles || total + input.size > UPLOAD_LIMITS.maxTotalBytes) throw new ServiceError("too_many_files");
  const record = (parsed.year && info.records.find((r) => r.taxYear === parsed.year)) || info.main;
  const parent = await storage.ensureSubfolder(record.driveId, record.folderId, DOC_CATEGORIES[parsed.category].folder);
  const name = uploadFileName(parsed.ruleId ? input.docKey : null, input.label, input.fileName);
  const session = await storage.createUploadSession(record.driveId, parent, name, input.size);
  void event(storage, info, "upload_started", { category: parsed.category, ext: check.ext });
  return { uploadUrl: session.uploadUrl, chunkBytes: UPLOAD_LIMITS.chunkBytes };
}

export async function listUploads(storage: TaxStorage, info: CaseInfo) {
  return (await allClientFiles(storage, info)).map((f) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    code: codeFromFileName(f.name),
    extra: f.folder === DOC_CATEGORIES.extra.folder,
    year: f.year,
  }));
}

export async function removeUpload(storage: TaxStorage, info: CaseInfo, itemId: string) {
  // Files that were part of a submission stay immutable, also after "correct my answers".
  if (info.records.some((r) => r.state === "submitted" || r.submittedAt)) throw new ServiceError("already_submitted", 409);
  // (The UI hides the remove button as soon as a submission exists.)
  const file = (await allClientFiles(storage, info)).find((f) => f.id === itemId);
  if (!file) throw new ServiceError("not_found", 404);
  const record = info.records.find((r) => r.taxYear === file.year) || info.main;
  await storage.deleteFile(record.driveId, file.id);
  void event(storage, info, "upload_removed");
}

/** Reads one of the case's uploaded files (AI extraction of the last return). */
export async function readCaseFile(storage: TaxStorage, info: CaseInfo, itemId: string, maxBytes = 15 * 1024 * 1024) {
  const file = (await allClientFiles(storage, info)).find((f) => f.id === itemId);
  if (!file) throw new ServiceError("not_found", 404);
  if (file.size > maxBytes) throw new ServiceError("file_size");
  const record = info.records.find((r) => r.taxYear === file.year) || info.main;
  const bytes = await storage.readHead(record.driveId, file.id, file.size);
  const ext = extensionOf(file.name);
  const mime = ALLOWED_TYPES[ext]?.[0] || "application/octet-stream";
  return { name: file.name, bytes, mime };
}

// ---- submission --------------------------------------------------------------------------------------

export interface FinalizeInput {
  locale: unknown;
  answers: unknown;
  docStatus: unknown;
  privacyAccepted: unknown;
  certified: unknown;
  aiOptIn?: unknown;
  /** Client-generated key of this submission attempt (retries reuse the same "Envoi" folder). */
  submitKey: unknown;
}

const inFlight = new Set<string>();

/**
 * `staffBy`: submitted in an office session (Ark staff filled it for the client): recorded as
 * submittedBy, the changed answers are marked « rempli par Ark », and no confirmation is e-mailed
 * to the client.
 */
export async function finalizeSubmission(storage: TaxStorage, info: CaseInfo, input: FinalizeInput, now = new Date(), staffBy?: string) {
  if (inFlight.has(info.caseId)) throw new ServiceError("in_progress", 409);
  inFlight.add(info.caseId);
  try {
    return await finalizeLocked(storage, info, input, now, staffBy);
  } finally {
    inFlight.delete(info.caseId);
    forget(info.caseId);
  }
}

function versionStamp(now: Date) {
  const parts = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}h${get("minute")}`;
}

async function finalizeLocked(storage: TaxStorage, info: CaseInfo, input: FinalizeInput, now: Date, staffBy?: string) {
  const locale = asLocale(input.locale);
  if (input.privacyAccepted !== true || input.certified !== true) throw new ServiceError("consent_required");
  if (info.main.state === "submitted") throw new ServiceError("already_submitted", 409);
  const submitKey = typeof input.submitKey === "string" && /^[a-z0-9]{8,32}$/.test(input.submitKey) ? input.submitKey : null;
  if (!submitKey) throw new ServiceError("invalid_request");

  const stored = await readDraft(storage, info);
  const raw = keepServerOwned(sanitizeAnswers(input.answers), stored?.answers);
  raw["start.email"] = info.email;
  const answers = pruneHidden(raw);
  const marks = markFilledBy(stored?.filledBy, stored?.answers, raw, staffBy);
  const errors = validateAll(answers, now);
  // Every item carried over from last year must still be on a visible screen (with its status).
  for (const [id, value] of Object.entries(raw)) {
    if (!Array.isArray(value)) continue;
    for (const row of value as Row[]) {
      if (typeof row !== "object" || !row || !row.carried) continue;
      const visible = Array.isArray(answers[id]) && (answers[id] as Row[]).some((r) => r._id === row._id);
      if (!visible) errors[`router.items`] = "required";
    }
  }
  if (Object.keys(errors).length > 0) {
    const steps = new Set<string>();
    for (const key of Object.keys(errors)) {
      const id = key.split("[")[0];
      const step = STEPS.find((s) => s.blocks.some((b) => (b.kind === "field" || b.kind === "group") && b.id === id));
      if (step) steps.add(step.id);
    }
    throw new ServiceError("invalid_answers", 422, { steps: [...steps] });
  }
  info = await ensureYears(storage, info, answers);

  // Prepared by Ark: the staff notes join the preparer's attention points (Excel, PDF, staff mail).
  const arkNotes = await storage.readFile(info.main.driveId, info.main.folderId, ARK_NOTES_FILE).catch(() => null);
  if (arkNotes) answers["_arkNotes"] = new TextDecoder().decode(arkNotes).split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean).slice(0, 60);

  const checklist = checklistFor(answers);
  const statusInput = cleanDocStatus(input.docStatus);

  // Files actually in SharePoint are authoritative (never the client's claims).
  const { accepted, flagged } = await screenFiles(storage, info);
  const byCode = new Map<string, StoredFile[]>();
  for (const file of accepted) {
    const code = codeFromFileName(file.name);
    if (code) byCode.set(code, [...(byCode.get(code) || []), file]);
  }
  const used = new Set<string>();
  const office = await officeDocs(storage, info);
  const docs: DocResult[] = checklist.map((item) => {
    const files = byCode.get(item.code) || [];
    files.forEach((f) => used.add(f.id));
    const claimed = statusInput[item.key];
    const status: DocStatus = files.length ? "uploaded" : officeHeld(office, item, info) ? "office" : claimed === "later" ? "later" : claimed === "na" ? "na" : "missing";
    return { item, status, files };
  });
  const extras = accepted.filter((f) => !used.has(f.id));
  // Every document needs a file or a status ("later" / "not applicable"); a file set aside for
  // checking counts as given (the client did send one).
  const flaggedCodes = new Set(flagged.map((f) => codeFromFileName(f.file.name)).filter(Boolean));
  const unresolved = docs.filter((d) => d.status === "missing" && !d.item.optional && !flaggedCodes.has(d.item.code));
  if (unresolved.length) throw new ServiceError("documents_incomplete", 422, { keys: unresolved.map((d) => d.item.key) });

  const key = clientKey(info.email, str(answers["start.lastName"]), str(answers["start.firstName"]));
  // The marks of the answers sent (hidden ones are pruned); the draft keeps them for a correction.
  const filledBy = marks ? Object.fromEntries(Object.entries(marks).filter(([k]) => answers[k] !== undefined)) : {};
  if (stored && canonical(marks || {}) !== canonical(stored.filledBy || {})) {
    await writeDraft(storage, info, { ...stored, answers: raw, savedAt: now.toISOString(), ...(marks ? { filledBy: marks } : { filledBy: undefined }) });
  }
  const record: SubmissionRecord = {
    sid: info.caseId,
    clientKey: key,
    locale,
    submittedAt: now,
    answers,
    docs,
    extras,
    flagged,
    folderName: (await storage.getFolder(info.main.driveId, info.main.folderId))?.name || info.caseId,
    folderUrl: info.main.folderUrl,
    privacyVersion: PRIVACY_VERSION,
    ...(Object.keys(filledBy).length ? { filledBy } : {}),
    ...(staffBy ? { submittedBy: staffBy } : {}),
  };

  // Immutable version folder per submission attempt: a retry with the same key reuses it.
  const keyDate = /^(\d{4})(\d{2})(\d{2})/.exec(submitKey);
  const versionName = `Envoi ${keyDate ? `${keyDate[1]}-${keyDate[2]}-${keyDate[3]}` : versionStamp(now).slice(0, 10)} ${submitKey}`;
  const versionFolder = await storage.ensureSubfolder(info.main.driveId, info.main.folderId, versionName);
  const stateRaw = await storage.readFile(info.main.driveId, versionFolder, "etat.json");
  const sent: { internal?: boolean; client?: boolean } = stateRaw ? JSON.parse(new TextDecoder().decode(stateRaw)) : {};
  const saveSent = () => storage.putFile(info.main.driveId, versionFolder, "etat.json", new TextEncoder().encode(JSON.stringify(sent)), "application/json");
  const put = (name: string, bytes: Uint8Array, type: string) => storage.putFile(info.main.driveId, versionFolder, name, bytes, type);

  const excel = await buildWorkbook(record);
  const excelName = `${safeName(excelFileName(answers), 120)}.xlsx`;
  const excelItem = await put(excelName, excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const pdf = await buildPdf(record);
  const pdfName = `${safeName(pdfFileName(answers), 120)}.pdf`;
  const pdfItem = await put(pdfName, pdf, "application/pdf");
  const consent = {
    version: 1,
    caseId: info.caseId,
    acceptedAt: now.toISOString(),
    language: locale,
    privacyNoticeVersion: PRIVACY_VERSION,
    privacyNoticeSha256: createHash("sha256").update(UI.privacyText[locale]).digest("hex"),
    certification: UI.certify[locale],
    certified: true,
    aiOptIn: input.aiOptIn === true,
    // Service reminder based on the client relationship, on by default, with opt-out (not a consent).
    annualReminder: { enabled: answers["review.reminder"] === "yes", basis: "service-reminder-opt-out", recordedAt: now.toISOString() },
    // Office session: Ark staff ticked the confirmations for the client.
    ...(staffBy ? { submittedBy: staffBy } : {}),
  };
  await put("consent.json", new TextEncoder().encode(JSON.stringify(consent, null, 2)), "application/json");
  const questionnaire = {
    schemaVersion: 3,
    caseId: info.caseId,
    householdId: info.householdId,
    clientKey: key,
    submittedAt: now.toISOString(),
    locale,
    taxYear: taxYearOf(answers),
    years: selectedYears(answers),
    answers,
    documents: docs.map((d) => ({ key: d.item.key, label: d.item.label.fr, category: d.item.category, status: d.status, files: d.files.map((f) => f.name) })),
    extras: extras.map((f) => f.name),
    flagged: flagged.map((f) => ({ name: f.file.name, reason: f.reason })),
    attention: attentionPoints(answers).map((p) => ({ level: p.level, text: p.text })),
    ...(Object.keys(filledBy).length ? { filledBy } : {}),
    ...(staffBy ? { submittedBy: staffBy } : {}),
  };
  const jsonItem = await put("questionnaire.json", new TextEncoder().encode(JSON.stringify(questionnaire, null, 2)), "application/json");
  // Arrears years: each year folder gets its own copy of the submitted version.
  const yearCopies = new Map<number, { excel: string; pdf: string; json: string }>();
  for (const rec of info.records.filter((r) => r.folderId !== info.main.folderId)) {
    const copy = await storage.ensureSubfolder(rec.driveId, rec.folderId, versionName);
    const x = await storage.putFile(rec.driveId, copy, excelName, excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const pd = await storage.putFile(rec.driveId, copy, pdfName, pdf, "application/pdf");
    const js = await storage.putFile(rec.driveId, copy, "questionnaire.json", new TextEncoder().encode(JSON.stringify(questionnaire, null, 2)), "application/json");
    yearCopies.set(rec.taxYear, { excel: x.webUrl, pdf: pd.webUrl, json: js.webUrl });
    await storage.putFile(rec.driveId, copy, "consent.json", new TextEncoder().encode(JSON.stringify(consent, null, 2)), "application/json");
  }

  const regularisation = has("regularisation")(answers);
  // TOU d'office (resident, salary ≥ CHF 120'000) has no 31 March request deadline.
  const touRequest = sourceTaxed(answers) && !(sourceTaxedResident(answers) && answers["regime.over120k"] === "yes");
  const urgentSource = touRequest && now.getMonth() <= 2; // until 31 March
  const prefixes = [staffBy ? "[Rempli par Ark]" : "", regularisation ? "[Régularisation]" : "", touRequest ? "[TOU 31.03]" : "", urgentSource ? "[URGENT]" : ""].filter(Boolean).join(" ");
  const internal = internalMail(record, excelName, excel.byteLength <= MAX_ATTACHMENT_BYTES ? excel : null);
  internal.subject = `${prefixes ? `${prefixes} ` : ""}${internal.subject}`;
  if (pdf.byteLength <= MAX_ATTACHMENT_BYTES) internal.attachments = [...(internal.attachments || []), { name: pdfName, contentType: "application/pdf", bytes: pdf }];
  if (!sent.internal) {
    try {
      await storage.sendMail(internal);
    } catch (error) {
      console.error("[tax-qf] internal mail failed", info.caseId, error instanceof Error ? error.message : "");
      await event(storage, info, "mail_failed", { kind: "internal" });
      throw new ServiceError("notify_failed", 502);
    }
    sent.internal = true;
    await saveSent();
    await event(storage, info, "mail_sent", { kind: "internal" });
  }
  let clientNotified = sent.client === true;
  // Filled and sent by the office: no confirmation to the client.
  if (!sent.client && !staffBy) {
    try {
      await storage.sendMail(regularisation ? regularisationClientMail(locale, info.email) : clientMail(record));
      sent.client = clientNotified = true;
      await saveSent();
    } catch (error) {
      console.error("[tax-qf] client mail failed", info.caseId, error instanceof Error ? error.message : "");
    }
  }

  // Master registry (verified e-mail): link or create; name-only matches are left to staff.
  let crm: { id: string; url: string; created: boolean } | null = null;
  let crmMatch: ReturnRecord["crmMatch"] = "none";
  try {
    const identity = { email: info.email, lastName: str(answers["start.lastName"]), firstName: str(answers["start.firstName"]) };
    const match = await sharePointPorts().registry.match(identity);
    if (match.status === "ambiguous") crmMatch = "ambiguous";
    else {
      crm = await sharePointPorts().registry.recordTaxClient(identity, info.main.folderUrl, now);
      crmMatch = crm?.created ? "created" : crm ? "matched" : "none";
    }
  } catch (error) {
    console.error("[tax-qf] CRM update failed", info.caseId, error instanceof Error ? error.message : "");
  }

  const received = docs.filter((d) => d.status === "uploaded").length;
  // The main year is marked submitted last, so a partial failure leaves the case retryable.
  const ordered = [...info.records.filter((r) => r.folderId !== info.main.folderId), info.main];
  for (const rec of ordered) {
    try {
      await sharePointPorts().tracker.upsert({
        ...rec,
        clientKey: key,
        canton: str(answers["start.canton"]),
        language: locale,
        state: "submitted",
        regime: regimeSummary(answers),
        optIn: answers["review.reminder"] === "yes",
        aiOptIn: input.aiOptIn === true,
        submittedAt: now.toISOString(),
        submittedBy: staffBy || undefined,
        docsReceived: rec.taxYear === info.main.taxYear ? received : rec.docsReceived,
        missingDocs: rec.taxYear === info.main.taxYear ? docs.filter(outstanding).map((d) => d.item.label.fr).join("\n") : rec.missingDocs,
        docsExpected: rec.taxYear === info.main.taxYear ? docs.length : rec.docsExpected,
        excelUrl: yearCopies.get(rec.taxYear)?.excel || excelItem.webUrl,
        pdfUrl: yearCopies.get(rec.taxYear)?.pdf || pdfItem.webUrl,
        jsonUrl: yearCopies.get(rec.taxYear)?.json || jsonItem.webUrl,
        crmId: crm?.id || rec.crmId,
        crmUrl: crm?.url || rec.crmUrl,
        crmMatch,
      });
    } catch (error) {
      console.error("[tax-qf] tracker update failed", info.caseId, error instanceof Error ? error.message : "");
      throw new ServiceError("storage_unavailable", 502);
    }
  }
  {
    try {
      const prefs = sharePointPorts().prefs;
      const current = await prefs.get(key);
      const wanted = answers["review.reminder"] === "yes";
      // Turned off in the questionnaire: the reminder stops (opt-out); otherwise it is (re)enabled.
      if (wanted || current?.optIn) await prefs.upsert({ clientKey: key, email: info.email, name: info.name, language: locale, optIn: wanted, excluded: current?.excluded || false, excludedReason: current?.excludedReason, noticeSentYear: current?.noticeSentYear });
    } catch (error) {
      console.error("[tax-qf] preferences update failed", info.caseId, error instanceof Error ? error.message : "");
    }
  }
  try {
    await autoStatus(info.main, docs.filter(outstanding).length);
  } catch (error) {
    console.error("[tax-qf] status update failed", info.caseId, error instanceof Error ? error.message : "");
  }
  await event(storage, info, "submitted", { docs: docs.length, received, flagged: flagged.length, clientNotified, crmMatch, ...(staffBy ? { submittedBy: staffBy } : {}) });

  return {
    received: docs.filter((d) => d.status === "uploaded").map((d) => d.item.key),
    pending: docs.filter(outstanding).map((d) => d.item.key),
    clientNotified,
  };
}

/** Still to come: « plus tard », or not received (an optional document Ark asked for is never missing). */
const outstanding = (d: DocResult) => d.status === "later" || (d.status === "missing" && !d.item.optional);

export interface StaffDocItem {
  label: string;
  help?: string;
  required: boolean;
}

/** A staff item read from a JSON line of « Documents à demander »: an object with a label, else null. */
function staffJsonLine(line: string): StaffDocItem | null {
  if (!line.startsWith("{")) return null;
  try {
    const raw: unknown = JSON.parse(line);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const { label, help, required } = raw as Record<string, unknown>;
    if (typeof label !== "string" || !label.trim()) return null;
    const text = typeof help === "string" ? help.trim() : "";
    return { label: label.trim(), ...(text ? { help: text } : {}), required: required !== false };
  } catch {
    return null;
  }
}

/**
 * Staff "Documents à demander" (one per line): a JSON line `{"label","help"?,"required"?}`, or a
 * plain line (legacy: split on `;`, bullet stripped), required. First of a label wins; 30 at most.
 */
export function staffDocItems(text: string | undefined): StaffDocItem[] {
  const out: StaffDocItem[] = [];
  for (const line of (text || "").split(/\r?\n/)) {
    const json = staffJsonLine(line.trim());
    const items = json ? [json] : line.split(";").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).map((label) => ({ label, required: true }));
    for (const entry of items) if (!out.some((o) => o.label === entry.label)) out.push(entry);
  }
  return out.slice(0, 30);
}
const staffRowId = (line: string) => `stf${createHash("sha256").update(line.toLowerCase()).digest("hex").slice(0, 12)}`;

/**
 * The draft with the staff items merged (in memory only: the stored draft is never rewritten
 * here, so a concurrent autosave cannot be overwritten).
 */
export function withStaffDocs(draft: Draft, staffDocs: string | undefined): Draft {
  const rows = Array.isArray(draft.answers["start.arkDocs"]) ? (draft.answers["start.arkDocs"] as Row[]) : [];
  const own = rows.filter((r) => r.staff !== "1");
  const wanted = staffDocItems(staffDocs).map((doc) => ({ _id: staffRowId(doc.label), label: doc.label.slice(0, 200), staff: "1", ...(doc.help ? { help: doc.help.slice(0, 1000) } : {}), ...(doc.required ? {} : { required: "0" }) }) as Row);
  if (!wanted.length && own.length === rows.length) return draft;
  return { ...draft, answers: { ...draft.answers, "start.arkDocs": [...own, ...wanted] } };
}

export async function syncStaffDocs(storage: TaxStorage, info: CaseInfo): Promise<Draft | null> {
  const draft = await readDraft(storage, info);
  return draft ? withStaffDocs(draft, info.main.staffDocs) : null;
}

/** Sets the status only if the tracker row (read fresh) is still in an automatic state. */
async function autoStatus(record: ReturnRecord, missing: number) {
  if (!record.trackerId) return;
  const tracker = sharePointPorts().tracker;
  const fresh = (await tracker.findByCase(record.caseId)).find((r) => r.trackerId === record.trackerId);
  const status = nextStaffStatus(fresh ? fresh.staffStatus : record.staffStatus, missing);
  if (status) await tracker.setStatus(record.trackerId, status);
}

/**
 * Documents the office already holds (Cadence « Ajouter »: received on paper or by e-mail and filed
 * there): per tax year, in that year's folder, written only by the staff action `officeDocs`. Such a
 * document leaves the client's to-do, the missing list and the reminders; a file from the client wins.
 */
export const OFFICE_DOCS_FILE = "documents-bureau.json";
export type OfficeDocs = Map<number, Set<string>>;

export async function officeDocs(storage: TaxStorage, info: CaseInfo): Promise<OfficeDocs> {
  const out: OfficeDocs = new Map();
  for (const record of info.records) {
    const raw = await storage.readFile(record.driveId, record.folderId, OFFICE_DOCS_FILE).catch(() => null);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(new TextDecoder().decode(raw)) as { keys?: unknown };
      const keys = Array.isArray(parsed.keys) ? parsed.keys.filter((k): k is string => typeof k === "string") : [];
      if (keys.length) out.set(record.taxYear, new Set(keys));
    } catch {
      // An unreadable file holds nothing: the document stays asked.
    }
  }
  return out;
}

export function officeHeld(office: OfficeDocs, item: { key: string; year?: number }, info: CaseInfo): boolean {
  return !!office.get(item.year ?? info.main.taxYear)?.has(item.key);
}

/** Every key the office holds, whatever the year (the client's form leaves them out). */
export const officeKeys = (office: OfficeDocs) => [...new Set([...office.values()].flatMap((keys) => [...keys]))];

/** Replaces the keys the office holds for one year of the case (the whole list: Cadence's receipts). */
export async function setOfficeDocs(storage: TaxStorage, info: CaseInfo, taxYear: number, keys: string[]) {
  const record = info.records.find((r) => r.taxYear === taxYear);
  if (!record) throw new ServiceError("not_found", 404);
  await storage.putFile(record.driveId, record.folderId, OFFICE_DOCS_FILE, new TextEncoder().encode(JSON.stringify({ keys })), "application/json");
}

/** Documents of the case now: files in SharePoint first, then the office's, then the client's statuses. */
async function currentDocs(storage: TaxStorage, info: CaseInfo, draft: Draft): Promise<DocResult[]> {
  const files = await allClientFiles(storage, info);
  const office = await officeDocs(storage, info);
  return checklistFor(draft.answers).map((item) => {
    const own = files.filter((f) => codeFromFileName(f.name) === item.code);
    const claimed = draft.docStatus[item.key];
    const status: DocStatus = own.length ? "uploaded" : officeHeld(office, item, info) ? "office" : claimed === "later" ? "later" : claimed === "na" ? "na" : "missing";
    return { item, status, files: own };
  });
}

/**
 * Staff API: the checklist of one tax year of a case, each item with its status (files first,
 * then the client's "later" / "not applicable"). Items without a year belong to the main year.
 */
export async function caseDocuments(storage: TaxStorage, info: CaseInfo, taxYear: number): Promise<{ docs: DocResult[]; answers: Answers }> {
  const draft = await syncStaffDocs(storage, info);
  if (!draft) return { docs: [], answers: {} };
  const docs = (await currentDocs(storage, info, draft)).filter((d) => (d.item.year ?? info.main.taxYear) === taxYear);
  return { docs, answers: draft.answers };
}

/** Staff status set by the app: only from its own states, staff choices are never overridden. */
export function nextStaffStatus(current: string | undefined, missing: number): string | null {
  const auto = !current || current === "Nouveau" || current === "Documents manquants" || current === "Dossier complet";
  if (!auto) return null;
  const wanted = missing ? "Documents manquants" : "Dossier complet";
  return wanted === current ? null : wanted;
}

/**
 * After submission: recounts the documents (files, client statuses, staff items), writes the
 * missing list and the counts to the tracker and moves the status. Returns the missing labels.
 */
export async function refreshMissing(storage: TaxStorage, info: CaseInfo): Promise<{ labels: string[]; docs: DocResult[] }> {
  const draft = await syncStaffDocs(storage, info);
  if (!draft) return { labels: [], docs: [] };
  const docs = await currentDocs(storage, info, draft);
  const labels = docs.filter(outstanding).map((d) => d.item.label[info.language] || d.item.label.fr);
  const labelsFr = docs.filter(outstanding).map((d) => d.item.label.fr);
  await sharePointPorts().tracker.upsert({ ...info.main, missingDocs: labelsFr.join("\n"), docsReceived: docs.filter((d) => d.status === "uploaded").length, docsExpected: docs.length });
  await autoStatus(info.main, labels.length);
  forget(info.caseId);
  return { labels, docs };
}

/** After submission: the client added documents from the status page and says "done". */
export async function notifyAdditions(storage: TaxStorage, info: CaseInfo) {
  const { flagged } = await screenFiles(storage, info);
  const { docs } = await refreshMissing(storage, info);
  const received = docs.filter((d) => d.status === "uploaded");
  const missing = docs.filter(outstanding);
  // A new version of the documents workbook in the folder (never overwritten).
  const now = new Date();
  try {
    const book = await buildDocsWorkbook(docs, `Documents – ${info.name} – ${info.main.taxYear}`, now);
    await storage.putFile(info.main.driveId, info.main.folderId, `Suivi documents ${versionStamp(now)}.xlsx`, book, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  } catch (error) {
    console.error("[tax-qf] documents workbook failed", info.caseId, error instanceof Error ? error.message : "");
  }
  const mail = staffAlert(
    `Documents complémentaires – ${info.name} – ${info.main.taxYear}`,
    [
      `Le client a ajouté des documents après son envoi.`,
      ...(received.length ? [`Reçus : ${received.map((d) => d.item.label.fr).join(" ; ")}`] : []),
      missing.length ? `Encore manquants (${missing.length}) : ${missing.map((d) => d.item.label.fr).join(" ; ")}` : "Plus aucun document manquant : dossier complet.",
      ...(flagged.length ? [`${flagged.length} fichier(s) à vérifier (sous-dossier « _A verifier »).`] : []),
    ],
    info.main.folderUrl,
    isInternalCase({ email: info.email, name: info.name, folderName: decodeURIComponent(info.main.folderUrl.split("/").pop() || "") }),
  );
  await storage.sendMail(mail);
  await event(storage, info, "additions_notified", { received: received.length, missing: missing.length });
}

/** "Correct my answers": back to draft; the next submission creates a new version folder. */
export async function reopenCase(info: CaseInfo) {
  for (const rec of info.records) await sharePointPorts().tracker.upsert({ ...rec, state: "draft" });
  forget(info.caseId);
}

/** The e-mailed code was returned for this case: its address is verified (set once, never cleared). */
export async function markEmailVerified(info: CaseInfo) {
  const pending = info.records.filter((r) => r.emailVerified !== true);
  if (!pending.length) return;
  for (const rec of pending) await sharePointPorts().tracker.upsert({ ...rec, emailVerified: true });
  forget(info.caseId);
}

export async function recordFeedback(info: CaseInfo, source: string) {
  const allowed = ["referral", "search", "partner", "client", "linkedin", "event", "other"];
  if (!allowed.includes(source)) throw new ServiceError("invalid_request");
  await sharePointPorts().tracker.upsert({ ...info.main, source });
  forget(info.caseId);
}

// ---- links ---------------------------------------------------------------------------------------------

export async function sendResumeLink(storage: TaxStorage, info: CaseInfo, origin?: string) {
  const scope = info.main.state === "submitted" ? "status" : "edit";
  const url = await issueLink({ caseId: info.caseId, emailHash: info.emailHash, scope, purpose: scope === "status" ? "status" : "resume", ttlMs: RESUME_LINK_TTL_MS, origin, locale: info.language });
  await storage.sendMail(linkMail(info.language, info.email, url, scope === "status" ? "status" : "resume", 30, "", info.name));
}

/** "I already started": mails links for the cases of this e-mail. The response never says whether any exist. */
export async function sendLinksForEmail(storage: TaxStorage, email: string, origin?: string) {
  const records = await sharePointPorts().tracker.findByEmailHash(emailHash(email));
  // Planned rows (staff inventory, no case yet) have nothing to resume.
  const cases = [...new Set(records.filter((r) => r.caseId && r.state !== "declined" && normalise(r.email) === normalise(email)).map((r) => r.caseId))].slice(0, 3);
  for (const caseId of cases) await sendResumeLink(storage, await getCase(caseId), origin);
  return cases.length;
}

const SHARED_FIELDS = ["start.years", "start.canton", "start.commune", "regime.residence", "regime.arrivalDate", "regime.departureDate"];

/** Unmarried partners: a linked case (same household) pre-filled with the shared data. */
export async function invitePartner(storage: TaxStorage, info: CaseInfo, partner: Identity, origin?: string) {
  if (normalise(partner.email) === normalise(info.email)) throw new ServiceError("invalid_request");
  const draft = await readDraft(storage, info);
  const from = draft?.answers || {};
  if (isCouple(from)) throw new ServiceError("invalid_request");
  const answers: Answers = { "start.household": "cohabiting" };
  for (const id of SHARED_FIELDS) if (from[id] !== undefined) answers[id] = from[id];
  if (Array.isArray(from["family.children"])) answers["family.children"] = from["family.children"];
  if (Array.isArray(from["property.items"])) answers["property.items"] = from["property.items"];
  const shared = new Set(["children", "childcare", "propertyCH", "propertyAbroad"]);
  answers["router.items"] = (Array.isArray(from["router.items"]) ? (from["router.items"] as string[]) : []).filter((v) => shared.has(v));
  const partnerCase = await createCase(storage, { identity: partner, locale: info.language, answers, householdId: info.householdId, source: "partner", stepId: "start" });
  const url = await issueLink({ caseId: partnerCase.caseId, emailHash: partnerCase.emailHash, scope: "edit", purpose: "partner", ttlMs: INVITATION_LINK_TTL_MS, origin, locale: info.language });
  await storage.sendMail(linkMail(info.language, partner.email, url, "partner", 14, info.name));
  await event(storage, info, "partner_invited");
}

// ---- annual campaign helpers ---------------------------------------------------------------------------

/** Events of last year that do not repeat: they are not carried into the new year's pre-fill. */
const ONE_OFF_ITEMS = new Set(["civilChange", "capital", "severance", "inheritance", "lottery", "regularisation", "unusual"]);
const ONE_OFF_PREFIXES = ["review.", "regularisation.", "start.avis", "start.previous", "start.yearsChanged", "regime.arrival", "regime.departure", "regime.exitFiled", "regime.keepsInSwitzerland", "regime.cantonMove", "regime.fromCanton", "family.change", "base."];

/** Last year's submitted answers, prepared as this year's pre-fill (the client confirms everything). */
export async function previousAnswers(storage: TaxStorage, record: ReturnRecord, taxYear: number): Promise<Answers | null> {
  const files = await storage.listFiles(record.driveId, record.folderId);
  const latest = files.filter((f) => f.folder.startsWith("Envoi ") && f.name === "questionnaire.json").sort((x, y) => y.folder.localeCompare(x.folder))[0];
  if (!latest) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(await storage.readHead(record.driveId, latest.id, Math.max(latest.size, 1)))) as { answers?: unknown };
    const answers = sanitizeAnswers(parsed.answers);
    const taxNumber = answers["base.taxNumber"];
    for (const key of Object.keys(answers)) if (ONE_OFF_PREFIXES.some((p) => key.startsWith(p))) delete answers[key];
    answers["router.items"] = (Array.isArray(answers["router.items"]) ? (answers["router.items"] as string[]) : []).filter((v) => !ONE_OFF_ITEMS.has(v));
    for (const row of Array.isArray(answers["property.items"]) ? (answers["property.items"] as Record<string, unknown>[]) : []) {
      delete row.events;
      delete row.boughtDate;
      delete row.soldDate;
      delete row.soldPrice;
      delete row.notaryFiled;
    }
    answers["start.years"] = [String(taxYear)];
    answers["start.status"] = "arkClient";
    if (taxNumber !== undefined) answers["base.taxNumber"] = taxNumber;
    answers["base.prefilledFrom"] = String(record.taxYear);
    // Every item of last year comes back marked "carried": the client says, item by item, whether
    // it is still there, ended during the year or changed, and adds the new ones. Items that ended
    // last year are not carried over.
    for (const [id, value] of Object.entries(answers)) {
      if (!Array.isArray(value) || !value.length || typeof value[0] !== "object" || id === "start.arkDocs") continue;
      answers[id] = (value as Row[])
        .filter((row) => row.renewal !== "ended")
        .map((row) => {
          const next: Row = { ...row, carried: String(record.taxYear) };
          delete next.renewal;
          delete next.endedOn;
          return next;
        });
    }
    delete answers["router.unchanged"];
    delete answers["router.sameAs"];
    return answers;
  } catch {
    return null;
  }
}

/** Campaign: creates the new year's case (state "invited"), pre-filled from last year when possible. */
/** Staff notes of a case prepared by Ark (root of the case folder, never listed to the client). */
export const ARK_NOTES_FILE = "Points d'attention (Ark).txt";

export async function createInvitedReturn(input: {
  clientKey: string;
  email: string;
  name: string;
  language: string;
  taxYear: number;
  prefillFrom?: ReturnRecord;
  prefillAnswers?: Record<string, unknown>;
  notes?: string[];
  planned?: ReturnRecord;
  /** Staff API: case id derived from the creation key, Cadence's references, canton when not in the answers. */
  caseId?: string;
  clientRef?: string;
  spouseRef?: string;
  createKey?: string;
  canton?: string;
}): Promise<ReturnRecord> {
  const { getStorage } = await import("./storage");
  const storage = getStorage();
  const identity = { email: input.email, ...splitPersonName(input.name) };
  const prefill = input.prefillAnswers
    ? { ...sanitizeAnswers(input.prefillAnswers), "start.years": [String(input.taxYear)] }
    : input.prefillFrom
      ? await previousAnswers(storage, input.prefillFrom, input.taxYear)
      : null;
  const answers: Record<string, unknown> = prefill || { "start.years": [String(input.taxYear)] };
  if (input.canton && !answers["start.canton"]) answers["start.canton"] = input.canton;
  // Cadence's client (and spouse) follow the client from one year to the next.
  const clientRef = input.clientRef || input.prefillFrom?.clientRef || input.planned?.clientRef;
  const info = await createCase(storage, {
    identity,
    locale: asLocale(input.language),
    answers,
    householdId: input.prefillFrom?.householdId,
    source: input.prefillAnswers ? "ark" : "campaign",
    stepId: "start",
    clientKey: input.clientKey,
    planned: input.planned,
    caseId: input.caseId,
    cadence: { clientRef, spouseRef: input.spouseRef || input.prefillFrom?.spouseRef || input.planned?.spouseRef, createKey: input.createKey },
  });
  const notes = (input.notes || []).map((n) => n.trim()).filter(Boolean).slice(0, 60);
  if (notes.length) await storage.putFile(info.main.driveId, info.main.folderId, ARK_NOTES_FILE, new TextEncoder().encode(notes.map((n) => `- ${n}`).join("\n") + "\n"), "text/plain");
  // invitedAt is written by the campaign only once the invitation e-mail has gone out.
  const invited = { ...info.main, state: "invited" as const, remindersSent: 0 };
  invited.trackerId = await sharePointPorts().tracker.upsert(invited);
  forget(info.caseId);
  return invited;
}

/** Reminder e-mail: labels of the checklist items with neither a file nor "not applicable". */
export async function missingDocuments(record: ReturnRecord, language: QfLocale): Promise<string[]> {
  const { getStorage } = await import("./storage");
  const storage = getStorage();
  const info = await getCase(record.caseId);
  const draft = await readDraft(storage, info);
  if (!draft) return [];
  const files = await allClientFiles(storage, info);
  const codes = new Set(files.map((f) => codeFromFileName(f.name)).filter(Boolean));
  const office = await officeDocs(storage, info);
  return checklistFor(pruneHidden(draft.answers))
    .filter((item) => !codes.has(item.code) && draft.docStatus[item.key] !== "na" && !officeHeld(office, item, info) && !(item.optional && !draft.docStatus[item.key]))
    .map((item) => item.label[language]);
}

/** Deletes drafts never submitted and untouched for 90 days (enabled by TAX_QF_CLEANUP_ENABLED). */
export async function cleanupAbandonedDrafts(now = new Date(), limit = 20): Promise<{ deleted: number }> {
  const { getStorage } = await import("./storage");
  const storage = getStorage();
  const year = now.getFullYear();
  let deleted = 0;
  for (let taxYear = year - 6; taxYear <= year; taxYear++) {
    for (const record of await sharePointPorts().tracker.listByYear(taxYear)) {
      if (deleted >= limit) return { deleted };
      if (record.state !== "draft" || record.submittedAt) continue;
      const info = await getCase(record.caseId).catch(() => null);
      if (!info || info.main.taxYear !== record.taxYear) continue;
      const draft = await readDraft(storage, info);
      const savedAt = draft ? Date.parse(draft.savedAt) : 0;
      if (!savedAt || now.getTime() - savedAt < 90 * 24 * 60 * 60 * 1000) continue;
      await deleteDraft(storage, info);
      deleted++;
    }
  }
  return { deleted };
}

/** Opt-out link of the campaign e-mails ("client:<clientKey>" pseudo-case). */
export async function optOut(clientKeyValue: string) {
  const prefs = sharePointPorts().prefs;
  const current = await prefs.get(clientKeyValue);
  await prefs.upsert({
    clientKey: clientKeyValue,
    email: current?.email || "",
    name: current?.name || "",
    language: current?.language || "fr",
    optIn: false,
    excluded: true,
    excludedReason: "Désinscription par le client (lien e-mail)",
    noticeSentYear: current?.noticeSentYear,
  });
}

/**
 * Server-side AI gate (never the client's word): the saved draft must carry the AI opt-in, and
 * the protected regularisation route never reaches the model.
 */
export async function aiGate(storage: TaxStorage, caseId: string): Promise<null | "ai_consent_required" | "ai_not_available"> {
  const draft = await readDraft(storage, await getCase(caseId));
  if (!draft?.aiOptIn) return "ai_consent_required";
  if (has("regularisation")(draft.answers)) return "ai_not_available";
  return null;
}
