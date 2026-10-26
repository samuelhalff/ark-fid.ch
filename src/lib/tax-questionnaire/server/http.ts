import { NextResponse } from "next/server";
import { readCookie, readSession, type SessionInfo } from "./access";
import { ServiceError } from "./service";
import { StorageError } from "./storage";

/** Shared HTTP plumbing of the /api/tax-questionnaire/* routes. No request content is logged. */

const env = (name: string) => (process.env[name] || "").trim();
export const isProd = () => process.env.NODE_ENV === "production";

export const json = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex", ...headers } });

export const clientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Rightmost entry is appended by our own front proxy (same as the LBA and agent routes).
    const parts = forwarded.split(",");
    return parts[parts.length - 1]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
};

export const ALLOWED_ORIGINS = ["https://ark-fid.ch", "https://tax.ark-fid.ch"];

/** Exact origin match in production (scheme + host + port); local origins in development. */
export function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!isProd()) return !origin || /^https?:\/\/(localhost|127\.0\.0\.1|tax\.localhost)(:\d+)?$/.test(origin) || ALLOWED_ORIGINS.includes(origin);
  // Browsers often omit Origin on same-origin GETs; safe methods carry no state change.
  if (!origin) return request.method === "GET" || request.method === "HEAD";
  const extra = env("TAX_QF_ALLOWED_ORIGINS").split(",").map((v) => v.trim()).filter(Boolean);
  return [...ALLOWED_ORIGINS, ...extra].includes(origin);
}

export type Counter = { count: number; resetAt: number };

/** Fixed-window counter (per process; the site runs as a single Node instance). */
export function hit(store: Map<string, Counter>, key: string, max: number, windowMs: number, now = Date.now()) {
  if (store.size > 5000) for (const [k, entry] of store) if (entry.resetAt <= now) store.delete(k);
  const entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: windowMs };
  }
  if (entry.count >= max) return { allowed: false, retryAfterMs: entry.resetAt - now };
  entry.count += 1;
  return { allowed: true, retryAfterMs: entry.resetAt - now };
}

export function rateLimited(store: Map<string, Counter>, key: string, max: number, windowMs: number) {
  const result = hit(store, key, max, windowMs);
  return result.allowed ? null : json({ error: "rate_limited" }, 429, { "Retry-After": `${Math.ceil(result.retryAfterMs / 1000)}` });
}

/** Reads a JSON body with a hard size cap (before parsing). */
export async function readJson(request: Request, maxBytes: number): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  if (Number(request.headers.get("content-length") || 0) > maxBytes) return { ok: false, response: json({ error: "payload_too_large" }, 413) };
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, response: json({ error: "invalid_request" }, 400) };
  }
  if (raw.length > maxBytes) return { ok: false, response: json({ error: "payload_too_large" }, 413) };
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
    return { ok: true, body };
  } catch {
    return { ok: false, response: json({ error: "invalid_request" }, 400) };
  }
}

const isUsableSecret = (secret: string | undefined): secret is string => !!secret && secret.length >= 32;

/** Dedicated secret; fails closed when missing or too short. */
export function tokenSecret(): string | null {
  const secret = env("TAX_QF_TOKEN_SECRET");
  return isUsableSecret(secret) ? secret : null;
}

/** Maps service and storage errors to responses (codes only, never content). */
export function errorResponse(error: unknown, route: string): NextResponse {
  if (error instanceof ServiceError) {
    return json({ error: error.code, ...(error.detail && typeof error.detail === "object" ? (error.detail as Record<string, unknown>) : {}) }, error.status);
  }
  console.error(`[tax-qf] ${route} failed`, error instanceof StorageError ? `${error.message}` : error instanceof Error ? error.name : "");
  return json({ error: "storage_unavailable" }, 502);
}

/**
 * Session check for authenticated routes (cookie + CSRF header + origin). Returns the session or
 * an error response. IMPLEMENTATION IN PROGRESS — signature stable.
 */
export async function requireSession(request: Request, scope: "edit" | "status" | "any" = "edit"): Promise<{ caseId: string; emailHash: string; scope: "edit" | "status" } | NextResponse> {
  // CSRF: every authenticated call is same-origin and carries a custom header (forces a preflight
  // for any cross-site attempt); SameSite=Lax cookies alone are not relied upon.
  if (!originAllowed(request)) return json({ error: "forbidden" }, 403);
  if (request.method !== "GET" && request.headers.get("x-tqf") !== "1") return json({ error: "forbidden" }, 403);
  if (!tokenSecret()) {
    console.error("[tax-qf] TAX_QF_TOKEN_SECRET missing or too short");
    return json({ error: "missing_configuration" }, 500);
  }
  let session: SessionInfo | null = null;
  try {
    session = await readSession(readCookie(request));
  } catch (error) {
    return errorResponse(error, "session");
  }
  if (!session) return json({ error: "session_expired" }, 401);
  if (scope !== "any" && session.scope !== scope) return json({ error: "forbidden_scope" }, 403);
  return session;
}

export const skipTurnstile =() => !isProd() && env("TAX_QF_SKIP_TURNSTILE") === "1";

export async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = env("TURNSTILE_SECRET_KEY");
  if (!secret || !token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") body.append("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(6_500),
    });
    if (!res.ok) return false;
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}
