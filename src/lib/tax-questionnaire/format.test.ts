import assert from "node:assert/strict";
import test from "node:test";

import { maskDate, normaliseDate } from "./format.ts";

/** Types `keys` one at a time as the input would, feeding each result back. */
function type(keys: string, start = ""): string {
  let value = start;
  for (const key of keys) value = maskDate(value + key, value);
  return value;
}

test("digits typed on a numeric keypad get their dots", () => {
  assert.equal(type("0"), "0");
  assert.equal(type("01"), "01.");
  assert.equal(type("010"), "01.0");
  assert.equal(type("0103"), "01.03.");
  assert.equal(type("01032016"), "01.03.2016");
  assert.equal(type("010320169"), "01.03.2016");
});

test("backspace walks back through the dots", () => {
  assert.equal(maskDate("01", "01."), "01");
  assert.equal(maskDate("0", "01"), "0");
  assert.equal(maskDate("01.03", "01.03."), "01.03");
  assert.equal(maskDate("01.03.201", "01.03.2016"), "01.03.201");
  assert.equal(maskDate("", "0"), "");
});

test("a separator typed by hand closes its part", () => {
  assert.equal(type("1."), "01.");
  assert.equal(type("1.3."), "01.03.");
  assert.equal(type("1/3/2016"), "01.03.2016");
});

test("a pasted date is normalised", () => {
  assert.equal(maskDate("2016-03-01"), "01.03.2016");
  assert.equal(maskDate("1.3.2016"), "01.03.2016");
  assert.equal(maskDate(" 01/03/2016 "), "01.03.2016");
});

test("an impossible date is kept for the form to refuse, never rewritten into another day", () => {
  assert.equal(type("31022016"), "31.02.2016");
  assert.equal(normaliseDate("31.02.2016"), "31.02.2016");
});
