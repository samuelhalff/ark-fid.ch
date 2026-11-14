import type { NextResponse } from "next/server";
import { verifyStaffRequest } from "../../kyc-questionnaire/server/signature";
import { clientIp, errorResponse, hit, json, tokenSecret, type Counter } from "./http";
import { fileLedger } from "./ledger";
import { appCampaignDeps, taxApiKeys, type StaffDeps } from "./staff";
import { getStorage } from "./storage";

/**
 * Signed server-to-server routes for Cadence (/api/tax-questionnaire/staff/*): the KYC signature
 * (x-kyc-* headers, five-minute window, single-use nonce, Idempotency-Key on POST) checked against
 * TAX_QF_API_KEYS only. No request content is logged.
 */
export type StaffContext = { keyId: string; body: Record<string, unknown>; idempotencyKey: string; payloadHash: string; deps: StaffDeps };

const counters = new Map<string, Counter>();
const env = (name: string) => (process.env[name] || "").trim();

export function staffDeps(): StaffDeps {
  const storage = getStorage();
  const ledger = fileLedger(storage);
  return { campaign: appCampaignDeps(storage, ledger), storage, ledger, origin: env("TAX_QF_PUBLIC_ORIGIN") || "https://tax.ark-fid.ch", now: () => new Date() };
}

export async function staffRoute(request: Request, handler: (ctx: StaffContext) => Promise<NextResponse>): Promise<NextResponse> {
  if (!tokenSecret()) return json({ error: "missing_configuration" }, 500);
  const limit = hit(counters, request.headers.get("x-kyc-key-id") || clientIp(request), 600, 10 * 60 * 1000);
  if (!limit.allowed) return json({ error: "rate_limited" }, 429, { "Retry-After": `${Math.ceil(limit.retryAfterMs / 1000)}` });
  const verified = await verifyStaffRequest(request, taxApiKeys());
  if (!verified.ok) return json({ error: verified.error, ...(verified.reason ? { reason: verified.reason } : {}) }, verified.status);
  try {
    return await handler({ keyId: verified.keyId, body: verified.body, idempotencyKey: verified.idempotencyKey, payloadHash: verified.payloadHash, deps: staffDeps() });
  } catch (error) {
    return errorResponse(error, "staff");
  }
}
