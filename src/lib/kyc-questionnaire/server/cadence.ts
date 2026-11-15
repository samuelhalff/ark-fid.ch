import { randomBytes } from "node:crypto";
import { apiKeys, cadenceAskUrl, cadenceCompaniesUrl, cadenceKeyId } from "./config";
import { signRequest } from "./signature";

/**
 * kyc.ark-fid.ch → Cadence: the client's question about one field (the form assistant). Signed like
 * Cadence's own calls here (signature.ts), in the other direction, with Cadence's pair of
 * KYC_QF_API_KEYS. The signed target is the constant ASK_PATH on both sides, whatever proxy sits
 * in front of Cadence. Nothing of the question or the answers is logged.
 */
export const ASK_PATH = "/kyc-form/ask";

export type AskPayload = { caseId: string; route: string; fieldId: string; question: string; language: "fr" | "en"; answers: Record<string, unknown> };
export type AskReply = { offTopic: boolean; answer: string | null; proposal: string | string[] | null };
export type AskResult = { ok: true; reply: AskReply } | { ok: false; status: number; error: string };

export async function askCadence(payload: AskPayload, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<AskResult> {
  // Cadence verifies with its own key: the pair named KYC_QF_CADENCE_KEY_ID (default "cadence"), so a
  // rotation listing two pairs keeps working whatever their order.
  const keys = apiKeys();
  const keyId = keys.has(cadenceKeyId()) ? cadenceKeyId() : [...keys.keys()][0];
  const secret = keyId ? keys.get(keyId) : undefined;
  if (!keyId || !secret) return { ok: false, status: 500, error: "missing_configuration" };
  const body = JSON.stringify(payload);
  const timestamp = String(now);
  const nonce = randomBytes(18).toString("base64url");
  let res: Response;
  try {
    res = await fetchImpl(cadenceAskUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kyc-key-id": keyId,
        "x-kyc-timestamp": timestamp,
        "x-kyc-nonce": nonce,
        "x-kyc-signature": signRequest(secret, "POST", ASK_PATH, timestamp, nonce, body),
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    return { ok: false, status: 502, error: "assist_unavailable" };
  }
  if (res.status === 429) return { ok: false, status: 429, error: "rate_limited" };
  if (!res.ok) return { ok: false, status: 502, error: "assist_unavailable" };
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!data || typeof data.off_topic !== "boolean") return { ok: false, status: 502, error: "assist_unavailable" };
  const proposal = data.proposal;
  const validProposal = typeof proposal === "string" || (Array.isArray(proposal) && proposal.every((v) => typeof v === "string")) ? (proposal as string | string[]) : null;
  return {
    ok: true,
    reply: { offTopic: data.off_topic, answer: typeof data.answer === "string" ? data.answer : null, proposal: data.off_topic ? null : validProposal },
  };
}

/**
 * kyc.ark-fid.ch → Cadence: Swiss companies of the register whose name matches what the client
 * types (holders of section B), from Cadence's Zefix integration: at most 8 active companies,
 * `{ name, seat, uid }`. GET, signed over the query string as sent. Never blocks the form: any
 * failure is an empty list, and the client's own text stays the answer.
 */
export const COMPANIES_PATH = "/kyc-form/companies";
export type RegisterCompany = { name: string; seat: string; uid: string };

export async function companiesCadence(q: string, fetchImpl: typeof fetch = fetch, now = Date.now()): Promise<{ ok: boolean; items: RegisterCompany[] }> {
  const query = q.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 120);
  if (query.length < 2) return { ok: true, items: [] };
  const keys = apiKeys();
  const keyId = keys.has(cadenceKeyId()) ? cadenceKeyId() : [...keys.keys()][0];
  const secret = keyId ? keys.get(keyId) : undefined;
  if (!keyId || !secret) return { ok: false, items: [] };
  const search = new URLSearchParams({ q: query }).toString();
  const timestamp = String(now);
  const nonce = randomBytes(18).toString("base64url");
  try {
    const res = await fetchImpl(`${cadenceCompaniesUrl()}?${search}`, {
      method: "GET",
      headers: {
        "x-kyc-key-id": keyId,
        "x-kyc-timestamp": timestamp,
        "x-kyc-nonce": nonce,
        "x-kyc-signature": signRequest(secret, "GET", COMPANIES_PATH, timestamp, nonce, search),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return { ok: false, items: [] };
    const data = (await res.json().catch(() => null)) as { items?: unknown } | null;
    const items = Array.isArray(data?.items) ? data!.items : [];
    const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
    return {
      ok: true,
      items: items
        .filter((i): i is Record<string, unknown> => !!i && typeof i === "object")
        .map((i) => ({ name: text(i.name, 200), seat: text(i.seat, 100), uid: text(i.uid, 30) }))
        .filter((i) => i.name)
        .slice(0, 8),
    };
  } catch {
    return { ok: false, items: [] };
  }
}
