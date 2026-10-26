import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { emailHash, issueLink } from "@/src/lib/tax-questionnaire/server/access";
import { inviteMember, isClosed, lang, previousReturn, runCampaign, type CampaignDeps, type CampaignLedger } from "@/src/lib/tax-questionnaire/server/campaign";
import { clientKey as computeClientKey, cleanupAbandonedDrafts, createInvitedReturn } from "@/src/lib/tax-questionnaire/server/service";
import { sharePointPorts } from "@/src/lib/tax-questionnaire/server/sharepoint-registry";
import { DEFAULT_DRIVE_ID, getStorage, type TaxStorage } from "@/src/lib/tax-questionnaire/server/storage";

/**
 * Daily jobs of tax.ark-fid.ch, called by .github/workflows/tax-qf-cron.yml:
 *   POST { task: "campaign" | "cleanup", dryRun?, idempotencyKey }  header x-tax-qf-cron: <secret>
 *   POST { task: "invite", clientKey | prefillRef, taxYear, email?, noEmail?, resultRef?, dryRun?, idempotencyKey }:
 *   one invitation (staff, scripts/tax-qf-invite.mjs), through the same path as the February
 *   campaign. prefillRef: a case prepared by Ark from _system/staff-prefill/<ref>.json (identity,
 *   answers, staff notes); noEmail: the link is written to _system/staff-prefill/<resultRef>.result.json
 *   for staff to hand over (never returned in the HTTP response or logs).
 * A processed idempotency key is recorded in SharePoint (_system/cron-ledger) and never re-run.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const env = (name: string) => (process.env[name] || "").trim();
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

function authorized(request: Request): boolean {
  const secret = env("TAX_QF_CRON_SECRET");
  if (secret.length < 32) return false; // fail closed
  const given = Buffer.from(request.headers.get("x-tax-qf-cron") || "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Durable ledger: one small JSON file per processed key in the library's _system folder. */
function fileLedger(storage: TaxStorage): CampaignLedger {
  const drive = env("TAX_QF_SP_DRIVE_ID") || DEFAULT_DRIVE_ID;
  let folder = "";
  const folderId = async () => {
    if (!folder) {
      const system = await storage.ensureSubfolder(drive, "root", "_system");
      folder = await storage.ensureSubfolder(drive, system, "cron-ledger");
    }
    return folder;
  };
  const fileName = (key: string) => `${createHash("sha256").update(key).digest("hex").slice(0, 40)}.json`;
  return {
    async has(key) {
      return (await storage.readFile(drive, await folderId(), fileName(key))) !== null;
    },
    async add(key) {
      const body = new TextEncoder().encode(JSON.stringify({ key, at: new Date().toISOString() }));
      await storage.putFile(drive, await folderId(), fileName(key), body, "application/json");
    },
  };
}

export async function POST(request: Request) {
  if (!authorized(request)) return json({ error: "forbidden" }, 403);
  let body: InviteBody & { task?: unknown; dryRun?: unknown; idempotencyKey?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const task = body.task;
  const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 120) : "";
  if ((task !== "campaign" && task !== "cleanup" && task !== "invite") || !/^[\w:.-]{6,120}$/.test(key)) return json({ error: "invalid_request" }, 400);
  const dryRun = body.dryRun === true;

  try {
    const storage = getStorage();
    const ledger = fileLedger(storage);
    const ledgerKey = `${task}:${key}`;
    if (!dryRun && (await ledger.has(ledgerKey))) return json({ ok: true, task, skipped: "already_processed" });

    const ports = sharePointPorts();
    if (task === "cleanup") {
      if (env("TAX_QF_CLEANUP_ENABLED") !== "1") return json({ ok: true, task, skipped: "disabled" });
      const result = dryRun ? { deleted: 0 } : await cleanupAbandonedDrafts();
      if (!dryRun) await ledger.add(ledgerKey);
      return json({ ok: true, task, ...result });
    }

    const deps: CampaignDeps = {
      registry: ports.registry,
      tracker: ports.tracker,
      prefs: ports.prefs,
      sendMail: (message) => storage.sendMail(message),
      issueLink,
      hashEmail: emailHash,
      createInvitedReturn,
      staffRecipients: (env("TAX_QF_STAFF_ALERT_TO") || "samuel.halff@ark-fid.ch,sebastien.gallie@ark-fid.ch").split(",").map((v) => v.trim()).filter(Boolean),
      ledger,
    };
    if (task === "invite") {
      const result = await invite(deps, storage, body, dryRun);
      if (!dryRun && result.ok) await ledger.add(ledgerKey);
      return json({ task, ...result }, result.ok ? 200 : 409);
    }
    const summary = await runCampaign(deps, { now: new Date(), dryRun, origin: env("TAX_QF_PUBLIC_ORIGIN") || "https://tax.ark-fid.ch" });
    if (!dryRun) await ledger.add(ledgerKey);
    return json({ ok: true, task, ...summary });
  } catch (error) {
    // Codes only: never client data.
    console.error("[tax-qf] cron failed", task, error instanceof Error ? error.message.slice(0, 120) : "");
    return json({ error: "cron_failed" }, 502);
  }
}

const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,}$/i;

interface InviteBody {
  clientKey?: unknown;
  taxYear?: unknown;
  email?: unknown;
  noEmail?: unknown;
  prefillRef?: unknown;
  resultRef?: unknown;
}

interface Prefill {
  identity?: { email?: unknown; firstName?: unknown; lastName?: unknown };
  language?: unknown;
  answers?: Record<string, unknown>;
  notes?: unknown;
  consumed?: boolean;
}

const REF_RE = /^[a-z0-9-]{6,60}$/;
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

async function staffFolder(storage: TaxStorage) {
  const drive = env("TAX_QF_SP_DRIVE_ID") || DEFAULT_DRIVE_ID;
  const system = await storage.ensureSubfolder(drive, "root", "_system");
  return { drive, folder: await storage.ensureSubfolder(drive, system, "staff-prefill") };
}

/**
 * Manual invitation: the client is identified by its clientKey (preferences, CRM registry or a
 * previous return) or by a staff pre-fill file (prepared case); "email" overrides the address
 * (the case e-mail, where the codes are sent).
 */
async function invite(deps: CampaignDeps, storage: TaxStorage, body: InviteBody, dryRun: boolean) {
  const taxYear = Number(body.taxYear);
  const now = new Date();
  if (!Number.isInteger(taxYear) || taxYear < now.getUTCFullYear() - 6 || taxYear >= now.getUTCFullYear()) return { ok: false, error: "invalid_request" };
  const noEmail = body.noEmail === true;
  const prefillRef = text(body.prefillRef);
  const resultRef = text(body.resultRef) || prefillRef;
  if ((prefillRef && !REF_RE.test(prefillRef)) || (noEmail && !REF_RE.test(resultRef))) return { ok: false, error: "invalid_request" };
  const override = text(body.email);
  if (override && !EMAIL_RE.test(override)) return { ok: false, error: "invalid_email" };

  let prefill: Prefill | null = null;
  let clientKey = typeof body.clientKey === "string" && /^[a-f0-9]{16,64}$/.test(body.clientKey) ? body.clientKey : "";
  let email = override;
  let name = "";
  let language = "";
  const staff = prefillRef || noEmail ? await staffFolder(storage) : null;
  if (prefillRef && staff) {
    const raw = await storage.readFile(staff.drive, staff.folder, `${prefillRef}.json`);
    if (!raw) return { ok: false, error: "prefill_not_found" };
    try {
      prefill = JSON.parse(new TextDecoder().decode(raw)) as Prefill;
    } catch {
      return { ok: false, error: "prefill_invalid" };
    }
    if (prefill.consumed) return { ok: false, error: "prefill_consumed" };
    const firstName = text(prefill.identity?.firstName);
    const lastName = text(prefill.identity?.lastName);
    email = email || text(prefill.identity?.email);
    if (!firstName || !lastName || !EMAIL_RE.test(email) || !prefill.answers || typeof prefill.answers !== "object") return { ok: false, error: "prefill_invalid" };
    clientKey = computeClientKey(email, lastName, firstName);
    name = `${lastName.toUpperCase()} ${firstName}`;
    language = text(prefill.language);
  }
  if (!clientKey) return { ok: false, error: "invalid_request" };

  const returns = await deps.tracker.findByClientKey(clientKey);
  const previous = previousReturn(returns, taxYear);
  const current = returns.find((r) => r.taxYear === taxYear && r.state !== "declined");
  if (current && (isClosed(current) || current.invitedAt || current.state !== "invited")) return { ok: false, error: "return_exists", state: current.state };
  const prefs = await deps.prefs.get(clientKey);
  if (prefs?.excluded) return { ok: false, error: "client_excluded" };
  email = email || prefs?.email || previous?.email || "";
  name = name || prefs?.name || previous?.name || "";
  if (!email || !name) return { ok: false, error: "client_not_found" };
  const member = { clientKey, email, name, language: lang(language || prefs?.language || previous?.language), prefs };
  if (dryRun) return { ok: true, dryRun: true, prepared: !!prefill, renewalFrom: prefill ? null : previous?.taxYear || null };

  const notes = Array.isArray(prefill?.notes) ? (prefill.notes as unknown[]).filter((n): n is string => typeof n === "string") : [];
  const { record } = await inviteMember(deps, member, taxYear, {
    now,
    origin: env("TAX_QF_PUBLIC_ORIGIN") || "https://tax.ark-fid.ch",
    previous,
    existing: current,
    send: !noEmail,
    prefillAnswers: prefill?.answers,
    notes,
    ttlMs: noEmail ? 30 * 24 * 60 * 60 * 1000 : undefined,
    // Before the return is marked invited, so a failed write can simply be retried.
    beforeMark: async (created, handOver) => {
      if (staff && noEmail) {
        await storage.putFile(staff.drive, staff.folder, `${resultRef}.result.json`, new TextEncoder().encode(JSON.stringify({ caseId: created.caseId, link: handOver, expires: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() })), "application/json");
      }
      if (staff && prefillRef) {
        // The pre-fill is now in the case: the staff file keeps no client data.
        await storage.putFile(staff.drive, staff.folder, `${prefillRef}.json`, new TextEncoder().encode(JSON.stringify({ consumed: true, caseId: created.caseId, at: now.toISOString() })), "application/json");
      }
    },
  });
  return { ok: true, caseId: record.caseId, prepared: !!prefill, emailed: !noEmail, renewalFrom: prefill ? null : previous?.taxYear || null };
}
