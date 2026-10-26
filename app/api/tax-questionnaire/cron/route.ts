import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { emailHash, issueLink } from "@/src/lib/tax-questionnaire/server/access";
import { runCampaign, type CampaignDeps, type CampaignLedger } from "@/src/lib/tax-questionnaire/server/campaign";
import { cleanupAbandonedDrafts, createInvitedReturn } from "@/src/lib/tax-questionnaire/server/service";
import { sharePointPorts } from "@/src/lib/tax-questionnaire/server/sharepoint-registry";
import { DEFAULT_DRIVE_ID, getStorage, type TaxStorage } from "@/src/lib/tax-questionnaire/server/storage";

/**
 * Daily jobs of tax.ark-fid.ch, called by .github/workflows/tax-qf-cron.yml:
 *   POST { task: "campaign" | "cleanup", dryRun?, idempotencyKey }  header x-tax-qf-cron: <secret>
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
  let body: { task?: unknown; dryRun?: unknown; idempotencyKey?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const task = body.task;
  const key = typeof body.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 120) : "";
  if ((task !== "campaign" && task !== "cleanup") || !/^[\w:.-]{6,120}$/.test(key)) return json({ error: "invalid_request" }, 400);
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
    const summary = await runCampaign(deps, { now: new Date(), dryRun, origin: env("TAX_QF_PUBLIC_ORIGIN") || "https://tax.ark-fid.ch" });
    if (!dryRun) await ledger.add(ledgerKey);
    return json({ ok: true, task, ...summary });
  } catch (error) {
    // Codes only: never client data.
    console.error("[tax-qf] cron failed", task, error instanceof Error ? error.message.slice(0, 120) : "");
    return json({ error: "cron_failed" }, 502);
  }
}
