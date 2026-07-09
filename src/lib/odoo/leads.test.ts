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
