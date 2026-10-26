import assert from "node:assert/strict";
import test from "node:test";

import { attentionPoints } from "./attention.ts";
import { checklistFor, pruneHidden, TITLE_FIELDS, validateAll } from "./logic.ts";
import { knownItems, renewalStatusFr } from "./renewal.ts";
import { computeChecklist, DOC_RULES } from "./documents.ts";
import { STEPS } from "./schema.ts";
import { keepServerOwned, previousAnswers } from "./server/service.ts";
import { isInternalCase, staffRecipients } from "./server/email.ts";
import type { Answers, GroupDef } from "./types.ts";

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

test("renewal pre-fill: next year, Ark client, one-off events dropped, every item carried over", async () => {
  const a = await renewal();
  assert.deepEqual(a["start.years"], ["2025"]);
  assert.equal(a["start.status"], "arkClient");
  assert.equal(a["base.prefilledFrom"], "2024");
  assert.equal(a["base.taxNumber"], "123");
  assert.equal(a["start.avisReceived"], undefined);
  assert.ok(!(a["router.items"] as string[]).includes("lottery"));
  assert.equal((a["property.items"] as Record<string, unknown>[])[0].boughtDate, undefined);
  assert.equal(a["router.unchanged"], undefined);
  for (const id of ["family.children", "work.employers", "assets.banks", "property.items"]) {
    assert.ok((a[id] as Record<string, unknown>[]).every((row) => row.carried === "2024" && row.renewal === undefined), id);
  }
  // The only open questions: the status of each carried item.
  const errors = validateAll(a);
  assert.ok(Object.keys(errors).length > 0);
  assert.ok(Object.entries(errors).every(([key, code]) => key.endsWith(".renewal") && code === "required"), JSON.stringify(errors));
});

/** Sets the status of every carried row of a group. */
const withStatus = (a: Answers, id: string, status: Record<string, string>) => ({
  ...a,
  [id]: (a[id] as Record<string, unknown>[]).map((row) => ({ ...row, ...status })),
});
const allKept = (a: Answers) =>
  Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Array.isArray(v) && v.length && typeof v[0] === "object" ? (v as Record<string, unknown>[]).map((r) => ({ ...r, renewal: "kept" })) : v])) as Answers;

test("renewal: same banks plus a new one", async () => {
  const a = allKept(await renewal());
  a["assets.banks"] = [...(a["assets.banks"] as Record<string, string>[]), row("bank0002", { bank: "PostFinance", country: "CH" })];
  assert.deepEqual(validateAll(a), {});
  const labels = checklistFor(a).map((i) => i.label.fr);
  assert.ok(labels.some((l) => l.startsWith("Relevé fiscal au 31.12.2025") && l.endsWith("UBS")));
  assert.ok(labels.some((l) => l.startsWith("Relevé fiscal au 31.12.2025") && l.endsWith("PostFinance")));
});

test("renewal: one account closed during the year asks for the closing statement; closed before, nothing", async () => {
  const kept = allKept(await renewal());
  const closed = withStatus(kept, "assets.banks", { renewal: "ended", endedOn: "30.06.2025" });
  assert.deepEqual(validateAll(closed), {});
  const labels = checklistFor(closed).map((i) => i.label.fr);
  assert.ok(labels.includes("Relevé de clôture 2025 (solde et intérêts jusqu'à la clôture) – UBS"));
  assert.ok(!labels.some((l) => l.startsWith("Relevé fiscal au 31.12.2025")));
  const before = withStatus(kept, "assets.banks", { renewal: "ended", endedOn: "15.12.2024" });
  assert.ok(!checklistFor(before).some((i) => i.label.fr.endsWith("UBS")));
  // A missing end date is an open question.
  assert.equal(validateAll(withStatus(kept, "assets.banks", { renewal: "ended" }))["assets.banks[bank0001].endedOn"], "required");
});

test("renewal: everything identical gives the new year's documents for every carried item", async () => {
  const a = { ...allKept(await renewal()), "router.sameAs": "family, work, assets, property, other" };
  assert.deepEqual(validateAll(a), {});
  const labels = checklistFor(a).map((i) => i.label.fr);
  for (const expected of ["Certificat de salaire 2025 – Acme SA", "Certificat de salaire 2025 – Beta SA"]) assert.ok(labels.includes(expected), expected);
  assert.ok(labels.some((l) => l.startsWith("Attestation(s) hypothécaire(s) 2025")));
});

test("renewal: a property sold during the year follows the sale rules", async () => {
  const a = withStatus(allKept(await renewal()), "property.items", { renewal: "ended", endedOn: "31.08.2025" });
  const labels = checklistFor(a).map((i) => i.ruleId);
  assert.ok(labels.includes("property-sale"));
  assert.ok(attentionPoints(pruneHidden(a)).some((p) => p.id.startsWith("sale:")), "property-gains tax flagged");
});

test("every repeatable group: keep / end / change / new give the right checklist and Synthèse status", () => {
  const groups = STEPS.flatMap((s) => s.blocks).filter((b): b is GroupDef => b.kind === "group" && !b.hidden);
  assert.ok(groups.length >= 15);
  // A row rich enough to satisfy most row conditions of the document rules.
  const fixture: Record<string, string | string[]> = {
    name: "Item", bank: "Item", insurer: "Item", lender: "Item", borrower: "Item", payer: "Item", platform: "Item", firstName: "Item", counterparty: "Item", source: "Item", description: "Item", model: "Item", institution: "Item",
    country: "CH", statement: "yes", kind: "bank", childcare: "yes", activity: "working", dividend: "yes", loan: "toCompany", mortgage: "yes", ppe: "yes", where: "CH", canton: "GE", commune: "Genève", uses: ["main"], ownership: "sole", birthYear: "2015", inLastAvis: "yes",
  };
  for (const g of groups) {
    for (const id of ["carried", "renewal", "endedOn"]) assert.ok(g.fields.some((f) => f.id === id), `${g.id} has ${id}`);
    const rules = DOC_RULES.filter((r) => r.forEach === g.id);
    const at = (status: Record<string, string>) => {
      const a: Answers = { "start.years": ["2025"], [g.id]: [{ _id: "row00001", ...fixture, ...status }] };
      return computeChecklist(a, TITLE_FIELDS).filter((i) => i.key.endsWith(":row00001"));
    };
    const baseline = at({});
    const kept = at({ carried: "2024", renewal: "kept" });
    const changed = at({ carried: "2024", renewal: "changed" });
    const endedIn = at({ carried: "2024", renewal: "ended", endedOn: "30.06.2025" });
    const endedBefore = at({ carried: "2024", renewal: "ended", endedOn: "31.12.2024" });
    assert.deepEqual(kept.map((i) => i.key), baseline.map((i) => i.key), `${g.id}: kept = same documents as a new item`);
    assert.deepEqual(changed.map((i) => i.key), baseline.map((i) => i.key), `${g.id}: changed`);
    assert.equal(endedBefore.length, 0, `${g.id}: ended before the year → nothing`);
    for (const item of baseline) {
      const rule = rules.find((r) => r.id === item.ruleId)!;
      const ended = endedIn.find((i) => i.key === item.key);
      if (rule.onEnded === "skip") assert.equal(ended, undefined, `${g.id}/${rule.id}: skipped when ended`);
      else assert.ok(ended, `${g.id}/${rule.id}: still asked when ended during the year`);
      if (rule.onEnded && rule.onEnded !== "skip") assert.notEqual(ended!.label.fr, item.label.fr, `${g.id}/${rule.id}: closing document`);
    }
    assert.equal(renewalStatusFr({ carried: "2024", renewal: "kept" }), "reconduit");
    assert.equal(renewalStatusFr({}), "nouveau");
    assert.equal(renewalStatusFr({ carried: "2024", renewal: "ended", endedOn: "30.06.2025" }), "terminé le 30.06.2025");
    assert.equal(renewalStatusFr({ carried: "2024", renewal: "changed" }), "modifié");
  }
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

test("carried rows: the browser can neither drop them nor forge the mark", () => {
  const stored: Answers = { "assets.banks": [row("bank0001", { bank: "UBS", carried: "2024" })] };
  const dropped = keepServerOwned({ "assets.banks": [row("bank0009", { bank: "New", carried: "2024" })] }, stored);
  const banks = dropped["assets.banks"] as Record<string, unknown>[];
  assert.deepEqual(banks.map((r) => r._id).sort(), ["bank0001", "bank0009"]);
  assert.equal(banks.find((r) => r._id === "bank0009")!.carried, undefined, "forged mark removed");
  assert.equal(banks.find((r) => r._id === "bank0001")!.carried, "2024", "carried row restored");
});

test("ended during the year: the date must be in the tax year and not in the future", async () => {
  const kept = allKept(await renewal());
  const at = (date: string) => validateAll(withStatus(kept, "assets.banks", { renewal: "ended", endedOn: date }), new Date("2026-03-01"))["assets.banks[bank0001].endedOn"];
  assert.equal(at("30.06.2025"), undefined);
  assert.equal(at("15.12.2024"), "invalid_date");
  assert.equal(at("15.01.2026"), "invalid_date");
});
