import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveGoogleRating, formatRating, pluralCategory } from "./google-rating.ts";

const now = Date.parse("2026-11-23T12:00:00Z");
const ok = { rating: 5, count: 5, fetchedAt: "2026-11-23T10:00:00Z", url: "https://maps.google.com/?cid=1" };

test("fresh value is shown", () => {
  assert.deepEqual(resolveGoogleRating(ok, now)?.count, 5);
});
test("older than 60 days is hidden", () => {
  assert.equal(resolveGoogleRating({ ...ok, fetchedAt: "2026-09-20T10:00:00Z" }, now), null);
  assert.ok(resolveGoogleRating({ ...ok, fetchedAt: "2026-09-25T10:00:00Z" }, now));
});
test("malformed values are hidden", () => {
  for (const bad of [null, {}, { ...ok, rating: 0 }, { ...ok, rating: 6 }, { ...ok, count: 0 }, { ...ok, count: 2.5 }, { ...ok, fetchedAt: "x" }]) {
    assert.equal(resolveGoogleRating(bad, now), null);
  }
});
test("non-https url falls back to the profile", () => {
  assert.match(resolveGoogleRating({ ...ok, url: "javascript:alert(1)" }, now)!.url, /^https:\/\/maps\.google\.com/);
});
test("locale formatting and plurals", () => {
  assert.equal(formatRating(5, "fr"), "5,0");
  assert.equal(formatRating(4.7, "en"), "4.7");
  assert.equal(pluralCategory(1, "en"), "One");
  assert.equal(pluralCategory(5, "en"), "Other");
});
