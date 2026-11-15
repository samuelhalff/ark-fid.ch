import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { AccessRecord, LinkReplacedVia } from "./ports";
import { normalise, sharePointPorts } from "./sharepoint-registry";
import { issueAssistAccess, redeemAssistAccess, STAFF_HASH as SHARED_STAFF_HASH, STAFF_SESSION_TTL_MS } from "../../forms/assist";

/**
 * Access without accounts (DECISIONS §B):
 * - opaque link tokens (32 random bytes) put in the URL fragment (never sent to servers or
 *   analytics), stored only as HMACs with a server key (TAX_QF_TOKEN_SECRET);
 * - 6-digit codes e-mailed for every opening (10 min, single use, 5 attempts), carried in a signed
 *   challenge the server does not need to store (the code's MAC needs the server key);
 * - sessions: random cookie value, HMAC stored with an absolute expiry, revocable.
 */

export type Scope = "edit" | "status";

export interface SessionInfo {
  caseId: string;
  emailHash: string;
  scope: Scope;
  /** Set when Ark staff opened the session with an office access (assist link or « Code cabinet »): who. */
  staffBy?: string;
}

export interface IssueLinkOptions {
  caseId: string;
  emailHash: string;
  scope: Scope;
  /** resume | invitation | partner | status | optout | staff (issued for Cadence) */
  purpose: string;
  ttlMs: number;
  /** Public origin for the link (default https://tax.ark-fid.ch). */
  origin?: string;
  locale?: string;
}

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESUME_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const INVITATION_LINK_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const env = (name: string) => (process.env[name] || "").trim();

function secret(): string {
  const value = env("TAX_QF_TOKEN_SECRET");
  if (value.length < 32) throw new Error("TAX_QF_TOKEN_SECRET missing or too short");
  return value;
}

const mac = (purpose: string, value: string) => createHmac("sha256", secret()).update(`ark-tax-qf|${purpose}|${value}`).digest("base64url");

/** Keyed e-mail fingerprint (lookup in the tracker without storing a plain hash of the address). */
export const emailHash = (email: string) => mac("email", normalise(email)).slice(0, 32);

export const publicOrigin = () => env("TAX_QF_PUBLIC_ORIGIN") || "https://tax.ark-fid.ch";

export function linkUrl(token: string, locale = "fr", origin = publicOrigin()) {
  const base = origin.replace(/\/+$/, "");
  // On the main site the form lives under /<locale>/questionnaire-fiscal/.
  const path = /\/\/tax\./.test(base) || /tax\.localhost/.test(base) ? `/${locale}/` : `/${locale}/questionnaire-fiscal/`;
  return `${base}${path}#acces=${token}`;
}

/** Creates a single-purpose link (only its HMAC is stored) and returns the full URL. */
export async function issueLink(options: IssueLinkOptions): Promise<string> {
  return (await issueLinkWithExpiry(options)).url;
}

/** Same, with the link's expiry (ISO), which the staff API returns alongside every link. */
export async function issueLinkWithExpiry(options: IssueLinkOptions): Promise<{ url: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + options.ttlMs;
  await sharePointPorts().access.put({
    keyHash: mac("link", token),
    kind: "link",
    caseId: options.caseId,
    emailHash: options.emailHash,
    scope: options.scope,
    purpose: options.purpose,
    expiresAt,
    revoked: false,
  });
  return { url: linkUrl(token, options.locale, options.origin), expiresAt: new Date(expiresAt).toISOString() };
}

/**
 * What a link opened by the client is: usable, replaced by a newer link (the holder may learn when
 * and whether it came by e-mail: it is their own link), expired, or unknown / revoked otherwise.
 */
export type LinkStatus =
  | { status: "ok"; record: AccessRecord }
  | { status: "replaced"; via: LinkReplacedVia; at: number }
  | { status: "expired" }
  | { status: "invalid" };

export async function linkStatus(token: unknown): Promise<LinkStatus> {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return { status: "invalid" };
  const record = await sharePointPorts().access.get(mac("link", token));
  if (!record || record.kind !== "link") return { status: "invalid" };
  if (record.revoked) return record.replacedAt ? { status: "replaced", via: record.replacedVia === "email" ? "email" : "other", at: record.replacedAt } : { status: "invalid" };
  if (record.expiresAt <= Date.now()) return { status: "expired" };
  return { status: "ok", record };
}

/** The 410 answer for a link that cannot be used: `link_replaced` {via, at}, `link_expired` or `link_invalid`. */
export function linkRefusal(status: Exclude<LinkStatus, { status: "ok" }>): { error: string; via?: LinkReplacedVia; at?: string } {
  if (status.status === "replaced") return { error: "link_replaced", via: status.via, at: new Date(status.at).toISOString() };
  return { error: status.status === "expired" ? "link_expired" : "link_invalid" };
}

export async function readLink(token: unknown) {
  const found = await linkStatus(token);
  return found.status === "ok" ? found.record : null;
}

// ---- one-time codes -------------------------------------------------------------------------------

export interface ChallengePayload {
  id: string;
  /** "new": create a case after verification; "link": open an existing case. */
  purpose: "new" | "link";
  emailHash: string;
  /** For "new" only: the identity to create the case with. */
  email?: string;
  firstName?: string;
  lastName?: string;
  caseId?: string;
  scope?: Scope;
  exp: number;
  codeMac: string;
}

const attempts = new Map<string, number>();
const usedChallenges = new Map<string, number>();

function prune(now: number) {
  if (attempts.size > 5000) attempts.clear();
  for (const [id, exp] of usedChallenges) if (exp < now) usedChallenges.delete(id);
}

export function createChallenge(data: Omit<ChallengePayload, "id" | "exp" | "codeMac">, now = Date.now()) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const id = randomBytes(12).toString("base64url");
  const payload: ChallengePayload = { ...data, id, exp: now + OTP_TTL_MS, codeMac: mac("otp", `${id}|${code}`) };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { code, challenge: `${body}.${mac("challenge", body)}` };
}

export type ChallengeResult = { ok: true; payload: ChallengePayload } | { ok: false; error: "otp_invalid" | "otp_expired" | "otp_locked" };

export function verifyChallenge(challenge: unknown, code: unknown, now = Date.now()): ChallengeResult {
  prune(now);
  if (typeof challenge !== "string" || challenge.length > 3000 || typeof code !== "string") return { ok: false, error: "otp_invalid" };
  const [body, signature, ...rest] = challenge.split(".");
  if (rest.length || !body || !signature) return { ok: false, error: "otp_invalid" };
  const expected = Buffer.from(mac("challenge", body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, error: "otp_invalid" };
  let payload: ChallengePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "otp_invalid" };
  }
  if (payload.exp <= now) return { ok: false, error: "otp_expired" };
  if (usedChallenges.has(payload.id)) return { ok: false, error: "otp_expired" };
  const tries = (attempts.get(payload.id) || 0) + 1;
  attempts.set(payload.id, tries);
  if (tries > OTP_MAX_ATTEMPTS) return { ok: false, error: "otp_locked" };
  const clean = code.replace(/\D/g, "");
  const codeMac = Buffer.from(mac("otp", `${payload.id}|${clean}`));
  const stored = Buffer.from(payload.codeMac);
  if (clean.length !== 6 || codeMac.length !== stored.length || !timingSafeEqual(codeMac, stored)) return { ok: false, error: "otp_invalid" };
  usedChallenges.set(payload.id, payload.exp);
  attempts.delete(payload.id);
  return { ok: true, payload };
}

// ---- office access (Ark staff fill the form for the client): shared logic in src/lib/forms/assist.ts --

export { STAFF_SESSION_TTL_MS } from "../../forms/assist";
/**
 * Address hash of a staff session: never a real address hash (those are keyed MACs), so a staff
 * session never passes for the client's verified address (the case is found by its id).
 */
export const STAFF_HASH = SHARED_STAFF_HASH;
const assistMac = (secret: string) => mac("assist", secret);

/** One single use, two ways in: a link token (`#assist=`) and an 8-character code (stored only as HMACs). */
export async function issueAssist(options: { caseId: string; by: string; ttlMs: number; origin?: string; locale?: string }) {
  return issueAssistAccess<AccessRecord>({
    mac: assistMac,
    access: sharePointPorts().access,
    ttlMs: options.ttlMs,
    record: ({ keyHash, sibling, expiresAt }) => ({ keyHash, sibling, kind: "assist", caseId: options.caseId, emailHash: STAFF_HASH, scope: "edit", purpose: "assist", expiresAt, revoked: false, by: options.by }),
    link: (token) => linkUrl(token, options.locale, options.origin).replace("#acces=", "#assist="),
  });
}

/** Consumes an assist token or code (single use: the other way in is spent too) and returns its record, or null. */
export async function redeemAssist(input: { token?: unknown; code?: unknown }) {
  return redeemAssistAccess<AccessRecord>(input, { mac: assistMac, access: sharePointPorts().access });
}

// ---- sessions -------------------------------------------------------------------------------------

export const SESSION_COOKIE = () => (process.env.NODE_ENV === "production" ? "__Host-tqf" : "tqf");

/** A staff session (staffBy) lasts STAFF_SESSION_TTL_MS, a client's SESSION_TTL_MS. */
export const sessionTtlMs = (info: Pick<SessionInfo, "staffBy">) => (info.staffBy ? STAFF_SESSION_TTL_MS : SESSION_TTL_MS);

export async function createSession(info: SessionInfo): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await sharePointPorts().access.put({
    keyHash: mac("session", raw),
    kind: "session",
    caseId: info.caseId,
    emailHash: info.staffBy ? STAFF_HASH : info.emailHash,
    scope: info.scope,
    expiresAt: Date.now() + sessionTtlMs(info),
    revoked: false,
    ...(info.staffBy ? { by: info.staffBy } : {}),
  });
  return raw;
}

export async function readSession(raw: string | undefined): Promise<SessionInfo | null> {
  if (!raw || !/^[A-Za-z0-9_-]{40,60}$/.test(raw)) return null;
  const record = await sharePointPorts().access.get(mac("session", raw));
  if (!record || record.kind !== "session" || record.revoked || record.expiresAt <= Date.now()) return null;
  return { caseId: record.caseId, emailHash: record.emailHash, scope: record.scope, ...(record.by ? { staffBy: record.by } : {}) };
}

export async function revokeSession(raw: string | undefined) {
  if (raw && /^[A-Za-z0-9_-]{40,60}$/.test(raw)) await sharePointPorts().access.revoke(mac("session", raw));
}

export function sessionCookie(value: string, maxAgeSeconds = SESSION_TTL_MS / 1000) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE()}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeSeconds)}${secure}`;
}

export function readCookie(request: Request, name = SESSION_COOKIE()): string | undefined {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}
