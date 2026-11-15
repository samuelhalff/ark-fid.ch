import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.TAX_QF_STORAGE = "mock";
process.env.TAX_QF_MOCK_DIR = mkdtempSync(path.join(os.tmpdir(), "tqf-assist-"));
process.env.TAX_QF_TOKEN_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.TAX_QF_API_KEYS = "cadence:tax-secret-tax-secret-tax-secret-0123456";

const { getStorage, MockStorage } = await import("./server/storage.ts");
const service = await import("./server/service.ts");
const { memoryPorts, setPortsForTests } = await import("./server/sharepoint-registry.ts");
const staff = await import("./server/staff.ts");
const access = await import("./server/access.ts");
const { checklistFor } = await import("./logic.ts");
type StaffDeps = import("./server/staff.ts").StaffDeps;
type ServiceErrorT = InstanceType<typeof service.ServiceError>;

const YEAR = new Date().getUTCFullYear() - 1;
const mem = memoryPorts();
setPortsForTests(mem.ports);
const storage = getStorage() as InstanceType<typeof MockStorage>;
const ledger = new Set<string>();
const deps: StaffDeps = {
  campaign: { ...staff.appCampaignDeps(storage), sendMail: async (m) => void storage.sent.push(m) },
  storage,
  ledger: { has: async (k) => ledger.has(k), add: async (k) => void ledger.add(k) },
  origin: "https://tax.ark-fid.ch",
  now: () => new Date(),
};

let seq = 0;
async function newReturn() {
  seq++;
  const input = { clientRef: `res.partner:${500 + seq}`, firstName: "Alex", lastName: `Assist${seq}`, email: `assist${seq}@example.ch`, language: "fr", canton: "GE", taxYear: YEAR, sendInvitation: false };
  const created = await staff.createReturn(input, { idempotencyKey: `create-assist-${seq}` }, deps);
  return { ...input, caseId: created.summary.caseId };
}
const assist = (caseId: string, body: Record<string, unknown>, key: string, hash = "h") => staff.staffAction(caseId, "assist", { taxYear: YEAR, ...body }, { idempotencyKey: key, payloadHash: hash }, deps);
const tokenOf = (link: string) => link.split("#assist=")[1];
const refused = (code: string, status: number) => (e: unknown) => (e as ServiceErrorT).code === code && (e as ServiceErrorT).status === status;
const row = (caseId: string) => mem.returns.find((r) => r.caseId === caseId && r.taxYear === YEAR)!;

const fullAnswers = (p: { email: string; lastName: string }) => ({
  "start.years": [String(YEAR)],
  "start.household": "single",
  "start.canton": "GE",
  "start.commune": "Genève",
  "start.firstName": "Alex",
  "start.lastName": p.lastName,
  "start.email": p.email,
  "start.phone": "+41 22 000 00 00",
  "start.status": "first",
  "regime.residence": "ch",
  "regime.lumpSum": "no",
  "regime.sourceTax": "no",
  "router.items": ["employed", "p3a"],
  "work.employers": [{ _id: "emp00001", name: "Acme SA" }],
});
const allLater = (a: Record<string, unknown>) => Object.fromEntries(checklistFor(a).map((i) => [i.key, "later"]));

test("assist: link (#assist=) and code, the year's summary, nothing e-mailed; bad by / ttl refused", async () => {
  const p = await newReturn();
  storage.sent.length = 0;
  await assert.rejects(assist(p.caseId, {}, "a-no-by"), refused("invalid_by", 400));
  await assert.rejects(assist(p.caseId, { by: "   " }, "a-blank-by"), refused("invalid_by", 400));
  await assert.rejects(assist(p.caseId, { by: "x".repeat(121) }, "a-long-by"), refused("invalid_by", 400));
  for (const ttlMinutes of [0, 241, 1.5, "abc", null]) await assert.rejects(assist(p.caseId, { by: "Sam", ttlMinutes }, `a-ttl-${String(ttlMinutes)}`), refused("invalid_ttl", 400));
  await assert.rejects(staff.staffAction(p.caseId, "assist", { by: "Sam" }, { idempotencyKey: "a-no-year", payloadHash: "h" }, deps), refused("invalid_tax_year", 400));

  const result = await assist(p.caseId, { by: "Sam Halff", ttlMinutes: 15 }, "a-ok-1");
  const issued = result.extra!.assist as { link: string; code: string; expiresAt: string };
  assert.equal(result.replayed, false);
  assert.equal(result.summary.caseId, p.caseId);
  assert.equal(result.summary.taxYear, YEAR);
  assert.match(issued.link, /^https:\/\/tax\.ark-fid\.ch\/fr\/#assist=[A-Za-z0-9_-]{43}$/);
  assert.match(issued.code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.ok(Math.abs(Date.parse(issued.expiresAt) - Date.now() - 15 * 60_000) < 5_000);
  const defaultTtl = (await assist(p.caseId, { by: "Sam" }, "a-ok-default")).extra!.assist as { expiresAt: string };
  assert.ok(Math.abs(Date.parse(defaultTtl.expiresAt) - Date.now() - 30 * 60_000) < 5_000, "30 minutes by default");
  assert.equal(await access.readLink(tokenOf(issued.link)), null, "an assist token is not a client link");
  assert.ok(![...mem.access.keys()].some((k) => k === tokenOf(issued.link) || k.includes(issued.code)), "only HMACs are stored");
  assert.equal(storage.sent.length, 0, "nothing e-mailed");
});

test("assist: single use (the link spends the code and the reverse), typed code ignores case, spaces, dashes; expiry", async () => {
  const p = await newReturn();
  const one = (await assist(p.caseId, { by: "Sam" }, "s-1")).extra!.assist as { link: string; code: string };
  const opened = await access.redeemAssist({ token: tokenOf(one.link) });
  assert.equal(opened?.caseId, p.caseId);
  assert.equal(opened?.by, "Sam");
  assert.equal(await access.redeemAssist({ token: tokenOf(one.link) }), null, "the link is single use");
  assert.equal(await access.redeemAssist({ code: one.code }), null, "the code is spent with the link");

  const two = (await assist(p.caseId, { by: "Anne" }, "s-2")).extra!.assist as { link: string; code: string };
  assert.equal((await access.redeemAssist({ code: ` ${two.code.toLowerCase().replace("-", " ")} ` }))?.by, "Anne");
  assert.equal(await access.redeemAssist({ token: tokenOf(two.link) }), null, "the link is spent with the code");

  const three = (await assist(p.caseId, { by: "Sam", ttlMinutes: 1 }, "s-3")).extra!.assist as { link: string; code: string };
  for (const record of mem.access.values()) if (record.kind === "assist" && !record.revoked) record.expiresAt = Date.now() - 1;
  assert.equal(await access.redeemAssist({ code: three.code }), null, "expired");
  assert.equal(await access.redeemAssist({ code: "ABCD-EFGH" }), null, "unknown code");
  assert.equal(await access.redeemAssist({ code: "AB" }), null, "malformed code");
});

test("assist: replay of the same key issues a fresh access (never a stored one); another payload conflicts", async () => {
  const p = await newReturn();
  const first = (await assist(p.caseId, { by: "Sam" }, "r-1", "p1")).extra!.assist as { code: string };
  const again = await assist(p.caseId, { by: "Sam" }, "r-1", "p1");
  assert.equal(again.replayed, true);
  const second = again.extra!.assist as { code: string };
  assert.notEqual(second.code, first.code);
  assert.ok(await access.redeemAssist({ code: first.code }), "the first access still works (single use each)");
  assert.ok(await access.redeemAssist({ code: second.code }));
  await assert.rejects(assist(p.caseId, { by: "Anne" }, "r-1", "p2"), refused("idempotency_conflict", 409));
});

test("assist: refused for a return closed for the office (Déposé / Clos / declined) or already submitted", async () => {
  const closed = await newReturn();
  row(closed.caseId).staffStatus = "Déposé";
  await assert.rejects(assist(closed.caseId, { by: "Sam" }, "c-1"), refused("case_closed", 409));
  row(closed.caseId).staffStatus = "Clos";
  await assert.rejects(assist(closed.caseId, { by: "Sam" }, "c-2"), refused("case_closed", 409));
  const declined = await newReturn();
  row(declined.caseId).state = "declined";
  await assert.rejects(assist(declined.caseId, { by: "Sam" }, "c-3"), refused("case_closed", 409));
  const submitted = await newReturn();
  row(submitted.caseId).state = "submitted";
  await assert.rejects(assist(submitted.caseId, { by: "Sam" }, "c-4"), refused("already_submitted", 409));
  await assert.rejects(assist("nosuchcase1", { by: "Sam" }, "c-5"), refused("not_found", 404));
});

test("office session on a never-opened return: staff saves are marked, a client change of the same answer clears the mark", async () => {
  const p = await newReturn();
  const issued = (await assist(p.caseId, { by: "Sam" }, "f-1")).extra!.assist as { code: string };
  const opened = (await access.redeemAssist({ code: issued.code }))!;
  const raw = await access.createSession({ caseId: opened.caseId, emailHash: access.STAFF_HASH, scope: "edit", staffBy: opened.by });
  const session = (await access.readSession(raw))!;
  assert.equal(session.staffBy, "Sam");
  assert.equal(session.scope, "edit");
  assert.equal(session.emailHash, access.STAFF_HASH);
  assert.notEqual(session.emailHash, row(p.caseId).emailHash, "an office session never passes for the client's address");
  const stored = [...mem.access.values()].find((r) => r.kind === "session" && r.by === "Sam")!;
  assert.ok(Math.abs(stored.expiresAt - Date.now() - access.STAFF_SESSION_TTL_MS) < 5_000, "8-hour staff session");

  service.forgetCase(p.caseId);
  const info = await service.getCase(p.caseId);
  const base = (await service.readDraft(storage, info))?.answers || {};
  const staffAnswers = { ...base, "start.phone": "+41 22 111 11 11", "start.commune": "Carouge" };
  await service.saveDraft(storage, info, { answers: staffAnswers, stepId: "start", docStatus: {}, locale: "fr" }, session.staffBy);
  let draft = (await service.readDraft(storage, info))!;
  assert.deepEqual(draft.filledBy, { "start.phone": "Sam", "start.commune": "Sam" });
  assert.equal(service.clientDraft(draft).filledBy, undefined, "never sent to the browser");
  assert.deepEqual((await staff.staffReturn(p.caseId, YEAR, deps)).filledBy, { "start.phone": "Sam", "start.commune": "Sam" });

  // The client's autosave re-sends every answer: only the one he changed loses its mark.
  await service.saveDraft(storage, info, { answers: { ...draft.answers, "start.phone": "+41 79 000 00 00" }, stepId: "start", docStatus: {}, locale: "fr" });
  draft = (await service.readDraft(storage, info))!;
  assert.deepEqual(draft.filledBy, { "start.commune": "Sam" });
  // Unchanged save by the client: marks kept.
  await service.saveDraft(storage, info, { answers: draft.answers, stepId: "start", docStatus: {}, locale: "fr" });
  assert.deepEqual((await service.readDraft(storage, info))!.filledBy, { "start.commune": "Sam" });
});

test("office submission: submittedBy recorded, no client confirmation, outputs and staff GET say « rempli par Ark »", async () => {
  const p = await newReturn();
  service.forgetCase(p.caseId);
  const info = await service.getCase(p.caseId);
  const answers = fullAnswers(p);
  await service.saveDraft(storage, info, { answers, stepId: "review", docStatus: {}, locale: "fr" }, "Sam");
  storage.sent.length = 0;
  const result = await service.finalizeSubmission(
    storage,
    await service.getCase(p.caseId),
    { locale: "fr", answers, docStatus: allLater(answers), privacyAccepted: true, certified: true, submitKey: "assist0001" },
    new Date(),
    "Sam",
  );
  assert.equal(result.clientNotified, false);
  assert.ok(!storage.sent.some((m) => m.to.includes(p.email)), "no mail to the client");
  const internal = storage.sent.find((m) => m.to.includes("samuel.halff@ark-fid.ch"));
  assert.ok(internal && internal.subject.startsWith("[Rempli par Ark]"), "the office is told");
  assert.equal(row(p.caseId).state, "submitted");
  assert.equal(row(p.caseId).submittedBy, "Sam");
  const got = await staff.staffReturn(p.caseId, YEAR, deps);
  assert.equal(got.submittedBy, "Sam");
  assert.equal(got.emailVerified, false, "a submission by Ark proves nothing about the client's address");
  assert.equal(got.filledBy["start.commune"], "Sam");
  const files = await storage.listFiles(info.main.driveId, info.main.folderId);
  const json = files.find((f) => f.folder.startsWith("Envoi ") && f.name === "questionnaire.json")!;
  const versionId = await storage.ensureSubfolder(info.main.driveId, info.main.folderId, json.folder);
  const questionnaire = JSON.parse(new TextDecoder().decode((await storage.readFile(info.main.driveId, versionId, "questionnaire.json"))!));
  assert.equal(questionnaire.submittedBy, "Sam");
  assert.equal(questionnaire.filledBy["work.employers"], "Sam");
  await assert.rejects(assist(p.caseId, { by: "Sam" }, "sub-after"), refused("already_submitted", 409));
});

test("client submission after a correction clears submittedBy and e-mails the client", async () => {
  const p = await newReturn();
  const answers = fullAnswers(p);
  service.forgetCase(p.caseId);
  await service.saveDraft(storage, await service.getCase(p.caseId), { answers, stepId: "review", docStatus: {}, locale: "fr" }, "Sam");
  await service.finalizeSubmission(storage, await service.getCase(p.caseId), { locale: "fr", answers, docStatus: allLater(answers), privacyAccepted: true, certified: true, submitKey: "assist0002" }, new Date(), "Sam");
  await service.reopenCase(await service.getCase(p.caseId));
  service.forgetCase(p.caseId);
  storage.sent.length = 0;
  const result = await service.finalizeSubmission(storage, await service.getCase(p.caseId), { locale: "fr", answers, docStatus: allLater(answers), privacyAccepted: true, certified: true, submitKey: "assist0003" });
  assert.equal(result.clientNotified, true);
  assert.ok(storage.sent.some((m) => m.to.includes(p.email)));
  assert.equal(row(p.caseId).submittedBy, undefined);
  assert.equal(staff.summarize(row(p.caseId)).emailVerified, true);
});
