import { NextResponse } from "next/server";
import { clientIp, hit, json, readJson, type Counter } from "../../tax-questionnaire/server/http";
import { StorageError } from "../../tax-questionnaire/server/storage";
import { readCookie, readSession } from "./access";
import { ALLOWED_ORIGINS, extraOrigins, isProd, tokenSecret } from "./config";
import { KycError, type Session } from "./service";
import { verifyStaffRequest } from "./signature";

/** HTTP plumbing of /api/kyc-questionnaire/*. No request content is logged. */

export { json };

export function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!isProd()) return !origin || /^https?:\/\/(localhost|127\.0\.0\.1|kyc\.localhost)(:\d+)?$/.test(origin) || ALLOWED_ORIGINS.includes(origin);
  if (!origin) return request.method === "GET" || request.method === "HEAD";
  return [...ALLOWED_ORIGINS, ...extraOrigins()].includes(origin);
}

export function errorResponse(error: unknown, route: string): NextResponse {
  if (error instanceof KycError) return json({ error: error.code, ...(error.detail || {}) }, error.status);
  console.error(`[kyc-qf] ${route} failed`, error instanceof StorageError ? error.message : error instanceof Error ? error.name : "");
  return json({ error: "storage_unavailable" }, 502);
}

const stores = new Map<string, Map<string, Counter>>();
const store = (name: string) => {
  let s = stores.get(name);
  if (!s) stores.set(name, (s = new Map()));
  return s;
};

export function limited(name: string, key: string, max: number, windowMs = 10 * 60 * 1000) {
  const result = hit(store(name), key, max, windowMs);
  return result.allowed ? null : json({ error: "rate_limited" }, 429, { "Retry-After": `${Math.ceil(result.retryAfterMs / 1000)}` });
}

/**
 * Browser routes: origin check, per-IP limit, JSON body cap, and (unless public) the session
 * cookie plus the custom header that forces a CORS preflight for any cross-site attempt.
 */
export async function clientRoute(
  request: Request,
  options: { name: string; perIp: number; maxBytes?: number; session: boolean },
  handler: (ctx: { body: Record<string, unknown>; ip: string; session: Session | null }) => Promise<NextResponse>,
): Promise<NextResponse> {
  if (!originAllowed(request)) return json({ error: "forbidden" }, 403);
  const ip = clientIp(request);
  const tooMany = limited(options.name, ip, options.perIp);
  if (tooMany) return tooMany;
  if (!tokenSecret()) {
    console.error("[kyc-qf] KYC_QF_TOKEN_SECRET missing or too short");
    return json({ error: "missing_configuration" }, 500);
  }
  let body: Record<string, unknown> = {};
  if (request.method !== "GET") {
    if (request.headers.get("x-kqf") !== "1") return json({ error: "forbidden" }, 403);
    const parsed = await readJson(request, options.maxBytes || 32 * 1024);
    if (!parsed.ok) return parsed.response;
    body = parsed.body;
  }
  try {
    let session: Session | null = null;
    if (options.session) {
      session = await readSession(readCookie(request));
      if (!session) return json({ error: "session_expired" }, 401);
      const perSession = limited(`${options.name}:session`, session.caseId, options.perIp * 2);
      if (perSession) return perSession;
    }
    return await handler({ body, ip, session });
  } catch (error) {
    return errorResponse(error, options.name);
  }
}

// ---- Cadence (server to server) ----------------------------------------------------------------

export { signRequest } from "./signature";

export type StaffContext = { keyId: string; body: Record<string, unknown>; idempotencyKey: string; payloadHash: string };

export async function staffRoute(request: Request, handler: (ctx: StaffContext) => Promise<NextResponse>): Promise<NextResponse> {
  if (!tokenSecret()) return json({ error: "missing_configuration" }, 500);
  const tooMany = limited("staff", request.headers.get("x-kyc-key-id") || clientIp(request), 600);
  if (tooMany) return tooMany;
  const verified = await verifyStaffRequest(request);
  if (!verified.ok) return json({ error: verified.error, ...(verified.reason ? { reason: verified.reason } : {}) }, verified.status);
  try {
    return await handler(verified);
  } catch (error) {
    return errorResponse(error, "staff");
  }
}
