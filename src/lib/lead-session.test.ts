import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSyntheticLeadSession,
  isSyntheticLeadId,
  shouldBypassLeadPersistence,
} from "./lead-session.ts";

test("buildSyntheticLeadSession uses the Odoo lead id in the synthetic lead id", () => {
  const session = buildSyntheticLeadSession(42);

  assert.equal(session.leadId, "odoo-42");
  assert.equal(typeof session.leadToken, "string");
  assert.equal(session.leadToken.length, 48);
});

test("buildSyntheticLeadSession falls back to a timestamped id when no Odoo id exists", () => {
  const session = buildSyntheticLeadSession();

  assert.match(session.leadId, /^synthetic-\d+$/);
  assert.equal(typeof session.leadToken, "string");
  assert.equal(session.leadToken.length, 48);
});

test("isSyntheticLeadId only matches degraded lead ids", () => {
  assert.equal(isSyntheticLeadId("odoo-42"), true);
  assert.equal(isSyntheticLeadId("synthetic-1750000000000"), true);
  assert.equal(isSyntheticLeadId("123"), false);
  assert.equal(isSyntheticLeadId(undefined), false);
});

test("shouldBypassLeadPersistence allows internal and synthetic sessions", () => {
  assert.equal(
    shouldBypassLeadPersistence({ internalUser: true, leadId: "123" }),
    true,
  );
  assert.equal(
    shouldBypassLeadPersistence({ internalUser: false, leadId: "odoo-42" }),
    true,
  );
  assert.equal(
    shouldBypassLeadPersistence({ internalUser: false, leadId: "123" }),
    false,
  );
});
