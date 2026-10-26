import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Submission token: given by /start after the Turnstile check, it lets the browser upload into
 * one submission folder and submit once. HMAC-signed (TAX_QF_TOKEN_SECRET), purpose-bound.
 */
const CONTEXT = "ark-tax-qf-submission-v1";
export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SubmissionToken {
  /** Submission id (also the short id in the folder name). */
  sid: string;
  /** SharePoint drive and folder item ids of the submission folder. */
  drive: string;
  folder: string;
  /** Folder name (for messages only). */
  name: string;
  year: number;
  exp: number;
}

export const isUsableSecret = (secret: string | undefined): secret is string => !!secret && secret.length >= 32;

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");
const sign = (secret: string, body: string) => createHmac("sha256", secret).update(`${CONTEXT}.${body}`).digest();

export function newSubmissionId(): string {
  return randomBytes(5).toString("hex"); // 10 hex chars
}

export function issueToken(secret: string, data: Omit<SubmissionToken, "exp">, now = Date.now()): string {
  const payload: SubmissionToken = { ...data, exp: now + TOKEN_TTL_MS };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(sign(secret, body))}`;
}

export function verifyToken(secret: string, token: unknown, now = Date.now()): SubmissionToken | null {
  if (typeof token !== "string" || token.length > 2000) return null;
  const [body, signature, ...rest] = token.split(".");
  if (rest.length || !body || !signature || !/^[A-Za-z0-9_-]+$/.test(body) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
  const expected = sign(secret, body);
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  let payload: SubmissionToken;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    !payload ||
    typeof payload.sid !== "string" ||
    !/^[a-f0-9]{10}$/.test(payload.sid) ||
    typeof payload.drive !== "string" ||
    typeof payload.folder !== "string" ||
    typeof payload.name !== "string" ||
    !Number.isInteger(payload.year) ||
    typeof payload.exp !== "number" ||
    payload.exp <= now
  ) {
    return null;
  }
  return payload;
}
