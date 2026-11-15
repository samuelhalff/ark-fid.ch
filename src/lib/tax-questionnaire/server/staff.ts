/**
 * Staff API for Cadence (signed server-to-server requests, routes under
 * app/api/tax-questionnaire/staff/returns): create or adopt a return, the change feed, one return
 * with its documents and answers, and the row actions (link, remind, exclude, include, deadline,
 * staffDocs, attach). The site stays the only sender of tax e-mails; Cadence asks it to send.
 * Contract: docs/tax-questionnaire.md « API bureau (Cadence) ».
 */
import { createHmac } from "node:crypto";
import { parseApiKeys } from "../../kyc-questionnaire/server/signature";
import { personName } from "../format";
import { emailHash, issueLink, issueLinkWithExpiry, RESUME_LINK_TTL_MS } from "./access";
import { inviteMember, isClosed, isPlanned, lang, MISSING_STOP_STATUSES, nextMailAt, plannedFor, previousReturn, sendMissingReminder, sendReminder, type CampaignDeps, type CampaignLedger } from "./campaign";
import { linkMail } from "./mails";
import type { ReturnRecord } from "./ports";
import { caseDocuments, clientKey as computeClientKey, createInvitedReturn, forgetCase, getCase, missingDocuments, refreshMissing, ServiceError, setOfficeDocs } from "./service";
import { normalise, sharePointPorts } from "./sharepoint-registry";
import type { TaxStorage } from "./storage";

const env = (name: string) => (process.env[name] || "").trim();
const DAY = 24 * 60 * 60 * 1000;
/** Staff links (handed over or mailed by Cadence) live as long as a resume link. */
export const STAFF_LINK_TTL_MS = RESUME_LINK_TTL_MS;
/** The feed serves rows changed at least this long ago (SharePoint writes settle; cursor is >=). */
export const FEED_QUIET_MS = 10_000;

/**
 * Cadence API keys of this API ("keyId:secret" pairs, comma-separated, as KYC_QF_API_KEYS): a
 * separate set, so a KYC key never signs a tax request and the reverse.
 */
export const taxApiKeys = () => parseApiKeys(env("TAX_QF_API_KEYS"));

export interface StaffDeps {
  campaign: CampaignDeps;
  storage: TaxStorage;
  /** Durable record of processed action keys (production: the cron ledger files). */
  ledger: CampaignLedger;
  origin: string;
  now: () => Date;
}

/** The app's campaign dependencies (also used by the daily cron). */
export function appCampaignDeps(storage: TaxStorage, ledger?: CampaignLedger): CampaignDeps {
  const ports = sharePointPorts();
  return {
    registry: ports.registry,
    tracker: ports.tracker,
    prefs: ports.prefs,
    sendMail: (message) => storage.sendMail(message),
    issueLink,
    hashEmail: emailHash,
    createInvitedReturn,
    missingDocuments,
    refreshMissing: async (record) => (await refreshMissing(storage, await getCase(record.caseId))).labels,
    staffRecipients: (env("TAX_QF_STAFF_ALERT_TO") || "samuel.halff@ark-fid.ch,sebastien.gallie@ark-fid.ch").split(",").map((v) => v.trim()).filter(Boolean),
    ledger,
  };
}

// ---- shapes ------------------------------------------------------------------------------------------

export interface ReturnSummary {
  caseId: string;
  taxYear: number;
  clientRef?: string;
  spouseRef?: string;
  householdId: string;
  name: string;
  email: string;
  /** The client proved the address with an e-mailed code (case started by the client, or submitted). */
  emailVerified: boolean;
  language: string;
  canton: string;
  state: ReturnRecord["state"];
  submittedAt?: string;
  invitedAt?: string;
  remindersSent: number;
  lastReminderAt?: string;
  missingRemindersSent: number;
  lastMissingReminderAt?: string;
  docsReceived: number;
  docsExpected: number;
  folderUrl: string;
  excelUrl?: string;
  pdfUrl?: string;
  excluded: boolean;
  extendedTo?: string;
  staffDocs: string[];
  updatedAt: string;
}

export interface LinkResult {
  url: string;
  expiresAt: string;
}

const lines = (text: string | undefined) => (text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/** Never the answers: those are served by staffReturn only. */
export function summarize(r: ReturnRecord): ReturnSummary {
  return {
    caseId: r.caseId,
    taxYear: r.taxYear,
    ...(r.clientRef ? { clientRef: r.clientRef } : {}),
    ...(r.spouseRef ? { spouseRef: r.spouseRef } : {}),
    householdId: r.householdId,
    name: r.name,
    email: r.email,
    emailVerified: r.state === "submitted" || (r.source !== "campaign" && r.source !== "ark" && r.source !== "inventaire"),
    language: r.language,
    canton: r.canton,
    state: r.state,
    ...(r.submittedAt ? { submittedAt: r.submittedAt } : {}),
    ...(r.invitedAt ? { invitedAt: r.invitedAt } : {}),
    remindersSent: r.remindersSent || 0,
    ...(r.lastReminderAt ? { lastReminderAt: r.lastReminderAt } : {}),
    missingRemindersSent: r.missingRemindersSent || 0,
    ...(r.lastMissingReminderAt ? { lastMissingReminderAt: r.lastMissingReminderAt } : {}),
    docsReceived: r.docsReceived || 0,
    docsExpected: r.docsExpected || 0,
    folderUrl: r.folderUrl,
    ...(r.excelUrl ? { excelUrl: r.excelUrl } : {}),
    ...(r.pdfUrl ? { pdfUrl: r.pdfUrl } : {}),
    excluded: !!r.excludedFromCampaign,
    ...(r.extendedTo ? { extendedTo: r.extendedTo.slice(0, 10) } : {}),
    staffDocs: lines(r.staffDocs),
    updatedAt: r.modifiedAt || "",
  };
}

// ---- helpers -----------------------------------------------------------------------------------------

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

/**
 * Case id derived from the creation's Idempotency-Key only (keyed hash, same shape as a random
 * id): a retry after a half-done creation, even days later, finds the same case.
 */
export function caseIdFor(idempotencyKey: string): string {
  const secret = env("TAX_QF_TOKEN_SECRET");
  if (secret.length < 32) throw new Error("TAX_QF_TOKEN_SECRET missing or too short");
  return createHmac("sha256", secret).update(`ark-tax-qf|case|${idempotencyKey}`).digest("hex").slice(0, 12);
}

const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,}$/i;
const REF_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const optionalRef = (v: unknown, field: string) => {
  const value = str(v);
  if (value && !REF_RE.test(value)) throw new ServiceError(`invalid_${field}`, 400);
  return value || undefined;
};

function validYear(value: unknown, now: Date): number {
  const year = Number(value);
  if (!Number.isInteger(year) || year < now.getUTCFullYear() - 6 || year >= now.getUTCFullYear()) throw new ServiceError("invalid_tax_year", 400);
  return year;
}

async function caseRows(caseId: string): Promise<ReturnRecord[]> {
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(caseId)) throw new ServiceError("not_found", 404);
  const rows = (await sharePointPorts().tracker.findByCase(caseId)).filter((r) => r.state !== "declined").sort((x, y) => y.taxYear - x.taxYear);
  if (!rows.length) throw new ServiceError("not_found", 404);
  return rows;
}

function yearRow(rows: ReturnRecord[], year: unknown): ReturnRecord {
  if (year === undefined || year === null || year === "") return rows[0];
  const row = rows.find((r) => r.taxYear === Number(year));
  if (!row) throw new ServiceError("not_found", 404);
  return row;
}

async function reread(row: ReturnRecord): Promise<ReturnRecord> {
  forgetCase(row.caseId);
  return (await sharePointPorts().tracker.findByCase(row.caseId)).find((r) => r.trackerId === row.trackerId && r.taxYear === row.taxYear) || row;
}

async function staffLink(row: ReturnRecord, deps: StaffDeps): Promise<LinkResult> {
  const scope = row.state === "submitted" ? "status" : "edit";
  return issueLinkWithExpiry({ caseId: row.caseId, emailHash: row.emailHash, scope, purpose: "staff", ttlMs: STAFF_LINK_TTL_MS, origin: deps.origin, locale: lang(row.language) });
}

/** Action replays: the key alone says "seen", the key with the payload hash says "same request". */
async function replayOf(deps: StaffDeps, caseId: string, meta: { idempotencyKey: string; payloadHash: string }): Promise<boolean> {
  const seen = await deps.ledger.has(`staff:${caseId}:${meta.idempotencyKey}`);
  if (!seen) return false;
  if (!(await deps.ledger.has(`staff:${caseId}:${meta.idempotencyKey}:${meta.payloadHash}`))) throw new ServiceError("idempotency_conflict", 409);
  return true;
}
async function remember(deps: StaffDeps, caseId: string, meta: { idempotencyKey: string; payloadHash: string }, kind?: string) {
  // The mail a "remind" sent, so that its replay reports it.
  if (kind) await deps.ledger.add(`staff:${caseId}:${meta.idempotencyKey}:kind:${kind}`);
  await deps.ledger.add(`staff:${caseId}:${meta.idempotencyKey}:${meta.payloadHash}`);
  await deps.ledger.add(`staff:${caseId}:${meta.idempotencyKey}`);
}

// ---- create ------------------------------------------------------------------------------------------

export interface CreateReturnInput {
  clientRef?: unknown;
  spouseRef?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  language?: unknown;
  canton?: unknown;
  taxYear?: unknown;
  prefill?: unknown;
  sendInvitation?: unknown;
}

/**
 * Find-or-create a return for (clientRef, taxYear), then (e-mail, taxYear): an existing return
 * (e.g. created by the campaign) is adopted and gets the clientRef; otherwise the invited return
 * is created on the campaign's path with a case id derived from the Idempotency-Key, and the
 * invitation is sent if asked. A replay finds its return again (row's creation key, or the case id).
 */
export async function createReturn(
  input: CreateReturnInput,
  meta: { idempotencyKey: string },
  deps: StaffDeps,
): Promise<{ summary: ReturnSummary; link: LinkResult; replayed: boolean; adopted: boolean; created: boolean }> {
  const now = deps.now();
  const clientRef = optionalRef(input.clientRef, "client_ref");
  if (!clientRef) throw new ServiceError("invalid_client_ref", 400);
  const spouseRef = optionalRef(input.spouseRef, "spouse_ref");
  const firstName = str(input.firstName).slice(0, 80);
  const lastName = str(input.lastName).slice(0, 80);
  if (!firstName || !lastName) throw new ServiceError("invalid_name", 400);
  const email = str(input.email);
  if (!EMAIL_RE.test(email)) throw new ServiceError("invalid_email", 400);
  const taxYear = validYear(input.taxYear, now);
  const language = lang(str(input.language));
  const canton = str(input.canton).toUpperCase();
  if (canton && !/^[A-Z]{2}$/.test(canton)) throw new ServiceError("invalid_canton", 400);
  const prefill = input.prefill && typeof input.prefill === "object" ? (input.prefill as { answers?: unknown; notes?: unknown }) : null;
  if (input.prefill !== undefined && input.prefill !== null && (!prefill || (prefill.answers !== undefined && (typeof prefill.answers !== "object" || Array.isArray(prefill.answers))))) throw new ServiceError("invalid_prefill", 400);
  const prefillAnswers = prefill?.answers as Record<string, unknown> | undefined;
  const notes = Array.isArray(prefill?.notes) ? (prefill.notes as unknown[]).filter((n): n is string => typeof n === "string") : [];
  const send = input.sendInvitation === true;
  const tracker = deps.campaign.tracker;

  return locked(`create:${meta.idempotencyKey}`, async () => {
    const caseId = caseIdFor(meta.idempotencyKey);
    const finish = async (row: ReturnRecord, flags: { replayed: boolean; adopted: boolean; created: boolean }) => {
      let current = row;
      // A return created without its invitation (mail failure, or not asked before) is invited now.
      if (send && current.state === "invited" && !current.invitedAt) {
        const member = { clientKey: current.clientKey, email: current.email, name: current.name, language: lang(current.language), prefs: null };
        current = (await inviteMember(deps.campaign, member, current.taxYear, { now, origin: deps.origin, existing: current })).record;
      }
      current = await reread(current);
      return { summary: summarize(current), link: await staffLink(current, deps), ...flags };
    };

    // Replay: the creation key on a row, or the derived case id (row written, key not yet).
    const byKey = (await tracker.findByCase(caseId)).find((r) => r.taxYear === taxYear && r.state !== "declined");
    if (byKey) return finish(byKey, { replayed: true, adopted: false, created: false });

    const yearRows = (await tracker.listByYear(taxYear)).filter((r) => r.state !== "declined");
    const hash = (deps.campaign.hashEmail || emailHash)(email);
    const existing =
      yearRows.find((r) => !isPlanned(r) && (r.clientRef === clientRef || r.spouseRef === clientRef)) ||
      (await tracker.findByEmailHash(hash)).find((r) => !isPlanned(r) && r.taxYear === taxYear && r.state !== "declined" && normalise(r.email) === normalise(email));
    if (existing) {
      // Adopted, never "return_exists": Cadence now knows this return; the site knows Cadence's client.
      let adopted = existing;
      if (existing.clientRef && existing.clientRef !== clientRef) {
        // Found by a shared address, already Cadence's for another client: the same return only
        // when the two are a couple (one return per married couple), as either side says.
        // Otherwise it is another person's return: refused, Cadence attaches by hand.
        const couple = existing.spouseRef === clientRef || (!existing.spouseRef && spouseRef === existing.clientRef);
        if (!couple) throw new ServiceError("client_ref_conflict", 409);
        if (!existing.spouseRef) {
          adopted = { ...existing, spouseRef: clientRef };
          await tracker.upsert(adopted);
        }
      } else if (existing.clientRef !== clientRef || (spouseRef && existing.spouseRef !== spouseRef)) {
        adopted = { ...existing, clientRef, ...(spouseRef ? { spouseRef } : {}) };
        await tracker.upsert(adopted);
      }
      return finish(adopted, { replayed: false, adopted: true, created: false });
    }

    const key = computeClientKey(email, lastName, firstName);
    const prefs = await deps.campaign.prefs.get(key);
    if (prefs?.excluded) throw new ServiceError("client_excluded", 409);
    const planned = plannedFor(yearRows.filter(isPlanned), { clientKey: key, email, name: personName(lastName, firstName) });
    if (planned?.excludedFromCampaign) throw new ServiceError("client_excluded", 409);
    const previous = prefillAnswers ? undefined : previousReturn((await tracker.findByClientKey(key)).filter((r) => !isPlanned(r)), taxYear);
    const member = { clientKey: key, email, name: personName(lastName, firstName), language, prefs };
    const create = { caseId, clientRef, spouseRef, createKey: meta.idempotencyKey, canton: canton || undefined };
    let record: ReturnRecord;
    if (send) {
      record = (await inviteMember(deps.campaign, member, taxYear, { now, origin: deps.origin, previous, planned, prefillAnswers, notes, create })).record;
    } else {
      // Not sent: the return waits uninvited; "remind" (or a later create with sendInvitation) sends the invitation.
      record = await deps.campaign.createInvitedReturn({ ...member, taxYear, prefillFrom: previous, prefillAnswers, notes, planned, ...create });
    }
    return finish(record, { replayed: false, adopted: false, created: true });
  });
}

// ---- feed --------------------------------------------------------------------------------------------

export const feedKey = (r: ReturnRecord) => `${r.modifiedAt || ""}|${r.caseId}|${r.taxYear}`;

/**
 * Change feed: one item per (caseId, year), ordered by the row's SharePoint "Modified" date; only
 * rows quiet for 10 s; cursor inclusive (>=), so the last item comes back once more and Cadence
 * applies items idempotently. Rows without a case (staff inventory) are not served.
 */
export async function changes(cursor: string, limit: number, deps: Pick<StaffDeps, "campaign" | "now">) {
  const since = cursor.split("|")[0] || "";
  const quietBefore = new Date(deps.now().getTime() - FEED_QUIET_MS).toISOString();
  const rows = (await deps.campaign.tracker.listChanged(since)).filter((r) => r.caseId && r.modifiedAt && r.modifiedAt <= quietBefore && (!cursor || feedKey(r) >= cursor));
  rows.sort((a, b) => (feedKey(a) < feedKey(b) ? -1 : feedKey(a) > feedKey(b) ? 1 : 0));
  // At least two per page: with an inclusive cursor a page of one could never move on.
  const page = rows.slice(0, Math.max(2, Math.min(Number.isFinite(limit) ? limit : 50, 200)));
  return { items: page.map(summarize), nextCursor: page.length ? feedKey(page[page.length - 1]) : cursor, more: rows.length > page.length };
}

// ---- one return --------------------------------------------------------------------------------------

export type StaffDocStatus = "received" | "office" | "later" | "na" | "missing";

export async function staffReturn(caseId: string, year: unknown, deps: Pick<StaffDeps, "storage">) {
  const rows = await caseRows(caseId);
  const row = yearRow(rows, year);
  forgetCase(caseId);
  const info = await getCase(caseId);
  const { docs, answers } = await caseDocuments(deps.storage, info, row.taxYear);
  const language = lang(row.language);
  const documents = docs.map((d) => ({
    key: d.item.key,
    code: d.item.code,
    label: d.item.label[language] || d.item.label.fr,
    status: (d.status === "uploaded" ? "received" : d.status) as StaffDocStatus,
    ...(d.files[0]?.webUrl ? { fileUrl: d.files[0].webUrl } : {}),
  }));
  return { ...summarize(row), documents, answers };
}

// ---- actions -----------------------------------------------------------------------------------------

export const STAFF_ACTIONS = ["link", "remind", "exclude", "include", "deadline", "staffDocs", "officeDocs", "attach"] as const;
export type StaffAction = (typeof STAFF_ACTIONS)[number];

export interface ActionBody {
  taxYear?: unknown;
  email?: unknown;
  send?: unknown;
  /** `link`: "email" when Cadence e-mails the new link itself (a replaced link then says so). */
  notify?: unknown;
  extendedTo?: unknown;
  staffDocs?: unknown;
  /** `officeDocs`: the document keys the office holds for that year (the whole list, replaced). */
  officeDocs?: unknown;
  clientRef?: unknown;
}

export type ActionResult = { summary: ReturnSummary; link?: LinkResult; replayed: boolean; extra?: Record<string, unknown> };

export async function staffAction(caseId: string, action: StaffAction, body: ActionBody, meta: { idempotencyKey: string; payloadHash: string }, deps: StaffDeps): Promise<ActionResult> {
  return locked(`case:${caseId}`, async () => {
    const rows = await caseRows(caseId);
    if (action === "link") return linkAction(rows, body, meta, deps);
    if (action === "remind") return remindAction(yearRow(rows, requireYear(body)), meta, deps);
    const tracker = deps.campaign.tracker;
    if (action === "attach") {
      const clientRef = optionalRef(body.clientRef, "client_ref");
      if (!clientRef) throw new ServiceError("invalid_client_ref", 400);
      // Every year of the case: next year's return (campaign renewal) carries it over.
      for (const r of rows) if (r.clientRef !== clientRef) await tracker.upsert({ ...r, clientRef });
      return { summary: summarize(await reread(yearRow(rows, body.taxYear))), replayed: false };
    }
    const row = yearRow(rows, requireYear(body));
    if (!row.trackerId) throw new ServiceError("not_found", 404);
    if (action === "exclude" || action === "include") {
      await tracker.setStaffFields(row.trackerId, { excludedFromCampaign: action === "exclude" });
    } else if (action === "deadline") {
      const extendedTo = body.extendedTo === null ? "" : str(body.extendedTo);
      if (extendedTo && (!DATE_RE.test(extendedTo) || Number.isNaN(Date.parse(`${extendedTo}T12:00:00Z`)))) throw new ServiceError("invalid_extended_to", 400);
      await tracker.setStaffFields(row.trackerId, { extendedTo });
    } else if (action === "staffDocs") {
      if (!Array.isArray(body.staffDocs) || body.staffDocs.some((d) => typeof d !== "string")) throw new ServiceError("invalid_staff_docs", 400);
      const docs = [...new Set((body.staffDocs as string[]).map((d) => d.replace(/\s+/g, " ").trim().slice(0, 200)).filter(Boolean))].slice(0, 30);
      await tracker.setStaffFields(row.trackerId, { staffDocs: docs.join("\n") });
    } else if (action === "officeDocs") {
      const raw = body.officeDocs;
      if (!Array.isArray(raw) || raw.length > 100 || raw.some((k) => typeof k !== "string" || !k.trim() || k.length > 120)) throw new ServiceError("invalid_office_docs", 400);
      // Idempotent by nature (the whole list); a submitted return's missing list, counts and status follow.
      forgetCase(caseId);
      const info = await getCase(caseId);
      await setOfficeDocs(deps.storage, info, row.taxYear, [...new Set((raw as string[]).map((k) => k.trim()))]);
      if (row.state === "submitted") await refreshMissing(deps.storage, info);
      forgetCase(caseId);
    }
    return { summary: summarize(await reread(row)), replayed: false };
  });
}

function requireYear(body: ActionBody): number {
  const year = Number(body.taxYear);
  if (!Number.isInteger(year)) throw new ServiceError("invalid_tax_year", 400);
  return year;
}

/**
 * New client link (per case, no year): revokes the earlier staff links only; a new e-mail
 * address revokes every link and session of the case. `send` mails the link from the site.
 * A replay revokes and sends nothing: it issues one more staff link.
 */
async function linkAction(rows: ReturnRecord[], body: ActionBody, meta: { idempotencyKey: string; payloadHash: string }, deps: StaffDeps): Promise<ActionResult> {
  const caseId = rows[0].caseId;
  if (await replayOf(deps, caseId, meta)) return { summary: summarize(rows[0]), link: await staffLink(rows[0], deps), replayed: true };
  const access = sharePointPorts().access;
  const email = str(body.email);
  let main = rows[0];
  // The holder of a replaced link is told whether the new one went by e-mail (from here or Cadence).
  const replaced = { at: Date.now(), via: body.send === true || body.notify === "email" ? ("email" as const) : ("other" as const) };
  // Any year still on another address (a half-done change included) means the change is due.
  if (email && rows.some((r) => normalise(r.email) !== normalise(email))) {
    if (!EMAIL_RE.test(email)) throw new ServiceError("invalid_email", 400);
    const hash = (deps.campaign.hashEmail || emailHash)(email);
    // Revoked first: once every row has the new address, the old links are already gone.
    await access.revokeCase(caseId, undefined, undefined, replaced);
    // The client key stays: it names the client (preferences, campaign), not the address.
    for (const r of rows) if (normalise(r.email) !== normalise(email) || r.emailHash !== hash) await deps.campaign.tracker.upsert({ ...r, email, emailHash: hash });
    main = await reread(main);
  } else {
    await access.revokeCase(caseId, "link", "staff", replaced);
  }
  const link = await staffLink(main, deps);
  if (body.send === true) {
    const purpose = main.state === "submitted" ? "status" : "resume";
    await deps.campaign.sendMail(linkMail(lang(main.language), main.email, link.url, purpose, Math.round(STAFF_LINK_TTL_MS / DAY), "", main.name));
  }
  await remember(deps, caseId, meta);
  return { summary: summarize(main), link, replayed: false };
}

/**
 * "Relancer": the mail follows the state — the invitation if never invited, the missing
 * documents once submitted, the campaign reminder once invited (same counters as the campaign).
 * The campaign's rules hold: never two mails within three days (too_soon + nextAt), nothing for
 * an excluded client (excluded) or a closed return (closed), no reminder for a return the client
 * started without an invitation (nothing_to_send: the campaign only reminds invited returns).
 * Every refusal is { sent: false, kind, reason }.
 */
async function remindAction(row: ReturnRecord, meta: { idempotencyKey: string; payloadHash: string }, deps: StaffDeps): Promise<ActionResult> {
  const now = deps.now();
  const KINDS = ["invitation", "missing", "reminder"] as const;
  if (await replayOf(deps, row.caseId, meta)) {
    let kind: string | undefined;
    for (const k of KINDS) if (await deps.ledger.has(`staff:${row.caseId}:${meta.idempotencyKey}:kind:${k}`)) kind = k;
    return { summary: summarize(row), replayed: true, extra: { sent: true, ...(kind ? { kind } : {}) } };
  }
  const kind = row.state === "submitted" ? "missing" : row.invitedAt ? "reminder" : row.state === "invited" ? "invitation" : null;
  const refuse = (reason: string, more: Record<string, unknown> = {}) => ({ summary: summarize(row), replayed: false, extra: { sent: false, kind, reason, ...more } });
  if (kind === "missing" ? !!row.staffStatus && MISSING_STOP_STATUSES.includes(row.staffStatus) : isClosed(row)) return refuse("closed");
  const prefs = row.clientKey ? await deps.campaign.prefs.get(row.clientKey) : null;
  const clientRows = row.clientKey ? await deps.campaign.tracker.findByClientKey(row.clientKey) : [];
  if (prefs?.excluded || row.excludedFromCampaign || clientRows.some((r) => r.excludedFromCampaign)) return refuse("excluded");
  if (!kind) return refuse("nothing_to_send");
  const member = { clientKey: row.clientKey, email: row.email, name: row.name, language: lang(row.language), prefs };
  if (kind === "invitation") {
    await inviteMember(deps.campaign, member, row.taxYear, { now, origin: deps.origin, existing: row });
  } else if (kind === "missing") {
    const nextAt = nextMailAt(row.lastMissingReminderAt || row.submittedAt, now);
    if (nextAt) return refuse("too_soon", { nextAt });
    const missing = deps.campaign.refreshMissing ? await deps.campaign.refreshMissing(row) : lines(row.missingDocs);
    if (!missing.length) return refuse("nothing_missing");
    await sendMissingReminder(deps.campaign, await reread(row), missing, { now, origin: deps.origin });
  } else {
    const nextAt = nextMailAt(row.lastReminderAt || row.invitedAt, now);
    if (nextAt) return refuse("too_soon", { nextAt });
    await sendReminder(deps.campaign, row, member, { now, origin: deps.origin });
  }
  await remember(deps, row.caseId, meta, kind);
  return { summary: summarize(await reread(row)), replayed: false, extra: { sent: true, kind } };
}
