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

test("formatLeadDescription includes first-party attribution lines", async () => {
  const { formatLeadDescription } = await import("./leads.ts");
  const description = formatLeadDescription({
    email: "lead@example.com",
    sourceDetail: "contact_form",
    landingPage: "/fr/services/",
    gclid: "abc<script>",
    pagesViewed: ["/fr/services/", "/fr/contact/"],
  });
  assert.match(description, /Landing page: \/fr\/services\//);
  assert.match(description, /GCLID: abcscript/);
  assert.match(description, /Pages viewed: \/fr\/services\/ > \/fr\/contact\//);
});

test("buildOdooLeadValues adds the tag via a link command", () => {
  const values = buildOdooLeadValues(
    { email: "a@example.com", sourceDetail: "contact_form", tagId: 7 },
    new Set(["tag_ids"]),
  );
  assert.deepEqual(values.tag_ids, [[4, 7]]);
  const none = buildOdooLeadValues(
    { email: "a@example.com", sourceDetail: "contact_form" },
    new Set(["tag_ids"]),
  );
  assert.equal("tag_ids" in none, false);
});

async function runCreate(
  t: test.TestContext,
  tagResponse: () => Response,
  tagName: string,
) {
  process.env.ODOO_URL = `https://odoo-${tagName}.example.com`;
  process.env.ODOO_DB = "db";
  process.env.ODOO_TOKEN = "tok";
  process.env.ODOO_LEAD_TAG_NAME = tagName;
  const { createOdooWebsiteLead } = await import("./leads.ts");
  const bodies: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    if (url.endsWith("/crm.lead/fields_get")) {
      return new Response(JSON.stringify({ tag_ids: {}, name: {} }));
    }
    if (url.endsWith("/res.users/search_read") || url.endsWith("/utm.source/search_read")) {
      return new Response(JSON.stringify([]));
    }
    if (url.endsWith("/crm.tag/search_read")) {
      bodies.push(body);
      return tagResponse();
    }
    if (url.endsWith("/crm.lead/create")) {
      bodies.push(body);
      return new Response(JSON.stringify([42]));
    }
    throw new Error(`unexpected ${url}`);
  });
  const id = await createOdooWebsiteLead({
    email: "x@example.com",
    sourceDetail: "contact_form",
  });
  return { id, bodies };
}

test("createOdooWebsiteLead tags the lead with the exact-name crm.tag", async (t) => {
  const { id, bodies } = await runCreate(
    t,
    () => new Response(JSON.stringify([{ id: 9, name: "tagok" }])),
    "tagok",
  );
  assert.equal(id, 42);
  assert.deepEqual(bodies[0].domain, [["name", "=", "tagok"]]);
  const vals = (bodies[1].vals_list as Record<string, unknown>[])[0];
  assert.deepEqual(vals.tag_ids, [[4, 9]]);
});

test("createOdooWebsiteLead skips the tag when missing", async (t) => {
  const { id, bodies } = await runCreate(
    t,
    () => new Response(JSON.stringify([])),
    "tagmissing",
  );
  assert.equal(id, 42);
  const vals = (bodies[1].vals_list as Record<string, unknown>[])[0];
  assert.equal("tag_ids" in vals, false);
});

test("createOdooWebsiteLead still creates the lead when the tag lookup fails", async (t) => {
  const { id, bodies } = await runCreate(
    t,
    () => new Response("boom", { status: 500 }),
    "tagfail",
  );
  assert.equal(id, 42);
  const vals = (bodies[1].vals_list as Record<string, unknown>[])[0];
  assert.equal("tag_ids" in vals, false);
});
