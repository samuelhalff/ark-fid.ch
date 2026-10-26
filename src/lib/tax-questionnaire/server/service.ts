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
import { ALLOWED_TYPES, checkUpload, codeFromFileName, extensionOf, safeName, sniffMismatch, uploadFileName, UPLOAD_LIMITS } from "../files";
import { checklistFor, pruneHidden, sanitizeAnswers, validateAll } from "../logic";
import { has, isCouple, sourceTaxed, STEPS } from "../schema";
import { QF_LOCALES, type Answers, type DocStatus, type QfLocale } from "../types";
import { PRIVACY_VERSION, UI } from "../ui";
import { emailHash, INVITATION_LINK_TTL_MS, issueLink, RESUME_LINK_TTL_MS } from "./access";
import { clientMail, internalMail } from "./email";
import { buildWorkbook, excelFileName, regimeSummary, type DocResult, type SubmissionRecord } from "./excel";
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
  const name = safeName(`${identity.lastName.toUpperCase()} ${identity.firstName}`, 60);
  return `${env("TAX_QF_FOLDER_PREFIX")}${name} - ${now.toISOString().slice(0, 10)} - ${caseId}`;
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

export async function getCase(caseId: string): Promise<CaseInfo> {
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
    return { ...parsed, answers: sanitizeAnswers(parsed.answers), docStatus: cleanDocStatus(parsed.docStatus), locale: asLocale(parsed.locale) };
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
export async function createCase(storage: TaxStorage, input: { identity: Identity; locale: QfLocale; answers: unknown; householdId?: string; source?: string; stepId?: string }) {
  const caseId = randomBytes(6).toString("hex");
  const answers = sanitizeAnswers(input.answers);
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
    name: `${input.identity.lastName.toUpperCase()} ${input.identity.firstName}`.trim(),
    language: input.locale,
  };
  const folderName = caseFolderName(input.identity, caseId);
  const records: ReturnRecord[] = [];
  for (const year of years) {
    const folder = await storage.createSubmissionFolder(year, folderName);
    const record = baseRecord(head, year, folder, answers, { source: input.source });
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

export async function saveDraft(storage: TaxStorage, info: CaseInfo, body: { answers: unknown; stepId: unknown; docStatus: unknown; locale: unknown; aiOptIn?: unknown }) {
  if (info.main.state === "submitted") throw new ServiceError("already_submitted", 409);
  const answers = sanitizeAnswers(body.answers);
  // The identity stays the verified one.
  answers["start.email"] = info.email;
  const stepId = STEPS.some((s) => s.id === body.stepId) ? String(body.stepId) : "start";
  const updated = await ensureYears(storage, info, answers);
  const draft: Draft = { version: 1, savedAt: new Date().toISOString(), stepId, answers, docStatus: cleanDocStatus(body.docStatus), locale: asLocale(body.locale), aiOptIn: body.aiOptIn === true };
  await writeDraft(storage, updated, draft);
  return { savedAt: draft.savedAt };
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
  if (info.main.state === "submitted") throw new ServiceError("already_submitted", 409);
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

export async function finalizeSubmission(storage: TaxStorage, info: CaseInfo, input: FinalizeInput, now = new Date()) {
  if (inFlight.has(info.caseId)) throw new ServiceError("in_progress", 409);
  inFlight.add(info.caseId);
  try {
    return await finalizeLocked(storage, info, input, now);
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

async function finalizeLocked(storage: TaxStorage, info: CaseInfo, input: FinalizeInput, now: Date) {
  const locale = asLocale(input.locale);
  if (input.privacyAccepted !== true || input.certified !== true) throw new ServiceError("consent_required");
  if (info.main.state === "submitted") throw new ServiceError("already_submitted", 409);
  const submitKey = typeof input.submitKey === "string" && /^[a-z0-9]{8,32}$/.test(input.submitKey) ? input.submitKey : null;
  if (!submitKey) throw new ServiceError("invalid_request");

  const raw = sanitizeAnswers(input.answers);
  raw["start.email"] = info.email;
  const answers = pruneHidden(raw);
  const errors = validateAll(answers, now);
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

  const checklist = checklistFor(answers);
  const statusInput = cleanDocStatus(input.docStatus);

  // Files actually in SharePoint are authoritative (never the client's claims).
  const flagged: { file: StoredFile; reason: string }[] = [];
  const accepted: (StoredFile & { year: number })[] = [];
  for (const record of info.records) {
    const files = await storage.listFiles(record.driveId, record.folderId);
    let flaggedFolderId = "";
    for (const file of files) {
      if (file.folder === FLAGGED_FOLDER) {
        flagged.push({ file, reason: "déjà signalé lors d'un envoi précédent" });
        continue;
      }
      if (!clientFiles([file]).length) continue;
      const ext = extensionOf(file.name);
      let reason: string | null = null;
      if (file.size === 0) reason = "fichier vide (envoi interrompu ?)";
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
  const byCode = new Map<string, StoredFile[]>();
  for (const file of accepted) {
    const code = codeFromFileName(file.name);
    if (code) byCode.set(code, [...(byCode.get(code) || []), file]);
  }
  const used = new Set<string>();
  const docs: DocResult[] = checklist.map((item) => {
    const files = byCode.get(item.code) || [];
    files.forEach((f) => used.add(f.id));
    const claimed = statusInput[item.key];
    const status: DocStatus = files.length ? "uploaded" : claimed === "later" ? "later" : claimed === "na" ? "na" : "missing";
    return { item, status, files };
  });
  const extras = accepted.filter((f) => !used.has(f.id));

  const key = clientKey(info.email, str(answers["start.lastName"]), str(answers["start.firstName"]));
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
  };

  // Immutable version folder (a retry of the same attempt reuses it).
  const versionFolder = await storage.ensureSubfolder(info.main.driveId, info.main.folderId, `Envoi ${versionStamp(now)} ${submitKey.slice(0, 6)}`);
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
    reminderOptIn: answers["review.reminder"] === "yes",
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
  };
  const jsonItem = await put("questionnaire.json", new TextEncoder().encode(JSON.stringify(questionnaire, null, 2)), "application/json");

  const regularisation = has("regularisation")(answers);
  const urgentSource = sourceTaxed(answers) && now.getMonth() <= 2; // until 31 March
  const prefixes = [regularisation ? "[Régularisation]" : "", sourceTaxed(answers) ? "[TOU 31.03]" : "", urgentSource ? "[URGENT]" : ""].filter(Boolean).join(" ");
  const internal = internalMail(record, excelName, excel.byteLength <= MAX_ATTACHMENT_BYTES ? excel : null);
  internal.subject = `${prefixes ? `${prefixes} ` : ""}${internal.subject}`;
  if (pdf.byteLength <= MAX_ATTACHMENT_BYTES) internal.attachments = [...(internal.attachments || []), { name: pdfName, contentType: "application/pdf", bytes: pdf }];
  try {
    await storage.sendMail(internal);
  } catch (error) {
    console.error("[tax-qf] internal mail failed", info.caseId, error instanceof Error ? error.message : "");
    await event(storage, info, "mail_failed", { kind: "internal" });
    throw new ServiceError("notify_failed", 502);
  }
  await event(storage, info, "mail_sent", { kind: "internal" });
  let clientNotified = true;
  try {
    await storage.sendMail(regularisation ? regularisationClientMail(locale, info.email) : clientMail(record));
  } catch (error) {
    clientNotified = false;
    console.error("[tax-qf] client mail failed", info.caseId, error instanceof Error ? error.message : "");
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
  for (const rec of info.records) {
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
        docsReceived: rec.taxYear === info.main.taxYear ? received : rec.docsReceived,
        docsExpected: rec.taxYear === info.main.taxYear ? docs.length : rec.docsExpected,
        excelUrl: excelItem.webUrl,
        pdfUrl: pdfItem.webUrl,
        jsonUrl: jsonItem.webUrl,
        crmId: crm?.id || rec.crmId,
        crmUrl: crm?.url || rec.crmUrl,
        crmMatch,
      });
    } catch (error) {
      console.error("[tax-qf] tracker update failed", info.caseId, error instanceof Error ? error.message : "");
    }
  }
  if (answers["review.reminder"] === "yes") {
    try {
      const prefs = sharePointPorts().prefs;
      const current = await prefs.get(key);
      await prefs.upsert({ clientKey: key, email: info.email, name: info.name, language: locale, optIn: true, excluded: current?.excluded || false, excludedReason: current?.excludedReason, noticeSentYear: current?.noticeSentYear });
    } catch (error) {
      console.error("[tax-qf] preferences update failed", info.caseId, error instanceof Error ? error.message : "");
    }
  }
  await event(storage, info, "submitted", { docs: docs.length, received, flagged: flagged.length, clientNotified, crmMatch });

  return {
    received: docs.filter((d) => d.status === "uploaded").map((d) => d.item.key),
    pending: docs.filter((d) => d.status === "later" || d.status === "missing").map((d) => d.item.key),
    clientNotified,
  };
}

/** After submission: the client added documents from the status page and says "done". */
export async function notifyAdditions(storage: TaxStorage, info: CaseInfo) {
  const files = await allClientFiles(storage, info);
  const mail = staffAlert(
    `Documents complémentaires – ${info.name} – ${info.main.taxYear}`,
    [`Le client signale avoir ajouté des documents après son envoi (${files.length} fichier(s) au total dans le dossier).`, ...files.slice(-30).map((f) => f.name)],
    info.main.folderUrl,
  );
  await storage.sendMail(mail);
  await event(storage, info, "additions_notified", { files: files.length });
}

/** "Correct my answers": back to draft; the next submission creates a new version folder. */
export async function reopenCase(info: CaseInfo) {
  for (const rec of info.records) await sharePointPorts().tracker.upsert({ ...rec, state: "draft" });
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
  await storage.sendMail(linkMail(info.language, info.email, url, scope === "status" ? "status" : "resume", 30));
}

/** "I already started": mails links for the cases of this e-mail. The response never says whether any exist. */
export async function sendLinksForEmail(storage: TaxStorage, email: string, origin?: string) {
  const records = await sharePointPorts().tracker.findByEmailHash(emailHash(email));
  const cases = [...new Set(records.filter((r) => r.state !== "declined" && normalise(r.email) === normalise(email)).map((r) => r.caseId))].slice(0, 3);
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
const ONE_OFF_PREFIXES = ["review.", "regularisation.", "start.avis", "regime.arrival", "regime.departure", "regime.exitFiled", "regime.keepsInSwitzerland", "regime.cantonMove", "regime.fromCanton", "family.change", "base."];

/** Last year's submitted answers, prepared as this year's pre-fill (the client confirms everything). */
export async function previousAnswers(storage: TaxStorage, record: ReturnRecord, taxYear: number): Promise<Answers | null> {
  const files = await storage.listFiles(record.driveId, record.folderId);
  const latest = files.filter((f) => f.folder.startsWith("Envoi ") && f.name === "questionnaire.json").sort((x, y) => y.folder.localeCompare(x.folder))[0];
  if (!latest) return null;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(await storage.readHead(record.driveId, latest.id, Math.max(latest.size, 1)))) as { answers?: unknown };
    const answers = sanitizeAnswers(parsed.answers);
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
    answers["base.prefilledFrom"] = String(record.taxYear);
    return answers;
  } catch {
    return null;
  }
}

/** Campaign: creates the new year's case (state "invited"), pre-filled from last year when possible. */
export async function createInvitedReturn(input: { clientKey: string; email: string; name: string; language: string; taxYear: number; prefillFrom?: ReturnRecord }): Promise<ReturnRecord> {
  const { getStorage } = await import("./storage");
  const storage = getStorage();
  const [lastName, ...rest] = input.name.trim().split(/\s+/);
  const identity = { email: input.email, lastName: lastName || input.name, firstName: rest.join(" ") };
  const prefill = input.prefillFrom ? await previousAnswers(storage, input.prefillFrom, input.taxYear) : null;
  const info = await createCase(storage, {
    identity,
    locale: asLocale(input.language),
    answers: prefill || { "start.years": [String(input.taxYear)] },
    householdId: input.prefillFrom?.householdId,
    source: "campaign",
    stepId: "start",
  });
  const invited = { ...info.main, state: "invited" as const, invitedAt: new Date().toISOString(), remindersSent: 0 };
  invited.trackerId = await sharePointPorts().tracker.upsert(invited);
  forget(info.caseId);
  return invited;
}

/** Deletes drafts never submitted and untouched for 90 days (enabled by TAX_QF_CLEANUP_ENABLED). */
export async function cleanupAbandonedDrafts(now = new Date(), limit = 20): Promise<{ deleted: number }> {
  const { getStorage } = await import("./storage");
  const storage = getStorage();
  const year = now.getFullYear();
  let deleted = 0;
  for (const taxYear of [year - 2, year - 1, year]) {
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
