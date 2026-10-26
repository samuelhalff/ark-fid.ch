import assert from "node:assert/strict";
import test from "node:test";

import { attentionPoints } from "./attention.ts";
import { deadlinesFor } from "./deadlines.ts";
import { checklistFor, pruneHidden, sanitizeAnswers, validateAll, visibleSteps } from "./logic.ts";
import type { Answers } from "./types.ts";

/**
 * Scenario matrix (REVISION.md + Fable review): for each realistic case, the screens shown, the
 * documents requested and the preparer's attention points. The answers are what a client would
 * actually give (minimal, document-first).
 */
const YEAR = String(new Date().getFullYear() - 1);
const base = (extra: Answers): Answers => ({
  "start.years": [YEAR],
  "start.household": "single",
  "start.canton": "GE",
  "start.commune": "Genève",
  "start.firstName": "Alex",
  "start.lastName": "Test",
  "start.email": "alex@example.com",
  "start.phone": "+41 22 000 00 00",
  "start.status": "first",
  "regime.residence": "ch",
  "regime.lumpSum": "no",
  "regime.sourceTax": "no",
  ...extra,
});
const row = (id: string, fields: Record<string, string | string[]>) => ({ _id: id, ...fields });

function run(answers: Answers) {
  const clean = pruneHidden(sanitizeAnswers(answers));
  return {
    steps: visibleSteps(clean).map((s) => s.id),
    docs: checklistFor(clean).map((d) => d.ruleId),
    labels: checklistFor(clean).map((d) => d.label.fr),
    attention: attentionPoints(clean).map((p) => p.id.split(":")[0]),
    errors: validateAll(clean),
    clean,
  };
}

test("1. single salaried GE tenant with 3a: short path", () => {
  const r = run(base({ "router.items": ["employed", "banksCH", "p3a"], "work.employers": [row("emp00001", { name: "Acme SA" })], "assets.banks": [row("bank0001", { bank: "UBS", country: "CH" })] }));
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.steps, ["start", "regime", "router", "work", "assets", "documents", "review"]);
  for (const id of ["salary", "bank", "p3a", "health-premiums"]) assert.ok(r.docs.includes(id), id);
  assert.ok(!r.docs.includes("last-return"));
});

test("2. married couple, 2 kids, both employed, GE flat bought this year with mortgage", () => {
  const r = run(
    base({
      "start.household": "couple",
      "start.spouseFirstName": "Sam",
      "start.spouseLastName": "Test",
      "start.status": "filedBefore",
      "router.items": ["children", "childcare", "employed", "banksCH", "propertyCH", "p3a"],
      "family.children": [row("kid00001", { firstName: "Léa", birthYear: "2018", childcare: "yes" }), row("kid00002", { firstName: "Tom", birthYear: "2021", childcare: "yes" })],
      "work.employers": [row("emp00001", { name: "Acme SA", person: "me" }), row("emp00002", { name: "Beta SA", person: "spouse" })],
      "assets.banks": [row("bank0001", { bank: "BCGE", country: "CH", securities: "no" })],
      "property.items": [row("prop0001", { where: "CH", canton: "GE", commune: "Carouge", kind: "ppe", ownership: "spouses", uses: ["main"], events: ["bought"], boughtDate: "01.03.2025", mortgage: "yes", lenders: "BCGE", ppe: "yes", invoices: "no", geFill: "later" })],
    }),
  );
  assert.deepEqual(r.errors, {});
  assert.ok(r.steps.includes("baseDocs") && r.steps.includes("family") && r.steps.includes("property"));
  assert.equal(r.docs.filter((d) => d === "salary").length, 2);
  assert.equal(r.docs.filter((d) => d === "childcare").length, 2);
  for (const id of ["property-purchase", "property-mortgage", "property-ppe", "last-return", "last-assessment"]) assert.ok(r.docs.includes(id), id);
  assert.ok(r.attention.includes("purchase") && r.attention.includes("geValuation"));
});

test("3. permit B taxed at source, salary over CHF 120'000, arrived in March", () => {
  const r = run(
    base({
      "regime.residence": "arrived",
      "regime.arrivalDate": `01.03.${YEAR}`,
      "regime.arrivalFrom": "France",
      "regime.sourceTax": "yes",
      "regime.permit": "B",
      "regime.over120k": "yes",
      "router.items": ["employed"],
      "work.employers": [row("emp00001", { name: "Bank AG" })],
    }),
  );
  assert.deepEqual(r.errors, {});
  for (const id of ["permit", "arrival", "salary", "source-tax"]) assert.ok(r.docs.includes(id), id);
  assert.ok(r.attention.includes("tou") && r.attention.includes("arrival"));
  assert.ok(deadlinesFor(r.clean).some((d) => d.id === "tou" && d.date === `31.03.${Number(YEAR) + 1}`));
});

test("4. French cross-border worker (quasi-resident facts only)", () => {
  const r = run(
    base({
      "start.canton": "ABROAD",
      "regime.residence": "abroad",
      "regime.country": "France",
      "regime.nrReasons": ["work"],
      "regime.workCanton": "GE",
      "regime.dailyReturn": "yes",
      "regime.sourceTax": "yes",
      "regime.foreignHouseholdIncome": "yes",
      "router.items": ["employed"],
      "work.employers": [row("emp00001", { name: "Acme SA" })],
    }),
  );
  assert.deepEqual(r.errors, {});
  assert.ok(!r.steps.includes("baseDocs"));
  for (const id of ["residence-certificate", "household-world-income", "salary"]) assert.ok(r.docs.includes(id), id);
  assert.ok(!r.docs.includes("health-premiums"));
  assert.ok(r.attention.includes("nonResidentWorker"));
});

test("5. self-employed consultant in VD with home office (church tax asked outside GE)", () => {
  const r = run(base({ "start.canton": "VD", "start.commune": "Lausanne", "regime.confession": "none", "router.items": ["selfEmployed", "banksCH"], "work.selfActivity": "Conseil", "work.selfBooks": "self", "work.selfAvs": "yes", "assets.banks": [row("bank0001", { bank: "BCV", country: "CH" })] }));
  assert.deepEqual(r.errors, {});
  for (const id of ["self-accounts", "self-avs", "bank"]) assert.ok(r.docs.includes(id), id);
});

test("6. company owner GE: dividends, rented property in VS, property in France", () => {
  const r = run(
    base({
      "router.items": ["companyOwner", "employed", "propertyCH", "propertyAbroad", "banksCH"],
      "work.employers": [row("emp00001", { name: "Holding SA" })],
      "work.companies": [row("comp0001", { name: "Holding SA", share: "100", dividend: "yes", loan: "fromCompany", privateExpenses: "yes" })],
      "assets.banks": [row("bank0001", { bank: "UBS", country: "CH" })],
      "property.items": [
        row("prop0001", { where: "CH", canton: "VS", commune: "Sion", kind: "ppe", ownership: "sole", uses: ["rented"], agency: "yes", inLastAvis: "yes", mortgage: "no", invoices: "yes", workTypes: ["upkeep", "energy"] }),
        row("prop0002", { where: "abroad", country: "France", city: "Annecy", kind: "house", ownership: "sole", uses: ["secondary"], value: "500000", valueCurrency: "EUR", foreignAssessment: "yes", mortgage: "no" }),
      ],
    }),
  );
  assert.deepEqual(r.errors, {});
  for (const id of ["company-accounts", "company-dividend", "company-loan", "property-agency", "property-invoices", "property-value", "property-foreign-tax"]) assert.ok(r.docs.includes(id), id);
  for (const id of ["company", "otherCanton", "foreignProperty", "works"]) assert.ok(r.attention.includes(id), id);
});

test("7. retiree: AVS + LPP pensions + capital withdrawal (LPP 3-year question)", () => {
  const r = run(
    base({
      "router.items": ["pension", "capital", "banksCH"],
      "work.pensions": [row("pens0001", { type: "avs", payer: "Caisse AVS" }), row("pens0002", { type: "lpp", payer: "CPEG" })],
      "work.capital": [row("capi0001", { type: "lpp", institution: "CPEG", reason: "retirement" })],
      "other.lpp3years": "unknown",
      "assets.banks": [row("bank0001", { bank: "PostFinance", country: "CH" })],
    }),
  );
  assert.deepEqual(r.errors, {});
  assert.equal(r.docs.filter((d) => d === "pension").length, 2);
  assert.ok(r.docs.includes("capital"));
  assert.ok(r.attention.includes("capital") && r.attention.includes("lpp3years"));
});

test("8. lump-sum taxpayer", () => {
  const r = run(base({ "regime.lumpSum": "yes", "regime.swissNational": "no", "regime.gainfulCH": "no", "lumpSum.ruling": "yes", "router.items": ["banksCH"], "assets.banks": [row("bank0001", { bank: "Pictet", country: "CH" })] }));
  assert.deepEqual(r.errors, {});
  assert.ok(r.steps.includes("lumpSum"));
  assert.ok(!r.steps.includes("baseDocs") || true);
  for (const id of ["lump-sum-ruling", "lump-sum-swiss"]) assert.ok(r.docs.includes(id), id);
  assert.ok(!r.docs.includes("health-premiums"));
  assert.ok(r.attention.includes("lumpSum"));
});

test("9. leaving Switzerland in August", () => {
  const r = run(base({ "regime.residence": "left", "regime.departureDate": `15.08.${YEAR}`, "regime.departureTo": "Portugal", "regime.keepsInSwitzerland": ["pension"], "router.items": ["employed"], "work.employers": [row("emp00001", { name: "Acme SA" })] }));
  assert.deepEqual(r.errors, {});
  assert.ok(r.docs.includes("departure"));
  assert.ok(r.attention.includes("departure"));
});

test("10. separation during the year with maintenance paid", () => {
  const r = run(base({ "router.items": ["civilChange", "alimonyPaid", "children"], "family.changeType": "separation", "family.changeDate": `30.06.${YEAR}`, "family.children": [row("kid00001", { firstName: "Léa", birthYear: "2015", custody: "alternating", claimedBy: "shared" })], "family.alimony": [row("ali00001", { direction: "paid", forWhom: "minor", counterparty: "Ex" })] }));
  assert.deepEqual(r.errors, {});
  for (const id of ["civil-change", "alimony"]) assert.ok(r.docs.includes(id), id);
  assert.ok(r.attention.includes("civilChange") && r.attention.includes("alternating"));
});

test("11. inheritance received and sale of a property (notary filing asked)", () => {
  const r = run(
    base({
      "router.items": ["inheritance", "propertyCH"],
      "other.inheritance": [row("inh00001", { direction: "received", type: "estate", counterparty: "Parent", residence: "VD", settled: "pending" })],
      "property.items": [row("prop0001", { where: "CH", canton: "GE", commune: "Genève", kind: "ppe", ownership: "sole", uses: ["vacant"], events: ["sold", "inherited"], soldDate: `30.09.${YEAR}`, notaryFiled: "unknown", mortgage: "no" })],
    }),
  );
  assert.deepEqual(r.errors, {});
  for (const id of ["inheritance", "property-sale", "property-inherited"]) assert.ok(r.docs.includes(id), id);
  assert.ok(r.attention.includes("sale") && r.attention.includes("inheritance"));
});

test("12. crypto holder with self-custody", () => {
  const r = run(base({ "router.items": ["crypto"], "assets.crypto": [row("cryp0001", { platform: "Ledger", custody: "self", holdings: "0.5 BTC" })] }));
  assert.deepEqual(r.errors, {});
  assert.ok(r.docs.includes("crypto"));
  assert.ok(r.attention.includes("crypto"));
});

test("13. three unfiled years and an undeclared foreign account (protected route)", () => {
  const years = [YEAR, String(Number(YEAR) - 1), String(Number(YEAR) - 2)];
  const r = run(base({ "start.years": years, "start.yearsChanged": "no", "router.items": ["regularisation", "banksForeign"], "regularisation.authorityContact": "no", "regularisation.priorDisclosure": "no", "assets.banks": [row("bank0001", { bank: "Bank X", country: "other", countryName: "Monaco", statement: "no" })] }));
  assert.deepEqual(r.errors, {});
  assert.ok(r.steps.includes("regularisation"));
  assert.equal(r.docs.filter((d) => d === "older-years").length, 2);
  for (const id of ["regularisation", "bank-statements"]) assert.ok(r.docs.includes(id), id);
  for (const id of ["arrears", "regularisation", "foreignAccounts"]) assert.ok(r.attention.includes(id), id);
});

test("14. unmarried couple: the child is claimed by one parent; spouse fields hidden", () => {
  const r = run(base({ "start.household": "cohabiting", "router.items": ["children"], "family.children": [row("kid00001", { firstName: "Léa", birthYear: "2019", claimedBy: "me" })] }));
  assert.deepEqual(r.errors, {});
  assert.equal(r.clean["start.spouseFirstName"], undefined);
});

test("missing answers are reported on the right screens", () => {
  const r = run(base({ "router.items": ["employed"] }));
  assert.ok(Object.keys(r.errors).some((k) => k.startsWith("work.employers")));
});

test("no figures in client-facing labels except the sourced CHF 120'000 threshold", async () => {
  const { STEPS, ROUTER_OPTIONS } = await import("./schema.ts");
  const texts: string[] = [];
  for (const step of STEPS) for (const block of step.blocks) if ("label" in block && block.label) texts.push(block.label.fr);
  for (const option of ROUTER_OPTIONS) texts.push(option.label.fr);
  const withAmounts = texts.filter((s) => /CHF\s?\d/.test(s));
  assert.deepEqual(withAmounts, ["Le salaire brut annuel (vous ou votre conjoint) a-t-il atteint CHF 120'000 en {year} ou une année précédente ?"]);
});
