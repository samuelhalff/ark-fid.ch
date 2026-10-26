import assert from "node:assert/strict";
import test from "node:test";

import { attentionPoints } from "./attention.ts";
import { checklistFor, validateAll } from "./logic.ts";
import { knownItems } from "./renewal.ts";
import { keepServerOwned, previousAnswers } from "./server/service.ts";
import { isInternalCase, staffRecipients } from "./server/email.ts";
import type { Answers } from "./types.ts";

const row = (id: string, fields: Record<string, string | string[]>) => ({ _id: id, ...fields });
const lastYear: Answers = {
  "start.years": ["2024"],
  "start.household": "couple",
  "start.canton": "GE",
  "start.commune": "Carouge (GE)",
  "start.communeBfs": "6608",
  "start.firstName": "Alex",
  "start.lastName": "Test",
  "start.spouseFirstName": "Sam",
  "start.spouseLastName": "Test",
  "start.email": "alex@example.com",
  "start.phone": "+41 22 000 00 00",
  "start.status": "filedBefore",
  "start.avisReceived": "no",
  "regime.residence": "ch",
  "regime.lumpSum": "no",
  "regime.sourceTax": "no",
  "base.taxNumber": "123",
  "router.items": ["children", "employed", "banksCH", "propertyCH", "p3a", "lottery"],
  "family.children": [row("kid00001", { firstName: "Léa", birthYear: "2015" })],
  "work.employers": [row("emp00001", { name: "Acme SA", person: "me" }), row("emp00002", { name: "Beta SA", person: "spouse" })],
  "assets.banks": [row("bank0001", { bank: "UBS", country: "CH", securities: "yes" })],
  "property.items": [row("prop0001", { where: "CH", canton: "GE", commune: "Carouge (GE)", kind: "ppe", ownership: "spouses", uses: ["main"], events: ["bought"], boughtDate: "01.03.2024", mortgage: "yes", lenders: "Raiffeisen", ppe: "yes", invoices: "no", geFill: "later" })],
  "other.winnings": [row("win00001", { source: "Loterie" })],
};

async function renewal(): Promise<Answers> {
  const bytes = new TextEncoder().encode(JSON.stringify({ answers: lastYear }));
  const storage = {
    listFiles: async () => [{ id: "f1", name: "questionnaire.json", folder: "Envoi 2025-03-01", size: bytes.length, webUrl: "" }],
    readHead: async () => bytes,
  };
  const a = await previousAnswers(storage as never, { driveId: "d", folderId: "f", taxYear: 2024 } as never, 2025);
  assert.ok(a);
  return a;
}

test("renewal pre-fill: next year, Ark client, one-off events dropped, every known area unchanged", async () => {
  const a = await renewal();
  assert.deepEqual(a["start.years"], ["2025"]);
  assert.equal(a["start.status"], "arkClient");
  assert.equal(a["base.prefilledFrom"], "2024");
  assert.equal(a["base.taxNumber"], "123");
  assert.equal(a["start.avisReceived"], undefined);
  assert.ok(!(a["router.items"] as string[]).includes("lottery"));
  assert.equal((a["property.items"] as Record<string, unknown>[])[0].boughtDate, undefined);
  assert.deepEqual(a["router.unchanged"], ["family", "work", "assets", "property", "other"]);
  assert.deepEqual(validateAll(a), {});
});

test("renewal: concrete known items per area", async () => {
  const known = knownItems(await renewal(), "fr");
  assert.deepEqual(known.family, ["Léa (2015)"]);
  assert.deepEqual(known.work, ["Acme SA", "Beta SA"]);
  assert.deepEqual(known.assets, ["UBS (titres)"]);
  assert.deepEqual(known.property, ["PPE · Carouge (GE) · hypothèque Raiffeisen"]);
  assert.deepEqual(known.other, ["3e pilier A"]);
  assert.deepEqual(knownItems(lastYear, "fr"), {});
});

test("renewal checklist: the new year's documents for unchanged items, no last return", async () => {
  const labels = checklistFor(await renewal()).map((i) => i.label.fr);
  assert.ok(labels.includes("Certificat de salaire 2025 – Acme SA"));
  assert.ok(labels.includes("Certificat de salaire 2025 – Beta SA"));
  assert.ok(labels.some((l) => l.startsWith("Relevé fiscal au 31.12.2025") && l.endsWith("UBS")));
  assert.ok(labels.some((l) => l.startsWith("Attestation(s) hypothécaire(s) 2025")));
  assert.ok(labels.some((l) => l.startsWith("Attestation(s) de versement au 3e pilier A 2025")));
  assert.ok(!labels.some((l) => l.startsWith("Dernière déclaration d'impôt")));
});

test("prepared case: documents listed by Ark join the checklist; staff notes become attention points", () => {
  const a: Answers = { ...lastYear, "start.arkPrefilled": "start.household, router.items", "start.arkDocs": [row("doc00001", { label: "Contrat de prêt — à obtenir" })], _arkNotes: ["Question du client sur la valeur de la société"] };
  const item = checklistFor(a).find((i) => i.ruleId === "ark-doc");
  assert.equal(item?.label.fr, "Contrat de prêt — à obtenir");
  assert.match(item!.key, /^ark-doc:doc00001$/);
  const points = attentionPoints(a).map((p) => p.text);
  assert.ok(points.includes("Ark : Question du client sur la valeur de la société"));
  assert.ok(points.some((p) => p.startsWith("Questionnaire pré-rempli par Ark")));
});

test("internal test / demo cases notify the main recipient only", () => {
  assert.equal(isInternalCase({ email: "samuel.halff@ark-fid.ch" }), true);
  assert.equal(isInternalCase({ email: "Lassana.Dioum@PBM.law" }), true);
  assert.equal(isInternalCase({ email: "client@example.com", name: "DÉMO Renouvellement" }), true);
  assert.equal(isInternalCase({ email: "client@example.com", name: "Demo x" }), true);
  assert.equal(isInternalCase({ email: "client@example.com", name: "X", folderName: "TEST - X - 2026-10-26 - abc" }), true);
  assert.equal(isInternalCase({ email: "client@example.com", name: "TESTARD Paul" }), false);
  assert.equal(isInternalCase({ email: "alex@cpm.partners", name: "CONSTANTINESCU Alex" }), false);
  const saved = process.env.TAX_QF_MAIL_CC;
  delete process.env.TAX_QF_MAIL_CC;
  try {
    assert.deepEqual(staffRecipients(false).cc, ["sebastien.gallie@ark-fid.ch", "lassana.dioum@pbm.law"]);
    assert.deepEqual(staffRecipients(true).cc, []);
  } finally {
    if (saved !== undefined) process.env.TAX_QF_MAIL_CC = saved;
  }
});

test("server-owned answers: the browser cannot add, change or drop them", () => {
  const stored: Answers = { "start.arkPrefilled": "start.household", "start.arkDocs": [row("doc00001", { label: "X" })], "base.prefilledFrom": "2024" };
  const forged = keepServerOwned({ "start.arkPrefilled": "", "start.arkDocs": [], "base.prefilledFrom": "1999", "start.household": "single" }, stored);
  assert.deepEqual(forged["start.arkDocs"], stored["start.arkDocs"]);
  assert.equal(forged["start.arkPrefilled"], "start.household");
  assert.equal(forged["base.prefilledFrom"], "2024");
  const fresh = keepServerOwned({ "start.arkDocs": [row("doc00009", { label: "Y" })], "base.prefilledFrom": "2023" }, {});
  assert.equal(fresh["start.arkDocs"], undefined);
  assert.equal(fresh["base.prefilledFrom"], undefined);
  assert.equal(keepServerOwned({ "base.prefilledFrom": "lecture de la dernière déclaration" }, {})["base.prefilledFrom"], "lecture de la dernière déclaration");
});
