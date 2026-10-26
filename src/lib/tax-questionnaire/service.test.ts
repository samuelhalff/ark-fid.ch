import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.TAX_QF_STORAGE = "mock";
process.env.TAX_QF_MOCK_DIR = mkdtempSync(path.join(os.tmpdir(), "tqf-test-"));
process.env.TAX_QF_TOKEN_SECRET = "test-secret-0123456789abcdef0123456789abcdef";

const { getStorage, MockStorage } = await import("./server/storage.ts");
const { memoryPorts, setPortsForTests, matchCrm } = await import("./server/sharepoint-registry.ts");
const service = await import("./server/service.ts");
const access = await import("./server/access.ts");
const { docCode } = await import("./documents.ts");
const { checklistFor } = await import("./logic.ts");
/** Every checklist item answered "later" (the server requires a file or a status per document). */
const allLater = (a: Record<string, unknown>) => Object.fromEntries(checklistFor(a).map((i) => [i.key, "later"]));

const YEAR = String(new Date().getFullYear() - 1);
const storage = getStorage() as InstanceType<typeof MockStorage>;
const mem = memoryPorts({ crm: [{ id: "c1", title: "MARTIN", firstName: "Anne", email: "", acquis: "Client", actif: true, etendue: ["Comptabilité"] }] });
setPortsForTests(mem.ports);

const answers = (email: string, extra: Record<string, unknown> = {}) => ({
  "start.years": [YEAR],
  "start.household": "single",
  "start.canton": "GE",
  "start.commune": "Genève",
  "start.firstName": "Alex",
  "start.lastName": "Test",
  "start.email": email,
  "start.phone": "+41 22 000 00 00",
  "start.status": "first",
  "regime.residence": "ch",
  "regime.lumpSum": "no",
  "regime.sourceTax": "no",
  "router.items": ["employed", "p3a"],
  "work.employers": [{ _id: "emp00001", name: "Acme SA" }],
  ...extra,
});

async function upload(info: Awaited<ReturnType<typeof service.getCase>>, docKey: string, name: string, bytes: Uint8Array) {
  const { uploadUrl } = await service.createUpload(storage, info, { docKey, label: "Doc", fileName: name, size: bytes.byteLength, mime: "application/pdf" });
  const id = uploadUrl.split("/").pop() as string;
  await storage.appendChunk(id, 0, bytes);
}

test("one-time code: valid once, wrong code and replay refused", () => {
  const { code, challenge } = access.createChallenge({ purpose: "new", emailHash: "h", email: "a@b.ch", firstName: "A", lastName: "B" });
  assert.equal(access.verifyChallenge(challenge, "000000".replace(/./g, (c, i) => String((Number(code[i]) + 1) % 10))).ok, false);
  assert.equal(access.verifyChallenge(challenge, code).ok, true);
  assert.equal(access.verifyChallenge(challenge, code).ok, false, "single use");
  const tampered = challenge.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
  assert.equal(access.verifyChallenge(tampered, code).ok, false);
});

test("sessions and links are stored as HMACs only and can be revoked", async () => {
  const value = await access.createSession({ caseId: "case1", emailHash: "h", scope: "edit" });
  assert.ok(!mem.access.has(value), "raw value never stored");
  assert.equal((await access.readSession(value))?.caseId, "case1");
  await access.revokeSession(value);
  assert.equal(await access.readSession(value), null);
  const url = await access.issueLink({ caseId: "case1", emailHash: "h", scope: "edit", purpose: "resume", ttlMs: 60_000 });
  assert.match(url, /#acces=/);
  const token = url.split("#acces=")[1];
  assert.equal((await access.readLink(token))?.purpose, "resume");
});

test("full case: create, upload, submit (Excel, PDF, JSON, consent), CRM prospect, idempotent", async () => {
  const info = await service.createCase(storage, { identity: { email: "alex@example.com", firstName: "Alex", lastName: "Test" }, locale: "fr", answers: answers("alex@example.com") });
  assert.equal(mem.returns.length, 1);
  const pdfBytes = new TextEncoder().encode("%PDF-1.4 test");
  await upload(info, `salary:emp00001`, "certificat.pdf", pdfBytes);
  await upload(info, "extra", "autre.pdf", pdfBytes);
  await upload(info, "p3a", "fake.pdf", new Uint8Array([0x4d, 0x5a, 0x90, 0x00])); // executable disguised as PDF
  const files = await service.listUploads(storage, info);
  assert.equal(files.length, 3);
  assert.ok(files.some((f) => f.code === docCode("salary:emp00001")));

  storage.sent.length = 0;
  const result = await service.finalizeSubmission(storage, await service.getCase(info.caseId), {
    locale: "fr",
    answers: answers("alex@example.com"),
    docStatus: { "health-premiums": "later" },
    privacyAccepted: true,
    certified: true,
    submitKey: "abcdefgh12",
  });
  assert.ok(result.received.includes("salary:emp00001"));
  assert.ok(result.pending.includes("health-premiums") && result.pending.includes("p3a"));
  const internal = storage.sent.find((m) => m.to.includes("samuel.halff@ark-fid.ch"));
  assert.ok(internal, "internal mail");
  assert.deepEqual(internal!.attachments!.map((a) => a.name.split(".").pop()).sort(), ["pdf", "xlsx"]);
  const client = storage.sent.find((m) => m.to.includes("alex@example.com"))!;
  assert.ok(!/certificat\.pdf|autre\.pdf/.test(client.html), "no file names in the client mail");
  const all = await storage.listFiles(info.main.driveId, info.main.folderId);
  const version = all.filter((f) => f.folder.startsWith("Envoi ")).map((f) => f.name).sort();
  assert.ok(version.includes("questionnaire.json") && version.includes("consent.json"));
  assert.ok(version.some((n) => n.endsWith(".xlsx")) && version.some((n) => n.endsWith(".pdf")));
  assert.ok(all.some((f) => f.folder === service.FLAGGED_FOLDER), "executable moved aside");
  const record = mem.returns.find((r) => r.caseId === info.caseId)!;
  assert.equal(record.state, "submitted");
  assert.equal(record.crmMatch, "created");
  assert.equal(mem.crm.at(-1)!.acquis, "Prospect");
  await assert.rejects(async () => service.finalizeSubmission(storage, await service.getCase(info.caseId), { locale: "fr", answers: answers("alex@example.com"), docStatus: {}, privacyAccepted: true, certified: true, submitKey: "abcdefgh13" }), /already_submitted/);
});

test("internal mail failure keeps the submission retryable", async () => {
  const info = await service.createCase(storage, { identity: { email: "retry@example.com", firstName: "Re", lastName: "Try" }, locale: "en", answers: answers("retry@example.com", { "start.firstName": "Re", "start.lastName": "Try" }) });
  storage.failMail = true;
  const retryAnswers = answers("retry@example.com", { "start.firstName": "Re", "start.lastName": "Try" });
  await assert.rejects(async () => service.finalizeSubmission(storage, await service.getCase(info.caseId), { locale: "en", answers: retryAnswers, docStatus: {}, privacyAccepted: true, certified: true, submitKey: "retrykey00" }), /documents_incomplete/);
  const input = { locale: "en", answers: retryAnswers, docStatus: allLater(retryAnswers), privacyAccepted: true, certified: true, submitKey: "retrykey01" };
  await assert.rejects(async () => service.finalizeSubmission(storage, await service.getCase(info.caseId), input), /notify_failed/);
  storage.failMail = false;
  await service.finalizeSubmission(storage, await service.getCase(info.caseId), input);
  const folders = new Set((await storage.listFiles(info.main.driveId, info.main.folderId)).filter((f) => f.folder.startsWith("Envoi ")).map((f) => f.folder));
  assert.equal(folders.size, 1, "retry reused the same version folder");
});

test("regularisation route: minimal client e-mail, alert prefix for staff", async () => {
  const extra = { "router.items": ["regularisation"], "regularisation.authorityContact": "no", "regularisation.priorDisclosure": "no", "start.firstName": "Reg", "start.lastName": "Ul" };
  const info = await service.createCase(storage, { identity: { email: "reg@example.com", firstName: "Reg", lastName: "Ul" }, locale: "fr", answers: answers("reg@example.com", extra) });
  storage.sent.length = 0;
  await service.finalizeSubmission(storage, await service.getCase(info.caseId), { locale: "fr", answers: answers("reg@example.com", extra), docStatus: allLater(answers("reg@example.com", extra)), privacyAccepted: true, certified: true, submitKey: "regkey0001" });
  const client = storage.sent.find((m) => m.to.includes("reg@example.com"))!;
  assert.ok(!/document|régularis/i.test(client.html.replace(/<[^>]+>/g, "")) || /reçu votre demande/.test(client.html));
  assert.ok(storage.sent.some((m) => m.subject.startsWith("[Régularisation]")));
});

test("CRM: e-mail match links, name-only match is ambiguous and never written", () => {
  const items = [
    { id: "1", title: "MARTIN", firstName: "Anne", email: "", acquis: "Client", actif: true, etendue: [], webUrl: "" },
    { id: "2", title: "DUPONT", firstName: "Jean", email: "jean@dupont.ch", acquis: "Client", actif: true, etendue: ["Fiscal"], webUrl: "" },
  ];
  assert.equal(matchCrm(items, { email: "JEAN@dupont.ch", lastName: "x", firstName: "y" }).status, "matched");
  assert.equal(matchCrm(items, { email: "anne@x.ch", lastName: "Martin", firstName: "Anne" }).status, "ambiguous");
  assert.equal(matchCrm(items, { email: "new@x.ch", lastName: "New", firstName: "One" }).status, "none");
});

test("draft deletion removes folders and revokes access; arrears get their own year folder", async () => {
  const older = String(Number(YEAR) - 1);
  const info = await service.createCase(storage, { identity: { email: "del@example.com", firstName: "De", lastName: "Lete" }, locale: "fr", answers: answers("del@example.com", { "start.years": [YEAR, older] }) });
  assert.equal(info.records.length, 2);
  assert.notEqual(info.records[0].folderId, info.records[1].folderId);
  await service.deleteDraft(storage, info);
  assert.ok(mem.returns.filter((r) => r.caseId === info.caseId).every((r) => r.state === "declined"));
  await assert.rejects(() => service.getCase(info.caseId), /session_expired/);
});

test("after submission: missing list and status on the tracker, staff items merged, follow-up workbook and staff mail", async () => {
  const email = "missing@example.com";
  const base = answers(email, { "start.firstName": "Mi", "start.lastName": "Ssing" });
  const info = await service.createCase(storage, { identity: { email, firstName: "Mi", lastName: "Ssing" }, locale: "fr", answers: base });
  await service.finalizeSubmission(storage, await service.getCase(info.caseId), { locale: "fr", answers: base, docStatus: allLater(base), privacyAccepted: true, certified: true, submitKey: "missingk01" });
  const row = () => mem.returns.find((r) => r.caseId === info.caseId)!;
  assert.ok(row().missingDocs && row().missingDocs!.length > 0, "missing list written on submit");
  assert.equal(row().staffStatus, "Documents manquants");

  // Staff adds an item in "Documents à demander": it joins the client's checklist and the missing list.
  row().staffDocs = "- Contrat de prêt avec votre beau-frère";
  const current = await service.getCase(info.caseId);
  const withStaff = { ...current, main: { ...current.main, staffDocs: row().staffDocs } };
  const { labels } = await service.refreshMissing(storage, withStaff);
  assert.ok(labels.includes("Contrat de prêt avec votre beau-frère"));
  const merged = await service.syncStaffDocs(storage, withStaff);
  assert.ok((merged!.answers["start.arkDocs"] as Record<string, unknown>[]).some((r) => r.staff === "1"));
  const stored = await service.readDraft(storage, withStaff);
  assert.ok(!((stored!.answers["start.arkDocs"] as Record<string, unknown>[] | undefined) || []).some((r) => r.staff === "1"), "stored draft untouched");
  assert.match(row().missingDocs!, /Contrat de prêt avec votre beau-frère/);

  storage.sent.length = 0;
  await service.notifyAdditions(storage, withStaff);
  const mail = storage.sent.find((m) => m.subject.startsWith("Documents complémentaires"))!;
  assert.match(mail.html, /Encore manquants/);
  const files = await storage.listFiles(info.main.driveId, info.main.folderId);
  assert.ok(files.some((f) => f.name.startsWith("Suivi documents ") && f.name.endsWith(".xlsx")), "follow-up workbook written");

  // Staff clears the column: the item leaves the to-do.
  const cleared = { ...withStaff, main: { ...withStaff.main, staffDocs: "" } };
  assert.ok(!(await service.refreshMissing(storage, cleared)).labels.includes("Contrat de prêt avec votre beau-frère"));
});

test("annual reminder: on by default, unticking it on submission turns the reminder off", async () => {
  const email = "remind@example.com";
  const base = answers(email, { "start.firstName": "Re", "start.lastName": "Mind" });
  const info = await service.createCase(storage, { identity: { email, firstName: "Re", lastName: "Mind" }, locale: "fr", answers: base });
  const draft = await service.readDraft(storage, info);
  assert.equal(draft?.answers["review.reminder"], "yes");
  const key = service.clientKey(email, "Mind", "Re");
  await mem.ports.prefs.upsert({ clientKey: key, email, name: "MIND Re", language: "fr", optIn: true, excluded: false });
  const off: Record<string, unknown> = { ...base };
  delete off["review.reminder"];
  await service.finalizeSubmission(storage, await service.getCase(info.caseId), { locale: "fr", answers: off, docStatus: allLater(off), privacyAccepted: true, certified: true, submitKey: "remindkey1" });
  assert.equal((await mem.ports.prefs.get(key))?.optIn, false);
});
