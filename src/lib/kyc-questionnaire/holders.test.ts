import assert from "node:assert/strict";
import test from "node:test";
import { missingAnswers, nestedKeyLabel, pruneHidden, sanitizeAnswers, validateAll } from "./engine";
import { anyUnknown, computedText, controllers25, formatPercent, holderLines, holdersAt, parsePercent, prunePeople, referencedPersonIds, showsComputedLine, stakes, withHoldersAt } from "./holders";
import { needsManager, sectionBPersons } from "./schema";
import { holdersFromOldLists, upgradeAnswers } from "./upgrade";
import type { Answers, Row } from "./types";

const facts = { birthDate: "01.02.1970", nationality: "Suisse", address: "Rue du Rhône 1, 1204 Genève", country: "Suisse" };
const p = (id: string, firstName: string, lastName: string): Row => ({ _id: id, firstName, lastName, ...facts });
const person = (id: string, ref: string, percent: string): Row => ({ _id: id, kind: "person", person: ref, percent });
const company = (id: string, name: string, percent: string, holders: Row[] = [], extra: Record<string, string> = {}): Row => ({ _id: id, kind: "company", name, country: "Suisse", percent, holders, ...extra });

// West Bay SA ← Holding X SA 100 % ← Mme Y 60 %, M. Z 40 % (the mockup's example).
const westBay: Answers = {
  route: "pm-op",
  "a.listed": "no",
  "b.persons": [p("pery00001", "Yvonne", "Y"), p("perz00001", "Zoé", "Z"), p("pers00001", "Samuel", "Halff")],
  "b.holders": [company("hldx00001", "Holding X SA", "100", [person("hldy00001", "pery00001", "60"), person("hldz00001", "perz00001", "40")], { uid: "CHE-123.456.789" })],
  "b.qOther": "no",
};

test("percent: comma, %, spaces; out of range is not a share", () => {
  assert.equal(parsePercent("60"), 60);
  assert.equal(parsePercent("33,3 %"), 33.3);
  assert.equal(parsePercent("101"), null);
  assert.equal(parsePercent("abc"), null);
  assert.equal(formatPercent(33.333, "fr"), "33,33 %");
  assert.equal(formatPercent(60, "en"), "60%");
});

test("25 %: shares multiplied along the chain", () => {
  assert.deepEqual(stakes(westBay), [
    { personId: "pery00001", percent: 60, indirect: true },
    { personId: "perz00001", percent: 40, indirect: true },
  ]);
  assert.equal(computedText(westBay, true)?.fr, "Yvonne Y (60 %), Zoé Z (40 %)");
});

test("25 %: one person by several paths is summed, below the threshold is not a controller", () => {
  // Samuel 15 % directly and 50 % of a holding with 30 %: 15 + 15 = 30 %. Yvonne 50 % of 30 % = 15 %.
  const a: Answers = {
    ...westBay,
    "b.holders": [
      person("hlds00001", "pers00001", "15"),
      company("hldh00001", "H SA", "30", [person("hlds00002", "pers00001", "50"), person("hldy00001", "pery00001", "50")]),
      person("hldz00001", "perz00001", "55"),
    ],
  };
  const list = controllers25(a);
  assert.deepEqual(list.map((s) => [s.personId, Math.round(s.percent * 100) / 100, s.indirect]), [
    ["perz00001", 55, false],
    ["pers00001", 30, true],
  ]);
  assert.ok(!list.some((s) => s.personId === "pery00001"), "15 % is under 25 %");
});

test("25 %: three levels deep; below them a company's holders are free text and count for nothing", () => {
  const deep: Answers = {
    ...westBay,
    "b.holders": [company("lvl1aaaaa", "A SA", "100", [company("lvl2aaaaa", "B SA", "50", [person("lvl3ppppp", "pery00001", "100"), company("lvl3ccccc", "C Ltd", "0", [], { owners: "M. Z, 100 %" })])])],
  };
  assert.deepEqual(stakes(deep).map((s) => [s.personId, s.percent]), [["pery00001", 50]]);
  assert.deepEqual(validateAll(pruneHidden(deep))["b.holders[lvl1aaaaa].holders[lvl2aaaaa].holders[lvl3ccccc].owners"], undefined);
  const noOwners = withHoldersAt(deep, ["lvl1aaaaa", "lvl2aaaaa"], [company("lvl3ccccc", "C Ltd", "100")]);
  assert.equal(validateAll(pruneHidden(noOwners))["b.holders[lvl1aaaaa].holders[lvl2aaaaa].holders[lvl3ccccc].owners"], "required");
});

test("blank or broken shares count as nothing and never block the computation", () => {
  const a: Answers = { ...westBay, "b.holders": [person("hlds00001", "pers00001", "")] };
  assert.deepEqual(stakes(a), [{ personId: "pers00001", percent: 0, indirect: false }]);
  assert.deepEqual(controllers25(a), []);
});

test("the computed line shows only when it adds someone held through a company", () => {
  assert.equal(showsComputedLine(westBay, true), true);
  const direct: Answers = { ...westBay, "b.holders": [person("hlds00001", "pers00001", "100")] };
  assert.equal(showsComputedLine(direct, true), false, "Samuel at 100 % is already the list's own line");
});

test("unknown at any level; nested list asked unless unknown", () => {
  assert.equal(anyUnknown(westBay), false);
  const unknownHolding: Answers = { ...westBay, "b.holders": [company("hldx00001", "Holding X SA", "100", [], { unknown: "yes" })] };
  assert.equal(anyUnknown(unknownHolding), true);
  assert.equal(validateAll(pruneHidden(unknownHolding))["b.holders[hldx00001].holders"], undefined);
  const empty: Answers = { ...westBay, "b.holders": [company("hldx00001", "Holding X SA", "100", [])] };
  assert.equal(validateAll(pruneHidden(empty))["b.holders[hldx00001].holders"], "min_rows");
  assert.equal(nestedKeyLabel("b.holders[hldx00001].holders", empty, "fr"), "Qui détient cette société ? (Holding X SA)");
});

test("an unknown holding with nobody at 25 %: the most senior managers, never a block", () => {
  const a: Answers = { ...westBay, "b.holders": [company("hldx00001", "Holding X SA", "100", [], { unknown: "yes" })] };
  assert.equal(needsManager(a), true);
  assert.equal(needsManager(westBay), false);
});

test("missing answers of nested rows are worded with their path for the review screen", () => {
  const a: Answers = { ...westBay, "b.holders": [company("hldx00001", "Holding X SA", "100", [person("hldy00001", "pery00001", "")])] };
  const missing = missingAnswers(a).map((m) => m.key);
  assert.ok(missing.includes("b.holders[hldx00001].holders[hldy00001].percent"));
  assert.equal(nestedKeyLabel("b.holders[hldx00001].holders[hldy00001].percent", a, "fr"), "Part détenue (Holding X SA › Yvonne Y)");
  assert.equal(nestedKeyLabel("b.holders[hldx00001].holders[hldy00001].percent", a, "en"), "Share held (Holding X SA › Yvonne Y)");
  const noBirth: Answers = { ...a, "b.persons": [{ _id: "pery00001", firstName: "Yvonne", lastName: "Y" }] };
  assert.equal(nestedKeyLabel("b.persons[pery00001].birthDate", noBirth, "fr"), "Date de naissance (Y Yvonne)");
});

test("people facts once: unreferenced persons are dropped, dangling pointers asked again", () => {
  assert.deepEqual([...referencedPersonIds(westBay)].sort(), ["pery00001", "perz00001"]);
  const pruned = pruneHidden(westBay);
  assert.deepEqual((pruned["b.persons"] as Row[]).map((r) => r._id), ["pery00001", "perz00001"], "Samuel is named by nothing");
  const dangling = prunePeople({ ...westBay, "b.holders": [person("hldq00001", "gone00001", "100")], "b.managers": ["gone00001"] });
  assert.equal((dangling["b.holders"] as Row[])[0].person, undefined);
  assert.equal(dangling["b.managers"], undefined);
});

test("sanitising keeps the nested tree with known fields and valid ids only", () => {
  const clean = sanitizeAnswers({
    "b.holders": [{ _id: "hldx00001", kind: "company", name: "X", percent: "100", evil: "<script>", holders: [{ _id: "BAD", kind: "person" }, { _id: "hldy00001", kind: "person", person: "pery00001", percent: "60" }] }],
    "b.managers": ["pery00001", "NOT AN ID"],
  });
  const holders = clean["b.holders"] as Row[];
  assert.equal(holders[0].evil, undefined);
  assert.deepEqual((holders[0].holders as Row[]).map((r) => r._id), ["hldy00001"]);
  assert.deepEqual(clean["b.managers"], ["pery00001"]);
});

test("complete West Bay answers have nothing missing in section B", () => {
  const keys = Object.keys(validateAll(pruneHidden(westBay))).filter((k) => k.startsWith("b."));
  assert.deepEqual(keys, ["b.forThird", "b.transparency"]);
});

test("documents: the IDs asked are the persons at 25 % or more on an operating company, everyone behind a non-operating one", () => {
  const small: Answers = { ...westBay, "b.holders": [company("hldx00001", "Holding X SA", "100", [person("hldy00001", "pery00001", "80"), person("hldz00001", "perz00001", "20")])] };
  assert.deepEqual(sectionBPersons(small).map((x) => x.row._id), ["pery00001"]);
  assert.deepEqual(sectionBPersons({ ...small, route: "pm-nonop" }).map((x) => x.row._id), ["pery00001", "perz00001"]);
});

test("indented lines for the review screen, the PDF and Ark's mirror", () => {
  assert.deepEqual(holderLines(westBay).map((l) => [l.depth, l.text.fr]), [
    [1, "Holding X SA · Société · Suisse · CHE-123.456.789 · 100 %"],
    [2, "Yvonne Y · Personne · 60 %"],
    [2, "Zoé Z · Personne · 40 %"],
  ]);
  assert.deepEqual(holdersAt(westBay, ["hldx00001"]).map((r) => r._id), ["hldy00001", "hldz00001"]);
});

test("a draft's old 25 % list becomes persons and « Personne » holders, once (Cadence upgrade.py does the same)", () => {
  const old: Answers = {
    route: "pm-op",
    "b.q25": "yes",
    "b.controllers25": [{ _id: "ctl0001", lastName: "Dupont", firstName: "Jean", ...facts, percent: "60" }, { _id: "ctl0002", lastName: "dupont", firstName: "jean", percent: "10" }],
  };
  const up = upgradeAnswers(old, { infer: true });
  assert.deepEqual(up["b.persons"], [{ _id: "ctl0001p", lastName: "Dupont", firstName: "Jean", ...facts }]);
  assert.deepEqual(up["b.holders"], [{ _id: "ctl0001h", kind: "person", person: "ctl0001p", percent: "60" }]);
  assert.ok(up["b.controllers25"], "the old answer stays, retired");
  assert.deepEqual(upgradeAnswers(up, { infer: true }), up, "idempotent");
  assert.deepEqual(upgradeAnswers(old)["b.holders"], undefined, "a sent form is read as sent");
  const ubos = holdersFromOldLists({ route: "pm-nonop", "b.ubos": [{ _id: "ubo0001", lastName: "Y", firstName: "A", wealth: "Héritage", share: "50 %" }] });
  assert.deepEqual(ubos["b.holders"], [{ _id: "ubo0001h", kind: "person", person: "ubo0001p", percent: "50" }]);
  assert.equal((ubos["b.persons"] as Row[])[0].wealth, "Héritage");
  const unknown = upgradeAnswers({ route: "pm-op", "b.q25": "no", "b.qOther": "unidentified" }, { infer: true });
  assert.equal(unknown["b.holdersUnknown"], "yes");
  assert.equal("b.qOther" in unknown, false);
});

test("a company said unknown: its old holders count for nothing, so the managers are asked (review 2026-11-15)", () => {
  const a: Answers = { ...westBay, "b.holders": [company("hldx00001", "Holding X SA", "100", [person("hldy00001", "pery00001", "60")], { unknown: "yes" })] };
  assert.deepEqual(stakes(a), []);
  assert.equal(needsManager(a), true, "the same answer as the server, which prunes those holders");
  assert.ok(!referencedPersonIds(a).has("pery00001"));
});

test("a share is accepted only as the 25 % computation reads it", () => {
  const bad = { ...westBay, "b.holders": [person("hlds00001", "pers00001", "CHF 50")] };
  assert.equal(validateAll(pruneHidden(bad))["b.holders[hlds00001].percent"], "invalid_percent");
  const good = { ...westBay, "b.holders": [person("hlds00001", "pers00001", "33,5 %")] };
  assert.equal(validateAll(pruneHidden(good))["b.holders[hlds00001].percent"], undefined);
});
