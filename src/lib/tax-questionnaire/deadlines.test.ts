import assert from "node:assert/strict";
import test from "node:test";

import { CANTON_DEADLINES, campaignStopDate, deadlinesFor } from "./deadlines.ts";

const base = { "start.years": ["2025"], "start.canton": "GE", "regime.residence": "ch", "regime.lumpSum": "no", "regime.sourceTax": "no" };
const byId = (list: ReturnType<typeof deadlinesFor>) => Object.fromEntries(list.map((d) => [d.id, d]));

test("table is sourced and dated", () => {
  for (const entry of CANTON_DEADLINES) {
    assert.match(entry.source, /^https:\/\//);
    assert.match(entry.verifiedOn, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("Geneva ordinary deadline 31.03 of the following year", () => {
  const d = byId(deadlinesFor(base));
  assert.equal(d.ordinary.date, "31.03.2026");
  assert.ok(d.ordinary.source);
  assert.equal(d.tou, undefined);
});

test("Vaud 15.03 and unverified cantons without a date", () => {
  assert.equal(byId(deadlinesFor({ ...base, "start.canton": "VD" })).ordinary.date, "15.03.2026");
  const zh = byId(deadlinesFor({ ...base, "start.canton": "ZH" })).ordinary;
  assert.equal(zh.date, null);
  assert.match(zh.note!.fr, /courrier/);
});

test("non-resident: note only", () => {
  const d = byId(deadlinesFor({ ...base, "start.canton": "ABROAD", "regime.residence": "abroad" }));
  assert.equal(d.ordinary.date, null);
});

test("source-taxed: 31 March forclusion, high", () => {
  const d = byId(deadlinesFor({ ...base, "regime.sourceTax": "yes" }));
  assert.equal(d.tou.date, "31.03.2026");
  assert.equal(d.tou.level, "high");
  assert.match(d.tou.note!.fr, /Non prolongeable/);
});

test("réclamation 30 days after the notice", () => {
  const d = byId(deadlinesFor({ ...base, "start.avisReceived": "yes", "start.avisDate": "15.09.2026" }));
  assert.equal(d.reclamation.date, "15.10.2026");
  const end = byId(deadlinesFor({ ...base, "start.avisReceived": "yes", "start.avisDate": "10.12.2026" }));
  assert.equal(end.reclamation.date, "09.01.2027");
});

test("staff extension overrides the ordinary deadline", () => {
  const d = byId(deadlinesFor(base, { extendedTo: "30.9.2026" }));
  assert.equal(d.extension.date, "30.09.2026");
  assert.equal(d.ordinary, undefined);
});

test("campaignStopDate", () => {
  assert.equal(campaignStopDate({ canton: "GE" }, 2025).toISOString().slice(0, 10), "2026-03-31");
  assert.equal(campaignStopDate({ canton: "VD" }, 2025).toISOString().slice(0, 10), "2026-03-15");
  assert.equal(campaignStopDate({ canton: "ZH" }, 2025).toISOString().slice(0, 10), "2026-03-31");
  assert.equal(campaignStopDate({ canton: "VD" }, 2025, "30.09.2026").toISOString().slice(0, 10), "2026-09-30");
  assert.equal(campaignStopDate({ canton: "VD", regime: "En Suisse · impôt à la source" }, 2025).toISOString().slice(0, 10), "2026-03-31");
  assert.equal(campaignStopDate({ ...base, "start.canton": "VD" }, 2025).toISOString().slice(0, 10), "2026-03-15");
});
