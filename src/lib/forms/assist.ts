import { randomBytes } from "node:crypto";

/**
 * Office access ("Code cabinet"), shared by the KYC and tax forms: Ark staff open a client's form
 * with one single-use access that has two ways in, a link token (URL fragment `#assist=`) and an
 * 8-character code read aloud or typed. Both are stored only as HMACs (the caller's key domain),
 * each record naming the other (`sibling`), so using one spends both.
 */

export const ASSIST_DEFAULT_MINUTES = 30;
export const ASSIST_MAX_MINUTES = 240;
/** A staff session opened with an assist access lasts a working day. */
export const STAFF_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** Address hash of a staff session: never equals a real address hash (those are keyed MACs). */
export const STAFF_HASH = "staff";
// No 0, 1, O or I: nothing to confuse when read aloud; a typed code ignores case, spaces and dashes.
export const ASSIST_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ASSIST_TOKEN_RE = /^[A-Za-z0-9_-]{40,60}$/;
export const normaliseAssistCode = (code: string) => code.toUpperCase().replace(/[\s-]/g, "");

/**
 * Minutes an access stays usable: the default when absent, null when invalid (1..240; whole
 * minutes only when `integer`).
 */
export function assistMinutes(value: unknown, options: { integer?: boolean } = {}): number | null {
  if (value === undefined) return ASSIST_DEFAULT_MINUTES;
  const minutes = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > ASSIST_MAX_MINUTES) return null;
  if (options.integer && !Number.isInteger(minutes)) return null;
  return minutes;
}

/** The fields of an access record the shared logic reads. */
export interface AssistRecordFields {
  kind: string;
  expiresAt: number;
  revoked: boolean;
  by?: string;
  sibling?: string;
}

export interface AssistAccessPort<R> {
  put(record: R): Promise<void>;
  get(keyHash: string): Promise<R | null>;
  revoke(keyHash: string): Promise<void>;
}

export interface AssistIssued {
  /** Opens the form for Ark staff (fragment `#assist=`); single use, shared with `code`. */
  link: string;
  /** The same access as a code typed on the access page (« Code cabinet »), shown as ABCD-EFGH. */
  code: string;
  expiresAt: string;
}

/**
 * Issues one access (token + code). `mac` is the caller's keyed hash for assist secrets, `record`
 * builds the caller's access record for one of the two keys, `link` the URL for the token.
 */
export async function issueAssistAccess<R>(options: {
  mac: (secret: string) => string;
  access: Pick<AssistAccessPort<R>, "put">;
  ttlMs: number;
  record: (keys: { keyHash: string; sibling: string; expiresAt: number }) => R;
  link: (token: string) => string;
}): Promise<AssistIssued> {
  const token = randomBytes(32).toString("base64url");
  let code = "";
  for (const byte of randomBytes(8)) code += ASSIST_CODE_ALPHABET[byte % ASSIST_CODE_ALPHABET.length];
  const expiresAt = Date.now() + options.ttlMs;
  const tokenKey = options.mac(token);
  const codeKey = options.mac(normaliseAssistCode(code));
  await options.access.put(options.record({ keyHash: tokenKey, sibling: codeKey, expiresAt }));
  await options.access.put(options.record({ keyHash: codeKey, sibling: tokenKey, expiresAt }));
  return { link: options.link(token), code: `${code.slice(0, 4)}-${code.slice(4)}`, expiresAt: new Date(expiresAt).toISOString() };
}

/** Consumes an assist token or code (single use: its sibling is revoked too) and returns its record, or null. */
export async function redeemAssistAccess<R extends AssistRecordFields>(
  input: { token?: unknown; code?: unknown },
  options: { mac: (secret: string) => string; access: AssistAccessPort<R> },
): Promise<R | null> {
  let key: string | null = null;
  if (typeof input.token === "string" && ASSIST_TOKEN_RE.test(input.token)) key = options.mac(input.token);
  else if (typeof input.code === "string" && input.code.length <= 40) {
    const clean = normaliseAssistCode(input.code);
    if (clean.length === 8) key = options.mac(clean);
  }
  if (!key) return null;
  const record = await options.access.get(key);
  if (!record || record.kind !== "assist" || record.revoked || record.expiresAt <= Date.now() || !record.by) return null;
  await options.access.revoke(key);
  if (record.sibling) await options.access.revoke(record.sibling);
  return record;
}
