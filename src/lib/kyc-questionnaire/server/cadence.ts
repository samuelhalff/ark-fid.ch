import { randomBytes } from "node:crypto";
import { apiKeys, cadenceAskUrl, cadenceKeyId } from "./config";
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
