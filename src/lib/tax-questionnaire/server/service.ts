/**
 * Submission flow, independent of HTTP (routes in app/api/tax-questionnaire/* call it; tests run
 * it against MockStorage):
 *   start → folder created, signed token; upload → upload session in a category sub-folder;
 *   files/remove → listing and deletion before submission; finalize → validation, Excel, JSON copy,
 *   emails, idempotent.
 */
import { createHash } from "node:crypto";
import { DOC_CATEGORIES, docRuleById, selectedYears, taxYearOf } from "../documents";
import { checkUpload, codeFromFileName, extensionOf, safeName, sniffMismatch, uploadFileName, UPLOAD_LIMITS, ALLOWED_TYPES } from "../files";
import { checklistFor, pruneHidden, sanitizeAnswers, validateAll } from "../logic";
import { STEPS } from "../schema";
import { issueToken, newSubmissionId, type SubmissionToken } from "../token";
import { QF_LOCALES, type DocStatus, type QfLocale } from "../types";
import { PRIVACY_VERSION } from "../ui";
import { clientMail, internalMail } from "./email";
import { buildWorkbook, excelFileName, regimeSummary, type DocResult, type SubmissionRecord } from "./excel";
import type { StoredFile, TaxStorage } from "./storage";

export const STATE_FILE = "questionnaire.json";
export const FLAGGED_FOLDER = "_A verifier";
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

/**
 * Stable client key (renewals, tracking list): normalised email + normalised name. Never shown to
 * the client; a future renewal link must still require an e-mailed one-time code before any
 * previous answers are returned (see docs/tax-questionnaire.md).
 */
export function clientKey(email: string, lastName: string, firstName: string): string {
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`ark-tax-qf-client|${norm(email)}|${norm(lastName)}|${norm(firstName)}`).digest("hex").slice(0, 24);
}

// ---- start --------------------------------------------------------------------------------------

export interface StartInput {
  lastName: string;
  firstName: string;
  year: number;
}

export function submissionFolderName(input: StartInput, sid: string, now = new Date()): string {
  const date = now.toISOString().slice(0, 10);
  const name = safeName(`${input.lastName.toUpperCase()} ${input.firstName}`, 60);
  return `${env("TAX_QF_FOLDER_PREFIX")}${name} - ${date} - ${sid}`;
}

export async function startSubmission(storage: TaxStorage, secret: string, input: StartInput) {
  const sid = newSubmissionId();
  const folder = await storage.createSubmissionFolder(input.year, submissionFolderName(input, sid));
  const token = issueToken(secret, { sid, drive: folder.driveId, folder: folder.folderId, name: folder.name, year: input.year });
  return { token, folderName: folder.name };
}

// ---- state --------------------------------------------------------------------------------------

interface StateFile {
  status: "stored" | "complete";
}

async function readState(storage: TaxStorage, token: SubmissionToken): Promise<StateFile | null> {
  const raw = await storage.readFile(token.drive, token.folder, STATE_FILE);
  if (!raw) return null;
  try {
    return JSON.parse(new TextDecoder().decode(raw)) as StateFile;
  } catch {
    return { status: "stored" };
  }
}

async function assertOpen(storage: TaxStorage, token: SubmissionToken) {
  if (!(await storage.getFolder(token.drive, token.folder))) throw new ServiceError("session_expired", 410);
  if ((await readState(storage, token))?.status === "complete") throw new ServiceError("already_submitted", 409);
}

/** Uploaded files = files in the category sub-folders (root files are ours: Excel, JSON). */
const clientFiles = (files: StoredFile[]) => files.filter((f) => f.folder !== "");

// ---- uploads ------------------------------------------------------------------------------------

export interface UploadInput {
  docKey: string; // "<ruleId>", "<ruleId>:<rowId>" or "extra"
  label: string; // short label for the file name (cosmetic)
  fileName: string;
  size: number;
  mime: string;
}

export function parseDocKey(docKey: string): { ruleId: string | null; category: keyof typeof DOC_CATEGORIES } | null {
  if (docKey === "extra") return { ruleId: null, category: "extra" };
  const match = /^([a-z0-9-]{2,40})(?::([a-z0-9]{6,24}))?$/.exec(docKey);
  if (!match) return null;
  const rule = docRuleById(match[1]);
  if (!rule || !!rule.forEach !== !!match[2]) return null;
  return { ruleId: rule.id, category: rule.category };
}

export async function createUpload(storage: TaxStorage, token: SubmissionToken, input: UploadInput) {
  const parsed = parseDocKey(input.docKey);
  if (!parsed) throw new ServiceError("invalid_request");
  const check = checkUpload(input.fileName, input.size, input.mime);
  if (!check.ok) throw new ServiceError(check.error);
  await assertOpen(storage, token);
  const existing = clientFiles(await storage.listFiles(token.drive, token.folder));
  const total = existing.reduce((sum, f) => sum + f.size, 0);
  if (existing.length >= UPLOAD_LIMITS.maxFiles || total + input.size > UPLOAD_LIMITS.maxTotalBytes) throw new ServiceError("too_many_files");
  const parent = await storage.ensureSubfolder(token.drive, token.folder, DOC_CATEGORIES[parsed.category].folder);
  const name = uploadFileName(parsed.ruleId ? input.docKey : null, input.label, input.fileName);
  const session = await storage.createUploadSession(token.drive, parent, name, input.size);
  return { uploadUrl: session.uploadUrl, chunkBytes: UPLOAD_LIMITS.chunkBytes };
}

export async function listUploads(storage: TaxStorage, token: SubmissionToken) {
  await assertOpen(storage, token);
  return clientFiles(await storage.listFiles(token.drive, token.folder))
    .filter((f) => f.folder !== FLAGGED_FOLDER)
    .map((f) => ({ id: f.id, name: f.name, size: f.size, code: codeFromFileName(f.name), extra: f.folder === DOC_CATEGORIES.extra.folder }));
}

export async function removeUpload(storage: TaxStorage, token: SubmissionToken, itemId: string) {
  await assertOpen(storage, token);
  const file = clientFiles(await storage.listFiles(token.drive, token.folder)).find((f) => f.id === itemId);
  if (!file) throw new ServiceError("not_found", 404);
  await storage.deleteFile(token.drive, file.id);
}

// ---- finalize -----------------------------------------------------------------------------------

export interface FinalizeInput {
  locale: string;
  answers: unknown;
  docStatus: unknown;
  privacyAccepted: unknown;
  certified: unknown;
}

const inFlight = new Set<string>();

export async function finalizeSubmission(storage: TaxStorage, token: SubmissionToken, input: FinalizeInput, now = new Date()) {
  if (inFlight.has(token.sid)) throw new ServiceError("in_progress", 409);
  inFlight.add(token.sid);
  try {
    return await finalizeLocked(storage, token, input, now);
  } finally {
    inFlight.delete(token.sid);
  }
}

async function finalizeLocked(storage: TaxStorage, token: SubmissionToken, input: FinalizeInput, now: Date) {
  const locale: QfLocale = (QF_LOCALES as readonly string[]).includes(input.locale) ? (input.locale as QfLocale) : "fr";
  if (input.privacyAccepted !== true || input.certified !== true) throw new ServiceError("consent_required");
  await assertOpen(storage, token);

  const answers = pruneHidden(sanitizeAnswers(input.answers));
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
  if (taxYearOf(answers) !== token.year) throw new ServiceError("invalid_answers", 422, { steps: ["start"] });

  const checklist = checklistFor(answers);
  const statusInput = input.docStatus && typeof input.docStatus === "object" ? (input.docStatus as Record<string, unknown>) : {};

  // Files actually in SharePoint are authoritative (never the client's claims).
  const all = clientFiles(await storage.listFiles(token.drive, token.folder));
  const flagged: { file: StoredFile; reason: string }[] = [];
  const accepted: StoredFile[] = [];
  let flaggedFolderId = "";
  for (const file of all) {
    if (file.folder === FLAGGED_FOLDER) {
      flagged.push({ file, reason: "déjà signalé lors d'un envoi précédent" });
      continue;
    }
    let reason: string | null = null;
    const ext = extensionOf(file.name);
    if (file.size === 0) reason = "fichier vide (envoi interrompu ?)";
    else if (!ALLOWED_TYPES[ext]) reason = "type non autorisé";
    else reason = sniffMismatch(ext, await storage.readHead(token.drive, file.id, 1024));
    if (!reason) {
      accepted.push(file);
      continue;
    }
    if (!flaggedFolderId) flaggedFolderId = await storage.ensureSubfolder(token.drive, token.folder, FLAGGED_FOLDER);
    await storage.moveFile(token.drive, file.id, flaggedFolderId);
    flagged.push({ file: { ...file, folder: FLAGGED_FOLDER }, reason });
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
  // Files of items no longer in the checklist (answers changed after upload) count as extras.
  const extras = accepted.filter((f) => !used.has(f.id));

  const key = clientKey(str(answers["start.email"]), str(answers["start.lastName"]), str(answers["start.firstName"]));
  const record: SubmissionRecord = {
    sid: token.sid,
    clientKey: key,
    locale,
    submittedAt: now,
    answers,
    docs,
    extras,
    flagged,
    folderName: token.name,
    folderUrl: (await storage.getFolder(token.drive, token.folder))?.webUrl || "",
    privacyVersion: PRIVACY_VERSION,
  };

  const excel = await buildWorkbook(record);
  const excelName = `${safeName(excelFileName(answers), 120)}.xlsx`;
  const excelItem = await storage.putFile(token.drive, token.folder, excelName, excel, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  const state = (status: "stored" | "complete", notified: { internal: boolean; client: boolean }) => ({
    version: 1,
    status,
    notified,
    sid: token.sid,
    clientKey: key,
    reminderOptIn: answers["review.reminder"] === "yes",
    submittedAt: now.toISOString(),
    locale,
    privacyVersion: PRIVACY_VERSION,
    privacyAcceptedAt: now.toISOString(),
    certifiedAt: now.toISOString(),
    answers,
    documents: docs.map((d) => ({ key: d.item.key, label: d.item.label.fr, category: d.item.category, status: d.status, files: d.files.map((f) => f.name) })),
    extras: extras.map((f) => f.name),
    flagged: flagged.map((f) => ({ name: f.file.name, reason: f.reason })),
  });
  const writeState = (value: ReturnType<typeof state>) =>
    storage.putFile(token.drive, token.folder, STATE_FILE, new TextEncoder().encode(JSON.stringify(value, null, 2)), "application/json");

  const jsonItem = await writeState(state("stored", { internal: false, client: false }));

  try {
    await storage.sendMail(internalMail(record, excelName, excel.byteLength <= MAX_ATTACHMENT_BYTES ? excel : null));
  } catch (error) {
    console.error("[tax-qf] internal mail failed", token.sid, error instanceof Error ? error.message : "");
    throw new ServiceError("notify_failed", 502);
  }
  let clientNotified = true;
  try {
    await storage.sendMail(clientMail(record));
  } catch (error) {
    clientNotified = false;
    console.error("[tax-qf] client mail failed", token.sid, error instanceof Error ? error.message : "");
  }
  try {
    await storage.upsertTracking({
      clientKey: key,
      name: `${str(answers["start.lastName"]).toUpperCase()} ${str(answers["start.firstName"])}`.trim(),
      email: str(answers["start.email"]),
      language: locale,
      canton: str(answers["start.canton"]),
      taxYear: token.year,
      years: selectedYears(answers).join(", "),
      regime: regimeSummary(answers),
      optIn: answers["review.reminder"] === "yes",
      submittedAt: now.toISOString(),
      docsReceived: docs.filter((d) => d.status === "uploaded").length,
      docsExpected: docs.length,
      submissionId: token.sid,
      excelUrl: excelItem.webUrl,
      folderUrl: record.folderUrl,
      jsonUrl: jsonItem.webUrl,
    });
  } catch (error) {
    // The list is a convenience for staff; the submission itself is complete.
    console.error("[tax-qf] tracking list update failed", token.sid, error instanceof Error ? error.message : "");
  }
  await writeState(state("complete", { internal: true, client: clientNotified }));

  return {
    received: docs.filter((d) => d.status === "uploaded").map((d) => d.item.key),
    pending: docs.filter((d) => d.status === "later" || d.status === "missing").map((d) => d.item.key),
    clientNotified,
  };
}
