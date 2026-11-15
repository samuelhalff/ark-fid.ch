import assert from "node:assert/strict";
import test from "node:test";

import { signRequest } from "../kyc-questionnaire/server/signature.ts";
import { CadenceClientRegistry, CLIENTS_PATH, ClientListUnavailable } from "./server/cadence-registry.ts";

const SECRET = "t".repeat(40);
const NOW = 1_800_000_000_000;

function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>) {
  const saved = Object.fromEntries(Object.keys(values).map((k) => [k, process.env[k]]));
  Object.assign(process.env, Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)));
  for (const [k, v] of Object.entries(values)) if (v === undefined) delete process.env[k];
  return run().finally(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

const ENV = { TAX_QF_API_KEYS: `cadence:${SECRET}`, TAX_QF_CADENCE_CLIENTS_URL: "https://cadence.invalid/api/tax-form/clients", TAX_QF_CADENCE_KEY_ID: undefined };

function fake(answer: { status?: number; body?: unknown; throws?: boolean }) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (answer.throws) throw new TypeError("fetch failed");
    return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status ?? 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("the list is read signed with the tax pair, for the year asked, and kept to well-formed people", () =>
  withEnv(ENV, async () => {
    const { impl, calls } = fake({
      body: {
        taxYear: 2026,
        items: [
          { clientRef: "odoo:42", email: "carol@example.ch", lastName: "Keller", firstName: "Carol", language: "de" },
          { clientRef: "odoo:43", email: "not an address", lastName: "X", firstName: "Y" },
          { clientRef: "", email: "nobody@example.ch", lastName: "Z", firstName: "" },
        ],
      },
    });
    const clients = await new CadenceClientRegistry(impl, () => NOW).listTaxClients(2026);
    assert.deepEqual(clients, [{ id: "odoo:42", clientRef: "odoo:42", email: "carol@example.ch", lastName: "Keller", firstName: "Carol", language: "de" }]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://cadence.invalid/api/tax-form/clients?year=2026");
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers["x-kyc-key-id"], "cadence");
    assert.equal(headers["x-kyc-timestamp"], String(NOW));
    // Cadence recomputes this over the constant path and the raw query string.
    assert.equal(headers["x-kyc-signature"], signRequest(SECRET, "GET", CLIENTS_PATH, String(NOW), headers["x-kyc-nonce"], "year=2026"));
  }));

test("anything short of the whole list for that year is refused, never an empty or stale list", () =>
  withEnv(ENV, async () => {
    for (const answer of [{ throws: true }, { status: 503, body: { detail: {} } }, { status: 401 }, { body: { taxYear: 2025, items: [] } }, { body: { taxYear: 2026 } }]) {
      const { impl } = fake(answer);
      await assert.rejects(new CadenceClientRegistry(impl, () => NOW).listTaxClients(2026), ClientListUnavailable, JSON.stringify(answer));
    }
  }));

test("without the tax pair nothing is asked", () =>
  withEnv({ ...ENV, TAX_QF_API_KEYS: undefined }, async () => {
    const { impl, calls } = fake({ body: { taxYear: 2026, items: [] } });
    await assert.rejects(new CadenceClientRegistry(impl, () => NOW).listTaxClients(2026), ClientListUnavailable);
    assert.equal(calls.length, 0);
  }));

test("the SharePoint CRM is neither matched nor written: Cadence attaches returns itself", async () => {
  const registry = new CadenceClientRegistry();
  assert.deepEqual(await registry.match(), { status: "none" });
  assert.equal(await registry.recordTaxClient(), null);
});
