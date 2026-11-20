import assert from "node:assert/strict";
import test from "node:test";

import { CASE_ACTIONS, isCaseAction } from "./actions.ts";

test("only the known x-tqf-action values are accepted", () => {
  for (const action of CASE_ACTIONS) assert.equal(isCaseAction(action), true);
  assert.equal(CASE_ACTIONS.length, 10);
  for (const bad of ["", "unknown", "x".repeat(8000), "save ", "SAVE", "__proto__", "toString", "constructor"]) assert.equal(isCaseAction(bad), false);
});
