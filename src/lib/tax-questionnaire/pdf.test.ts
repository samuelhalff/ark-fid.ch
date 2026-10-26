import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import test from "node:test";
import { checklistFor, pruneHidden } from "./logic.ts";
import { buildPdf, toWinAnsi } from "./server/pdf.ts";
import type { DocResult, SubmissionRecord } from "./server/excel.ts";
import type { Answers } from "./types.ts";

/** Married couple in Geneva, 2 children, both employed, flat bought this year with a mortgage, UBS + BCGE, 3a. */
export const coupleGeneva: Answers = {
  "start.years": ["2025"],
  "start.household": "couple",
  "start.spouseAbroad": "no",
  "start.canton": "GE",
  "start.commune": "Carouge",
  "start.firstName": "Claire",
  "start.lastName": "Dupont",
  "start.spouseFirstName": "Marc",
  "start.spouseLastName": "Dupont",
  "start.email": "claire.dupont@example.ch",
  "start.phone": "+41 22 000 00 00",
  "start.status": "filedBefore",
  "start.previousPreparer": "Fiduciaire Léman",
  "start.avisReceived": "no",
  "regime.residence": "ch",
  "regime.cantonMove": "no",
  "regime.lumpSum": "no",
  "regime.sourceTax": "no",
  "router.items": ["children", "childcare", "employed", "banksCH", "securities", "propertyCH", "p3a", "donations"],
  "family.children": [
    { _id: "child00001", firstName: "Léa", birthYear: "2016", activity: "school", custody: "us", childcare: "yes" },
    { _id: "child00002", firstName: "Hugo", birthYear: "2020", activity: "preschool", custody: "us", childcare: "yes" },
  ],
  "work.employers": [
    { _id: "empl000001", name: "Banque Pictet & Cie SA", person: "me" },
    { _id: "empl000002", name: "Hôpitaux Universitaires de Genève", person: "spouse" },
  ],
  "work.actualCosts": "no",
  "assets.banks": [
    { _id: "bank000001", bank: "UBS", country: "CH", securities: "yes" },
    { _id: "bank000002", bank: "Banque Cantonale de Genève", country: "CH", securities: "no" },
  ],
  "assets.foreignWithholding": "yes",
  "assets.trading": "no",
  "property.items": [
    {
      _id: "prop000001",
      where: "CH",
      canton: "GE",
      commune: "Carouge",
      address: "Rue Ancienne 12",
      kind: "ppe",
      ownership: "spouses",
      uses: ["main"],
      events: ["bought"],
      boughtDate: "15.04.2025",
      mortgage: "yes",
      lenders: "BCGE",
      amortisation: "indirect",
      privateLoan: "no",
      ppe: "yes",
      invoices: "no",
      geFill: "now",
      geBuilt: "1998",
      geArea: "112",
      geRooms: "5",
      geType: "flat",
      geOccupants: "4",
      geComfort: ["insulation", "doubleGlazing", "centralHeating", "kitchen", "twoBathrooms"],
      geNuisances: [],
      geLocation: "good",
    },
  ],
  "review.deadline": "extended",
  "review.extendedTo": "30.09.2026",
  "review.comments": "Nous avons acheté l’appartement en avril — merci de vérifier les frais de notaire ≥ CHF 30'000 ✓ 🏠.",
  "review.reminder": "yes",
};

export function recordFor(answers: Answers, docsStatus: (key: string, i: number) => DocResult["status"] = (_k, i) => (i % 3 === 0 ? "uploaded" : i % 3 === 1 ? "later" : "missing")): SubmissionRecord {
  const pruned = pruneHidden(answers);
  const docs: DocResult[] = checklistFor(pruned).map((item, i) => {
    const status = docsStatus(item.key, i);
    return {
      item,
      status,
      files: status === "uploaded" ? [{ id: `f${i}`, name: `[${item.code}] ${item.label.fr.slice(0, 40)} - scan.pdf`, size: 120_000, webUrl: "https://example.sharepoint.com/x", folder: "04 Comptes et placements" }] : [],
    };
  });
  return {
    sid: "a1b2c3d4e5",
    clientKey: "0123456789abcdef01234567",
    locale: "fr",
    submittedAt: new Date("2026-03-02T09:15:00Z"),
    answers: pruned,
    docs,
    extras: [{ id: "x1", name: "Courrier AFC 2025.pdf", size: 50_000, webUrl: "", folder: "10 Documents complémentaires" }],
    flagged: [{ file: { id: "bad", name: "setup.pdf", size: 4000, webUrl: "", folder: "_A verifier" }, reason: "executable (MZ)" }],
    folderName: "DUPONT Claire - 2026-03-02 - a1b2c3d4e5",
    folderUrl: "https://example.sharepoint.com/folder",
    privacyVersion: "2026-10",
  };
}

const pageCount = (bytes: Uint8Array) => (Buffer.from(bytes).toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

test("buildPdf produces a multi-page PDF for a realistic couple case", async () => {
  const bytes = await buildPdf(recordFor(coupleGeneva));
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString("latin1"), "%PDF-");
  const out = process.env.SAMPLE_PDF;
  if (out) writeFileSync(out, bytes);
  // Object streams hide /Type /Page; count via pdf-lib instead.
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() > 1, `pages: ${doc.getPageCount()}`);
  assert.ok(pageCount(bytes) >= 0);
});

test("buildPdf does not throw on odd unicode and very long words", async () => {
  const answers: Answers = {
    ...coupleGeneva,
    "start.lastName": "Ørsted-Łukasiewicz 李",
    "review.comments": `${"x".repeat(400)} ➜ ∑ ≠ 😀 \u0000 ‮ reversed`,
  };
  const bytes = await buildPdf(recordFor(answers));
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString("latin1"), "%PDF-");
});

test("toWinAnsi maps typographic characters and drops the rest", () => {
  assert.equal(toWinAnsi("l’été – “ok” … ≥ 1 → x"), "l’été – “ok” … >= 1 -> x");
  assert.equal(toWinAnsi("Łódź 😀"), "ódz ");
  assert.equal(toWinAnsi("œuvre €"), "œuvre €");
});
