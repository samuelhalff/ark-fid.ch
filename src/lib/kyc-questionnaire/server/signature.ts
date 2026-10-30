import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { apiKeys } from "./config";

/**
 * Cadence → kyc.ark-fid.ch request signature (HMAC-SHA256, base64url) over
 *   METHOD \n PATH?QUERY \n TIMESTAMP \n NONCE \n SHA256-HEX(BODY)
 * Headers: x-kyc-key-id, x-kyc-timestamp (ms since epoch), x-kyc-nonce (16–64 of [A-Za-z0-9_-]),
 * x-kyc-signature; POST also Idempotency-Key (8–100 of [A-Za-z0-9_.:-]). Five-minute window, each
 * nonce accepted once (single Node instance). Keys rotate by listing two in KYC_QF_API_KEYS.
 */
export const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;
const nonces = new Map<string, number>();

export function signRequest(secret: string, method: string, pathAndQuery: string, timestamp: string, nonce: string, body: string) {
  const bodyHash = createHash("sha256").update(body).digest("hex");
  return createHmac("sha256", secret).update(`${method.toUpperCase()}\n${pathAndQuery}\n${timestamp}\n${nonce}\n${bodyHash}`).digest("base64url");
}

export type Verified = { ok: true; keyId: string; body: Record<string, unknown>; idempotencyKey: string; payloadHash: string };
export type Refused = { ok: false; status: number; error: string; reason?: string };

export async function verifyStaffRequest(request: Request, now = Date.now()): Promise<Verified | Refused> {
  const keys = apiKeys();
  if (!keys.size) return { ok: false, status: 500, error: "missing_configuration" };
  const keyId = request.headers.get("x-kyc-key-id") || "";
  const timestamp = request.headers.get("x-kyc-timestamp") || "";
  const nonce = request.headers.get("x-kyc-nonce") || "";
  const signature = request.headers.get("x-kyc-signature") || "";
  const secret = keys.get(keyId);
  if (!secret || !/^\d{13}$/.test(timestamp) || !/^[A-Za-z0-9_-]{16,64}$/.test(nonce) || !signature) return { ok: false, status: 401, error: "unauthorized" };
  if (Math.abs(now - Number(timestamp)) > SIGNATURE_WINDOW_MS) return { ok: false, status: 401, error: "unauthorized", reason: "clock" };
  const raw = request.method === "GET" ? "" : await request.text().catch(() => "");
  if (raw.length > 256 * 1024) return { ok: false, status: 413, error: "payload_too_large" };
  const url = new URL(request.url);
  const expected = Buffer.from(signRequest(secret, request.method, `${url.pathname}${url.search}`, timestamp, nonce, raw));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, status: 401, error: "unauthorized" };
  for (const [n, exp] of nonces) if (exp < now) nonces.delete(n);
  const nonceKey = `${keyId}:${nonce}`;
  if (nonces.has(nonceKey)) return { ok: false, status: 401, error: "unauthorized", reason: "replay" };
  nonces.set(nonceKey, now + SIGNATURE_WINDOW_MS);
  let body: Record<string, unknown> = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      body = parsed;
    } catch {
      return { ok: false, status: 400, error: "invalid_request" };
    }
  }
  const idempotencyKey = request.headers.get("idempotency-key") || "";
  if (request.method === "POST" && !/^[A-Za-z0-9_.:-]{8,100}$/.test(idempotencyKey)) return { ok: false, status: 400, error: "idempotency_key_required" };
  const payloadHash = createHash("sha256").update(`${url.pathname}\n${raw}`).digest("hex");
  return { ok: true, keyId, body, idempotencyKey, payloadHash };
}
