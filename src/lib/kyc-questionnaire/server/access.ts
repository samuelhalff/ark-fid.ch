import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { LINK_TTL_MS, OTP_MAX_ATTEMPTS, OTP_TTL_MS, isProd, publicOrigin, SESSION_TTL_MS, tokenSecret } from "./config";
import type { AccessRecord, LinkReplacedVia } from "./ports";
import { getPorts } from "./sharepoint";
import { issueAssistAccess, redeemAssistAccess, STAFF_HASH as SHARED_STAFF_HASH } from "../../forms/assist";

/**
 * Client access without accounts (same design as tax.ark-fid.ch, own key domain):
 * - a link token (32 random bytes) in the URL fragment, stored only as an HMAC;
 * - a 6-digit code e-mailed at every opening (10 min, single use, 5 attempts) in a signed
 *   challenge the server does not store;
 * - without the link: the client's e-mail address → the same code, sent only if a form in
 *   progress was issued to that address (the answer never says whether one exists);
 * - a session cookie (random value, HMAC stored with an absolute expiry, revocable).
 * Links are tied to one revision: a new revision (correction) revokes the older links.
 */

function secret(): string {
  const value = tokenSecret();
  if (!value) throw new Error("KYC_QF_TOKEN_SECRET missing or too short");
  return value;
}

const mac = (purpose: string, value: string) => createHmac("sha256", secret()).update(`ark-kyc-qf|${purpose}|${value}`).digest("base64url");

export const normaliseEmail = (email: string) => email.trim().toLowerCase();
export const emailHash = (email: string) => mac("email", normaliseEmail(email)).slice(0, 32);

export function linkUrl(token: string, locale = "fr", origin = publicOrigin()) {
  const base = origin.replace(/\/+$/, "");
  const path = /\/\/kyc\./.test(base) || /kyc\.localhost/.test(base) ? `/${locale}/` : `/${locale}/questionnaire-kyc/`;
  return `${base}${path}#acces=${token}`;
}

/** Public reference of a link for the signature trace: a separate keyed hash of its lookup key, never the token or a part of its key. */
export const linkRef = (record: { keyHash: string }) => mac("linkref", record.keyHash).slice(0, 16);

export async function issueLink(options: { caseId: string; revision: number; emailHash: string; locale: string; ttlMs?: number }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + (options.ttlMs || LINK_TTL_MS);
  await getPorts().access.put({ keyHash: mac("link", token), kind: "link", caseId: options.caseId, revision: options.revision, emailHash: options.emailHash, expiresAt, revoked: false });
  return { url: linkUrl(token, options.locale), expiresAt: new Date(expiresAt).toISOString() };
}

const TOKEN_RE = /^[A-Za-z0-9_-]{40,60}$/;

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
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { status: "invalid" };
  const record = await getPorts().access.get(mac("link", token));
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

// ---- one-time codes ---------------------------------------------------------------------------

export interface ChallengePayload {
  id: string;
  caseId: string;
  revision: number;
  emailHash: string;
  /** Set when the code was requested by opening a link: that link's reference. */
  linkRef?: string;
  exp: number;
  codeMac: string;
  /** Code requested with an e-mail address (no link): the cases are resolved when it is checked. */
  byEmail?: true;
}

const attempts = new Map<string, number>();
const used = new Map<string, number>();

export function createChallenge(data: { caseId: string; revision: number; emailHash: string; byEmail?: true; linkRef?: string }, now = Date.now()) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const id = randomBytes(12).toString("base64url");
  const payload: ChallengePayload = { ...data, id, exp: now + OTP_TTL_MS, codeMac: mac("otp", `${id}|${code}`) };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { code, challenge: `${body}.${mac("challenge", body)}` };
}

export type ChallengeResult = { ok: true; payload: ChallengePayload } | { ok: false; error: "otp_invalid" | "otp_expired" | "otp_locked" };

export function verifyChallenge(challenge: unknown, code: unknown, now = Date.now()): ChallengeResult {
  if (attempts.size > 5000) attempts.clear();
  for (const [id, exp] of used) if (exp < now) used.delete(id);
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
  if (payload.exp <= now || used.has(payload.id)) return { ok: false, error: "otp_expired" };
  const tries = (attempts.get(payload.id) || 0) + 1;
  attempts.set(payload.id, tries);
  if (tries > OTP_MAX_ATTEMPTS) return { ok: false, error: "otp_locked" };
  const clean = code.replace(/\D/g, "");
  const codeMac = Buffer.from(mac("otp", `${payload.id}|${clean}`));
  const stored = Buffer.from(payload.codeMac);
  if (clean.length !== 6 || codeMac.length !== stored.length || !timingSafeEqual(codeMac, stored)) return { ok: false, error: "otp_invalid" };
  used.set(payload.id, payload.exp);
  attempts.delete(payload.id);
  return { ok: true, payload };
}

/** A code checked correctly whose case could not be resolved (storage failure) may be used again. */
export function releaseChallenge(id: string) {
  used.delete(id);
}

// ---- choice of form after an e-mail code (one address, several forms) ----------------------------

const PICK_TTL_MS = 10 * 60 * 1000;

export function createPick(emailHash: string, caseIds: string[], now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ emailHash, caseIds, exp: now + PICK_TTL_MS })).toString("base64url");
  return `${body}.${mac("pick", body)}`;
}

export function readPick(token: unknown, now = Date.now()): { emailHash: string; caseIds: string[] } | null {
  if (typeof token !== "string" || token.length > 3000) return null;
  const [body, signature, ...rest] = token.split(".");
  if (rest.length || !body || !signature) return null;
  const expected = Buffer.from(mac("pick", body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof data.exp !== "number" || data.exp <= now || !Array.isArray(data.caseIds) || typeof data.emailHash !== "string") return null;
    return { emailHash: data.emailHash, caseIds: data.caseIds.map(String) };
  } catch {
    return null;
  }
}

// ---- staff assistance (Ark helps a client fill the form): shared logic in src/lib/forms/assist.ts ----

export { ASSIST_DEFAULT_MINUTES, ASSIST_MAX_MINUTES, STAFF_SESSION_TTL_MS, normaliseAssistCode } from "../../forms/assist";
const assistMac = (secret: string) => mac("assist", secret);

/** One single use, two ways in: a link token and an 8-character code (stored only as HMACs). */
export async function issueAssist(options: { caseId: string; revision: number; by: string; locale: string; ttlMs: number }) {
  return issueAssistAccess<AccessRecord>({
    mac: assistMac,
    access: getPorts().access,
    ttlMs: options.ttlMs,
    record: ({ keyHash, sibling, expiresAt }) => ({ keyHash, sibling, kind: "assist", caseId: options.caseId, revision: options.revision, emailHash: STAFF_HASH, expiresAt, revoked: false, by: options.by }),
    link: (token) => linkUrl(token, options.locale).replace("#acces=", "#assist="),
  });
}

/** Consumes an assist token or code (single use) and returns what it opens, or null. */
export async function redeemAssist(input: { token?: unknown; code?: unknown }) {
  return redeemAssistAccess<AccessRecord>(input, { mac: assistMac, access: getPorts().access });
}

// ---- sessions ---------------------------------------------------------------------------------

export interface SessionInfo {
  caseId: string;
  revision: number;
  emailHash: string;
  /** The link the session was opened through (absent when opened by e-mail address or by staff). */
  linkRef?: string;
  /** Set when Ark staff opened the session with an assist code or link: who (role "staff"). */
  staffBy?: string;
}

/** Address hash of a staff session: never equals a real address hash, so it is never a contact or a signer. */
export const STAFF_HASH = SHARED_STAFF_HASH;

export const SESSION_COOKIE = () => (isProd() ? "__Host-kqf" : "kqf");

export async function createSession(info: SessionInfo, options: { ttlMs?: number } = {}): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await getPorts().access.put({
    keyHash: mac("session", raw),
    kind: "session",
    caseId: info.caseId,
    revision: info.revision,
    emailHash: info.emailHash,
    expiresAt: Date.now() + (options.ttlMs || SESSION_TTL_MS),
    revoked: false,
    ...(info.staffBy ? { by: info.staffBy } : {}),
    ...(info.linkRef ? { linkRef: info.linkRef } : {}),
  });
  return raw;
}

export async function readSession(raw: string | undefined): Promise<SessionInfo | null> {
  if (!raw || !TOKEN_RE.test(raw)) return null;
  const record = await getPorts().access.get(mac("session", raw));
  if (!record || record.kind !== "session" || record.revoked || record.expiresAt <= Date.now()) return null;
  return { caseId: record.caseId, revision: record.revision, emailHash: record.emailHash, ...(record.by ? { staffBy: record.by } : {}), ...(record.linkRef ? { linkRef: record.linkRef } : {}) };
}

export async function revokeSession(raw: string | undefined) {
  if (raw && TOKEN_RE.test(raw)) await getPorts().access.revoke(mac("session", raw));
}

export function sessionCookie(value: string, maxAgeSeconds = SESSION_TTL_MS / 1000) {
  const secure = isProd() ? "; Secure" : "";
  return `${SESSION_COOKIE()}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeSeconds)}${secure}`;
}

export function readCookie(request: Request, name = SESSION_COOKIE()): string | undefined {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}
