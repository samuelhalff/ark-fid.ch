/**
 * ClientRegistry adapter for Cadence (TAX_QF_CLIENTS_SOURCE=cadence): the campaign's audience is
 * Cadence's list — the people with a tax obligation of the year still to file and an e-mail, read
 * from the firm's Odoo — instead of the SharePoint CRM list. `match` and `recordTaxClient` do
 * nothing: Cadence attaches a return to its client when it polls the staff feed.
 *
 * GET {TAX_QF_CADENCE_CLIENTS_URL}?year=<taxYear>, signed like the KYC form's calls to Cadence
 * (signature.ts) with the `cadence` pair of TAX_QF_API_KEYS — the pair Cadence uses to call the
 * staff API, so a KYC key never signs it. The signed target is the constant CLIENTS_PATH on both
 * sides, whatever proxy sits in front of Cadence.
 *
 * Fail safe: any failure throws ClientListUnavailable and the campaign skips that run — it never
 * invites from an old or partial list.
 */
import { randomBytes } from "node:crypto";
import { parseApiKeys, signRequest } from "../../kyc-questionnaire/server/signature";
import type { ClientMatch, ClientRegistry, TaxClient } from "./ports";

export const CLIENTS_PATH = "/tax-form/clients";

const env = (name: string) => (process.env[name] || "").trim();

export const cadenceClientsUrl = () => env("TAX_QF_CADENCE_CLIENTS_URL") || "https://app.ark-fid.ch/api/tax-form/clients";

/** The campaign's audience comes from Cadence (the SharePoint CRM is no longer read nor written). */
export const clientsFromCadence = () => env("TAX_QF_CLIENTS_SOURCE") === "cadence";

/** Cadence did not give its whole list: nothing may be sent from another one. */
export class ClientListUnavailable extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`client_list_unavailable:${reason}`);
    this.name = "ClientListUnavailable";
    this.reason = reason;
  }
}

const EMAIL_RE = /^[^\s@<>]{1,64}@[^\s@<>]{1,190}\.[a-z]{2,}$/i;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

export class CadenceClientRegistry implements ClientRegistry {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  constructor(fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
    this.fetchImpl = fetchImpl;
    this.now = now;
  }

  async match(): Promise<ClientMatch> {
    return { status: "none" };
  }

  async recordTaxClient() {
    return null;
  }

  async listTaxClients(taxYear: number): Promise<TaxClient[]> {
    const keys = parseApiKeys(env("TAX_QF_API_KEYS"));
    const keyId = keys.has(env("TAX_QF_CADENCE_KEY_ID") || "cadence") ? env("TAX_QF_CADENCE_KEY_ID") || "cadence" : [...keys.keys()][0];
    const secret = keyId ? keys.get(keyId) : undefined;
    if (!keyId || !secret) throw new ClientListUnavailable("missing_configuration");
    if (!Number.isInteger(taxYear)) throw new ClientListUnavailable("invalid_year");
    const search = new URLSearchParams({ year: String(taxYear) }).toString();
    const timestamp = String(this.now());
    const nonce = randomBytes(18).toString("base64url");
    let res: Response;
    try {
      res = await this.fetchImpl(`${cadenceClientsUrl()}?${search}`, {
        method: "GET",
        headers: {
          "x-kyc-key-id": keyId,
          "x-kyc-timestamp": timestamp,
          "x-kyc-nonce": nonce,
          "x-kyc-signature": signRequest(secret, "GET", CLIENTS_PATH, timestamp, nonce, search),
        },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ClientListUnavailable("unreachable");
    }
    if (!res.ok) throw new ClientListUnavailable(`status_${res.status}`);
    const data = (await res.json().catch(() => null)) as { taxYear?: unknown; items?: unknown } | null;
    if (!data || data.taxYear !== taxYear || !Array.isArray(data.items)) throw new ClientListUnavailable("invalid_answer");
    const out: TaxClient[] = [];
    for (const raw of data.items) {
      if (!raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const clientRef = clean(item.clientRef, 64);
      const email = clean(item.email, 254);
      const lastName = clean(item.lastName, 120);
      if (!clientRef || !EMAIL_RE.test(email) || !lastName) continue;
      out.push({ id: clientRef, clientRef, email, lastName, firstName: clean(item.firstName, 120), language: clean(item.language, 5) || undefined });
    }
    return out;
  }
}
