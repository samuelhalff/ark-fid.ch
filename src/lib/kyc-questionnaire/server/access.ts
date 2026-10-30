import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { LINK_TTL_MS, OTP_MAX_ATTEMPTS, OTP_TTL_MS, isProd, publicOrigin, SESSION_TTL_MS, tokenSecret } from "./config";
import { getPorts } from "./sharepoint";

/**
 * Client access without accounts (same design as tax.ark-fid.ch, own key domain):
 * - a link token (32 random bytes) in the URL fragment, stored only as an HMAC;
 * - a 6-digit code e-mailed at every opening (10 min, single use, 5 attempts) in a signed
 *   challenge the server does not store;
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

export async function issueLink(options: { caseId: string; revision: number; emailHash: string; locale: string; ttlMs?: number }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + (options.ttlMs || LINK_TTL_MS);
  await getPorts().access.put({ keyHash: mac("link", token), kind: "link", caseId: options.caseId, revision: options.revision, emailHash: options.emailHash, expiresAt, revoked: false });
  return { url: linkUrl(token, options.locale), expiresAt: new Date(expiresAt).toISOString() };
}

const TOKEN_RE = /^[A-Za-z0-9_-]{40,60}$/;

export async function readLink(token: unknown) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const record = await getPorts().access.get(mac("link", token));
  if (!record || record.kind !== "link" || record.revoked || record.expiresAt <= Date.now()) return null;
  return record;
}

// ---- one-time codes ---------------------------------------------------------------------------

export interface ChallengePayload {
  id: string;
  caseId: string;
  revision: number;
  emailHash: string;
  exp: number;
  codeMac: string;
}

const attempts = new Map<string, number>();
const used = new Map<string, number>();

export function createChallenge(data: { caseId: string; revision: number; emailHash: string }, now = Date.now()) {
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

// ---- sessions ---------------------------------------------------------------------------------

export interface SessionInfo {
  caseId: string;
  revision: number;
  emailHash: string;
}

export const SESSION_COOKIE = () => (isProd() ? "__Host-kqf" : "kqf");

export async function createSession(info: SessionInfo): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  await getPorts().access.put({ keyHash: mac("session", raw), kind: "session", caseId: info.caseId, revision: info.revision, emailHash: info.emailHash, expiresAt: Date.now() + SESSION_TTL_MS, revoked: false });
  return raw;
}

export async function readSession(raw: string | undefined): Promise<SessionInfo | null> {
  if (!raw || !TOKEN_RE.test(raw)) return null;
  const record = await getPorts().access.get(mac("session", raw));
  if (!record || record.kind !== "session" || record.revoked || record.expiresAt <= Date.now()) return null;
  return { caseId: record.caseId, revision: record.revision, emailHash: record.emailHash };
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
