import assert from "node:assert/strict";
import test from "node:test";

import { buildOdooLeadValues } from "./leads.ts";

test("buildOdooLeadValues uses the sender name as the lead title when present", () => {
  const values = buildOdooLeadValues(
    {
      name: "Jane Sender",
      email: "jane@example.com",
      companyName: "Sender SA",
      sourceDetail: "contact_form",
    },
    new Set(["name"]),
  );

  assert.equal(values.name, "Jane Sender");
});

test("buildOdooLeadValues falls back to company name before email", () => {
  const values = buildOdooLeadValues(
    {
      email: "finance@example.com",
      companyName: "Sender SA",
      sourceDetail: "contact_form",
    },
    new Set(["name"]),
  );

  assert.equal(values.name, "Sender SA");
});

test("postOdooLeadNote retries once and reports failures", async (t) => {
  process.env.ODOO_URL = "https://odoo.test";
  process.env.ODOO_DB = "testdb";
  process.env.ODOO_TOKEN = "token";
  t.after(() => {
    delete process.env.ODOO_URL;
    delete process.env.ODOO_DB;
    delete process.env.ODOO_TOKEN;
  });
  const errorLog = t.mock.method(console, "error", () => {});
  let calls = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    return new Response('{"error":"boom"}', { status: 500 });
  });

  const { postOdooLeadNote } = await import("./leads.ts");
  const ok = await postOdooLeadNote(42, "hello");

  assert.equal(ok, false);
  assert.equal(calls, 2);
  assert.equal(errorLog.mock.callCount(), 2);
  const [firstLogLine] = errorLog.mock.calls[0].arguments;
  assert.match(String(firstLogLine), /lead 42/);
  fetchMock.mock.restore();
});

test("postOdooLeadNote succeeds on retry after transient failure", async (t) => {
  process.env.ODOO_URL = "https://odoo.test";
  process.env.ODOO_DB = "testdb";
  process.env.ODOO_TOKEN = "token";
  t.after(() => {
    delete process.env.ODOO_URL;
    delete process.env.ODOO_DB;
    delete process.env.ODOO_TOKEN;
  });
  t.mock.method(console, "error", () => {});
  let calls = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    if (calls === 1) return new Response("oops", { status: 502 });
    return new Response("[101]", { status: 200 });
  });

  const { postOdooLeadNote } = await import("./leads.ts");
  const ok = await postOdooLeadNote(43, "hello again");

  assert.equal(ok, true);
  assert.equal(calls, 2);
  fetchMock.mock.restore();
});

test("postOdooLeadNote does not retry after a timeout (duplicate-note risk)", async (t) => {
  process.env.ODOO_URL = "https://odoo.test";
  process.env.ODOO_DB = "testdb";
  process.env.ODOO_TOKEN = "token";
  t.after(() => {
    delete process.env.ODOO_URL;
    delete process.env.ODOO_DB;
    delete process.env.ODOO_TOKEN;
  });
  t.mock.method(console, "error", () => {});
  let calls = 0;
  const fetchMock = t.mock.method(globalThis, "fetch", async () => {
    calls += 1;
    throw new Error("odoo_crm.lead_message_post_timeout");
  });

  const { postOdooLeadNote } = await import("./leads.ts");
  const ok = await postOdooLeadNote(44, "maybe committed");

  assert.equal(ok, false);
  assert.equal(calls, 1);
  fetchMock.mock.restore();
});

test("formatLeadDescription includes GA client id and UTM attribution", async () => {
  const { formatLeadDescription } = await import("./leads.ts");
  const description = formatLeadDescription({
    email: "lead@example.com",
    sourceDetail: "contact_form",
    gaClientId: "1194917214.1689149133",
    utm: { source: "google", medium: "cpc", campaign: "brand", term: "", content: undefined },
  });
  assert.match(description, /GA Client ID: 1194917214\.1689149133/);
  assert.match(description, /UTM: source=google medium=cpc campaign=brand/);
  assert.doesNotMatch(description, /term=/);
});

test("formatLeadDescription omits attribution lines when absent", async () => {
  const { formatLeadDescription } = await import("./leads.ts");
  const description = formatLeadDescription({
    email: "lead@example.com",
    sourceDetail: "contact_form",
  });
  assert.doesNotMatch(description, /GA Client ID/);
  assert.doesNotMatch(description, /UTM:/);
});
