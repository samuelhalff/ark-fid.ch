import assert from "node:assert/strict";
import test from "node:test";

process.env.KYC_QF_API_KEYS = "cadence:cadence-secret-cadence-secret-cadence-01";

import { companiesCadence } from "./server/cadence";
import { signRequest } from "./server/signature";

test("register type-ahead: a signed GET over the query string, at most 8 companies, name/seat/uid only", async () => {
  let seen: { url: string; headers: Record<string, string> } | null = null;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen = { url, headers: init.headers as Record<string, string> };
    const items = Array.from({ length: 10 }, (_, i) => ({ name: `Holding ${i} SA`, seat: "Genève", uid: `CHE-000.000.00${i}`, ehraid: i, secret: "x" }));
    return new Response(JSON.stringify({ items }), { status: 200 });
  }) as unknown as typeof fetch;
  const result = await companiesCadence("Holding X", fetchImpl, 1_700_000_000_000);
  assert.equal(result.ok, true);
  assert.equal(result.items.length, 8);
  assert.deepEqual(result.items[0], { name: "Holding 0 SA", seat: "Genève", uid: "CHE-000.000.000" });
  assert.equal(seen!.url, "https://app.ark-fid.ch/api/kyc-form/companies?q=Holding+X");
  const h = seen!.headers;
  assert.equal(h["x-kyc-signature"], signRequest("cadence-secret-cadence-secret-cadence-01", "GET", "/kyc-form/companies", h["x-kyc-timestamp"], h["x-kyc-nonce"], "q=Holding+X"));
});

test("register type-ahead never blocks: short text, Cadence down or refusing → an empty list", async () => {
  let calls = 0;
  const down = (async () => {
    calls++;
    throw new Error("down");
  }) as unknown as typeof fetch;
  assert.deepEqual(await companiesCadence("H", down), { ok: true, items: [] });
  assert.equal(calls, 0, "one letter is not searched");
  assert.deepEqual(await companiesCadence("Holding", down), { ok: false, items: [] });
  const refused = (async () => new Response("{}", { status: 429 })) as unknown as typeof fetch;
  assert.deepEqual(await companiesCadence("Holding", refused), { ok: false, items: [] });
});
