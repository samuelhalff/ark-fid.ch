import assert from "node:assert/strict";
import test from "node:test";

import { CASE_ACTIONS, isCaseAction } from "./actions";

test("only the known x-kqf-action values are accepted (S-F3)", () => {
  for (const action of CASE_ACTIONS) assert.equal(isCaseAction(action), true);
  assert.equal(CASE_ACTIONS.length, 8);
  for (const bad of ["", "none", "x".repeat(8000), "save ", "SAVE", "__proto__", "toString", "constructor"]) assert.equal(isCaseAction(bad), false);
});
