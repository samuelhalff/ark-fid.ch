import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.TAX_QF_STORAGE = "mock";
process.env.TAX_QF_MOCK_DIR = mkdtempSync(path.join(os.tmpdir(), "tqf-staff-"));
process.env.TAX_QF_TOKEN_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.TAX_QF_API_KEYS = "cadence:tax-secret-tax-secret-tax-secret-0123456";
process.env.KYC_QF_API_KEYS = "cadence:kyc-secret-kyc-secret-kyc-secret-0123456";

const { getStorage } = await import("./server/storage.ts");
const service = await import("./server/service.ts");
const { memoryPorts, setPortsForTests } = await import("./server/sharepoint-registry.ts");
const staff = await import("./server/staff.ts");
const access = await import("./server/access.ts");
const { signRequest, verifyStaffRequest } = await import("../kyc-questionnaire/server/signature.ts");
const { apiKeys } = await import("../kyc-questionnaire/server/config.ts");
type MailMessage = import("./server/storage.ts").MailMessage;
type StaffDeps = import("./server/staff.ts").StaffDeps;
type ReturnRecord = import("./server/ports.ts").ReturnRecord;

const YEAR = new Date().getUTCFullYear() - 1;
const DAY = 24 * 60 * 60 * 1000;
const mem = memoryPorts();
setPortsForTests(mem.ports);
const storage = getStorage();
const mails: MailMessage[] = [];
let clock = Date.now();
const ledger = new Set<string>();
const deps: StaffDeps = {
  campaign: { ...staff.appCampaignDeps(storage), sendMail: async (m) => void mails.push(m) },
  storage,
  ledger: { has: async (k) => ledger.has(k), add: async (k) => void ledger.add(k) },
  origin: "https://tax.ark-fid.ch",
  now: () => new Date(clock),
};

let seq = 0;
const person = () => {
  seq++;
  return { clientRef: `res.partner:${100 + seq}`, firstName: "Alex", lastName: `Test${seq}`, email: `alex${seq}@example.ch`, language: "fr", canton: "GE", taxYear: YEAR };
};
const rows = (caseId: string) => mem.returns.filter((r) => r.caseId === caseId);
const tokenOf = (url: string) => url.split("#acces=")[1];
const meta = (key: string, hash = "h") => ({ idempotencyKey: key, payloadHash: hash });

test("signature: tax keys never validate a KYC request, nor KYC keys a tax request", async () => {
  const make = (secret: string) => {
    const ts = String(Date.now());
    const nonce = `n${Math.random().toString(36).slice(2)}abcdefghijkl`;
    const pathname = "/api/tax-questionnaire/staff/returns";
    return new Request(`https://tax.ark-fid.ch${pathname}`, {
      method: "GET",
      headers: { "x-kyc-key-id": "cadence", "x-kyc-timestamp": ts, "x-kyc-nonce": nonce, "x-kyc-signature": signRequest(secret, "GET", pathname, ts, nonce, "") },
    });
  };
  const tax = "tax-secret-tax-secret-tax-secret-0123456";
  const kyc = "kyc-secret-kyc-secret-kyc-secret-0123456";
  assert.equal((await verifyStaffRequest(make(tax), staff.taxApiKeys())).ok, true);
  assert.equal((await verifyStaffRequest(make(kyc), staff.taxApiKeys())).ok, false);
  assert.equal((await verifyStaffRequest(make(kyc), apiKeys())).ok, true);
  assert.equal((await verifyStaffRequest(make(tax), apiKeys())).ok, false);
  assert.equal((await verifyStaffRequest(make(tax), new Map())).ok, false, "no keys: refused");
});

test("create: idempotent (replay finds the same case), no answers in the response", async () => {
  const input = { ...person(), sendInvitation: false };
  const first = await staff.createReturn(input, { idempotencyKey: "create-key-0001" }, deps);
  assert.equal(first.created, true);
  assert.equal(first.replayed, false);
  assert.equal(first.summary.caseId, staff.caseIdFor("create-key-0001"));
  assert.equal(first.summary.clientRef, input.clientRef);
  assert.equal(first.summary.canton, "GE");
  assert.ok(first.link.url.includes("#acces=") && Date.parse(first.link.expiresAt) > Date.now());
  assert.ok(!("answers" in first.summary));
  assert.equal(mails.length, 0, "sendInvitation false: nothing sent");
  assert.equal(rows(first.summary.caseId)[0].createKey, "create-key-0001");
  const again = await staff.createReturn(input, { idempotencyKey: "create-key-0001" }, deps);
  assert.equal(again.summary.caseId, first.summary.caseId);
  assert.equal(again.replayed, true);
  assert.equal(rows(first.summary.caseId).length, 1);
  // A later create with sendInvitation sends the invitation the first one left out.
  const send = await staff.createReturn({ ...input, sendInvitation: true }, { idempotencyKey: "create-key-0001" }, deps);
  assert.equal(send.replayed, true);
  assert.ok(send.summary.invitedAt);
  assert.equal(mails.length, 1);
});

test("create: an existing campaign return is adopted (adopted: true), never refused", async () => {
  const p = person();
  const campaign = await deps.campaign.createInvitedReturn({ clientKey: "ck-adopt", email: p.email, name: `${p.lastName.toUpperCase()} ${p.firstName}`, language: "fr", taxYear: YEAR });
  assert.equal(campaign.clientRef, undefined);
  const result = await staff.createReturn({ ...p, sendInvitation: false }, { idempotencyKey: "create-key-adopt" }, deps);
  assert.equal(result.adopted, true);
  assert.equal(result.created, false);
  assert.equal(result.summary.caseId, campaign.caseId);
  assert.equal(rows(campaign.caseId)[0].clientRef, p.clientRef);
  // Second time, found by clientRef.
  const again = await staff.createReturn({ ...p, email: "other@example.ch", sendInvitation: false }, { idempotencyKey: "create-key-adopt2" }, deps);
  assert.equal(again.summary.caseId, campaign.caseId);
  assert.equal(again.adopted, true);
});

test("feed: Modified order, 10-s quiet window, inclusive cursor, no inventory rows, no answers", async () => {
  await mem.ports.tracker.upsert({ caseId: "", source: "inventaire", householdId: "", clientKey: "", emailHash: "", name: "PLANNED Row", email: "", language: "fr", canton: "GE", taxYear: YEAR, state: "draft", regime: "", optIn: false, aiOptIn: false, driveId: "", folderId: "", folderUrl: "" } as ReturnRecord);
  const fresh = await staff.changes("", 200, { campaign: deps.campaign, now: () => new Date() });
  assert.ok(fresh.items.every((i) => Date.parse(i.updatedAt) <= Date.now() - staff.FEED_QUIET_MS), "rows written in the last 10 s wait");
  const later = { campaign: deps.campaign, now: () => new Date(Date.now() + 11_000) };
  const all = await staff.changes("", 200, later);
  const withCase = mem.returns.filter((r) => r.caseId);
  assert.equal(all.items.length, withCase.length, "rows without a case are skipped");
  assert.ok(all.items.every((i) => i.caseId && !("answers" in i)));
  const keys = all.items.map((i) => `${i.updatedAt}|${i.caseId}|${i.taxYear}`);
  assert.deepEqual(keys, [...keys].sort());
  const page1 = await staff.changes("", 2, later);
  assert.equal(page1.items.length, 2);
  assert.equal(page1.more, all.items.length > 2);
  const page2 = await staff.changes(page1.nextCursor, 2, later);
  assert.equal(`${page2.items[0].updatedAt}|${page2.items[0].caseId}|${page2.items[0].taxYear}`, page1.nextCursor, "cursor is >=: the last item comes back");
});

test("an unusable link says why: replaced (by e-mail on a date, or otherwise), expired, or invalid", async () => {
  const created = await staff.createReturn({ ...person(), sendInvitation: false }, { idempotencyKey: "create-key-why" }, deps);
  const caseId = created.summary.caseId;
  const refusal = async (url: string) => {
    const found = await access.linkStatus(tokenOf(url));
    assert.notEqual(found.status, "ok");
    return access.linkRefusal(found as Exclude<typeof found, { status: "ok" }>);
  };
  // Cadence e-mails the new link (notify), or the site does (send): the old one says so, with the date.
  const before = Date.now();
  const notified = await staff.staffAction(caseId, "link", { notify: "email" }, meta("why-key-0001"), deps);
  const first = await refusal(created.link.url);
  assert.equal(first.error, "link_replaced");
  assert.equal(first.via, "email");
  assert.ok(Date.parse(first.at!) >= before && Date.parse(first.at!) <= Date.now());
  const sent = await staff.staffAction(caseId, "link", { send: true }, meta("why-key-0002"), deps);
  assert.equal((await refusal(notified.link!.url)).via, "email");
  // Handed over otherwise: "other".
  const handed = await staff.staffAction(caseId, "link", {}, meta("why-key-0003"), deps);
  assert.equal((await refusal(sent.link!.url)).via, "other");
  // Expired (TTL passed, never revoked).
  const record = [...mem.access.values()].find((r) => r.kind === "link" && r.caseId === caseId && !r.revoked && r.purpose === "staff")!;
  record.expiresAt = Date.now() - 1;
  assert.deepEqual(await refusal(handed.link!.url), { error: "link_expired" });
  // Revoked without a replacement (draft deleted, …) or unknown: invalid; an earlier replacement stays.
  record.expiresAt = Date.now() + DAY;
  await mem.ports.access.revokeCase(caseId);
  assert.deepEqual(await refusal(handed.link!.url), { error: "link_invalid" });
  assert.equal((await refusal(created.link.url)).via, "email");
  assert.deepEqual(await refusal(`https://x/#acces=${"A".repeat(43)}`), { error: "link_invalid" });
});

test("link: revokes staff links only; an e-mail change revokes all; a replay mints one more and sends nothing", async () => {
  const created = await staff.createReturn({ ...person(), sendInvitation: false }, { idempotencyKey: "create-key-link" }, deps);
  const caseId = created.summary.caseId;
  const row = rows(caseId)[0];
  const invitation = await access.issueLink({ caseId, emailHash: row.emailHash, scope: "edit", purpose: "invitation", ttlMs: DAY, locale: "fr" });
  const first = await staff.staffAction(caseId, "link", {}, meta("link-key-0001"), deps);
  assert.ok(first.link);
  assert.equal(await access.readLink(tokenOf(created.link.url)), null, "earlier staff link revoked");
  assert.ok(await access.readLink(tokenOf(invitation)), "invitation link kept");
  assert.ok(await access.readLink(tokenOf(first.link!.url)));

  const sentBefore = mails.length;
  const sent = await staff.staffAction(caseId, "link", { send: true }, meta("link-key-0002", "p2"), deps);
  assert.equal(mails.length, sentBefore + 1);
  assert.equal(mails.at(-1)!.to[0], row.email);
  const replay = await staff.staffAction(caseId, "link", { send: true }, meta("link-key-0002", "p2"), deps);
  assert.equal(replay.replayed, true);
  assert.equal(mails.length, sentBefore + 1, "replay sends nothing");
  assert.ok(await access.readLink(tokenOf(sent.link!.url)), "replay revokes nothing");
  assert.ok(await access.readLink(tokenOf(replay.link!.url)));
  await assert.rejects(staff.staffAction(caseId, "link", {}, meta("link-key-0002", "other"), deps), /idempotency_conflict/);

  const changed = await staff.staffAction(caseId, "link", { email: "new.address@example.ch" }, meta("link-key-0003"), deps);
  assert.equal(changed.summary.email, "new.address@example.ch");
  assert.equal(rows(caseId)[0].emailHash, access.emailHash("new.address@example.ch"));
  assert.equal(await access.readLink(tokenOf(invitation)), null, "e-mail change revokes every link");
  assert.equal(await access.readLink(tokenOf(replay.link!.url)), null);
  assert.ok(await access.readLink(tokenOf(changed.link!.url)));
});

test("remind: mail by state, three-day rule (too_soon with nextAt), campaign counters", async () => {
  const created = await staff.createReturn({ ...person(), sendInvitation: false }, { idempotencyKey: "create-key-remind" }, deps);
  const caseId = created.summary.caseId;
  const n = mails.length;
  const invite = await staff.staffAction(caseId, "remind", { taxYear: YEAR }, meta("remind-0001"), deps);
  assert.equal(invite.extra?.kind, "invitation");
  assert.equal(invite.extra?.sent, true);
  assert.ok(invite.summary.invitedAt);
  assert.equal(mails.length, n + 1);

  const soon = await staff.staffAction(caseId, "remind", { taxYear: YEAR }, meta("remind-0002"), deps);
  assert.equal(soon.extra?.sent, false);
  assert.equal(soon.extra?.reason, "too_soon");
  assert.ok(Date.parse(String(soon.extra?.nextAt)) > clock);
  assert.equal(mails.length, n + 1);

  clock += 3 * DAY;
  const reminder = await staff.staffAction(caseId, "remind", { taxYear: YEAR }, meta("remind-0003"), deps);
  assert.equal(reminder.extra?.kind, "reminder");
  assert.equal(reminder.summary.remindersSent, 1);
  assert.equal(reminder.summary.lastReminderAt, new Date(clock).toISOString());
  assert.equal(mails.length, n + 2);
  const replay = await staff.staffAction(caseId, "remind", { taxYear: YEAR }, meta("remind-0003"), deps);
  assert.equal(replay.replayed, true);
  assert.equal(replay.extra?.sent, true);
  assert.equal(replay.extra?.kind, "reminder", "replay reports the mail sent");
  assert.equal(mails.length, n + 2, "replay sends nothing");

  // Submitted: the missing-documents mail and its counters.
  const row = rows(caseId)[0];
  await mem.ports.tracker.upsert({ ...row, state: "submitted", submittedAt: new Date(clock - 10 * DAY).toISOString() });
  const saved = deps.campaign.refreshMissing;
  deps.campaign.refreshMissing = async () => ["Certificat de salaire"];
  try {
    const missing = await staff.staffAction(caseId, "remind", { taxYear: YEAR }, meta("remind-0004"), deps);
    assert.equal(missing.extra?.kind, "missing");
    assert.equal(missing.summary.missingRemindersSent, 1);
    assert.equal(mails.length, n + 3);
    assert.match(mails.at(-1)!.html, /Certificat de salaire/);
  } finally {
    deps.campaign.refreshMissing = saved;
  }
  clock = Date.now();
});

test("exclude / include / deadline / staffDocs act on the row; attach sets clientRef on every year", async () => {
  const created = await staff.createReturn({ ...person(), sendInvitation: false }, { idempotencyKey: "create-key-row" }, deps);
  const caseId = created.summary.caseId;
  assert.equal((await staff.staffAction(caseId, "exclude", { taxYear: YEAR }, meta("row-0001"), deps)).summary.excluded, true);
  assert.equal((await staff.staffAction(caseId, "include", { taxYear: YEAR }, meta("row-0002"), deps)).summary.excluded, false);
  assert.equal((await staff.staffAction(caseId, "deadline", { taxYear: YEAR, extendedTo: `${YEAR + 1}-09-30` }, meta("row-0003"), deps)).summary.extendedTo, `${YEAR + 1}-09-30`);
  await assert.rejects(staff.staffAction(caseId, "deadline", { taxYear: YEAR, extendedTo: "30.09" }, meta("row-0004"), deps), /invalid_extended_to/);
  assert.deepEqual((await staff.staffAction(caseId, "staffDocs", { taxYear: YEAR, staffDocs: ["Relevé UBS", " Relevé UBS ", "Attestation 3a"] }, meta("row-0005"), deps)).summary.staffDocs, ["Relevé UBS", "Attestation 3a"]);
  const attached = await staff.staffAction(caseId, "attach", { clientRef: "res.partner:999" }, meta("row-0006"), deps);
  assert.equal(attached.summary.clientRef, "res.partner:999");
  assert.ok(rows(caseId).every((r) => r.clientRef === "res.partner:999"));
});

test("GET one return: documents with statuses and the answers", async () => {
  const created = await staff.createReturn({ ...person(), sendInvitation: false }, { idempotencyKey: "create-key-get" }, deps);
  const one = await staff.staffReturn(created.summary.caseId, String(YEAR), deps);
  assert.equal(one.caseId, created.summary.caseId);
  assert.ok(Array.isArray(one.documents));
  assert.ok(one.documents.every((d) => ["received", "office", "later", "na", "missing"].includes(d.status)));
  assert.equal(typeof one.answers, "object");
  await assert.rejects(staff.staffReturn("nope00000000", undefined, deps), /not_found/);
});

test("create: a shared address adopts only a couple's return; another client's is refused", async () => {
  const a = person();
  const first = await staff.createReturn({ ...a, sendInvitation: false }, { idempotencyKey: "create-key-coupleA" }, deps);
  const b = { ...person(), email: a.email };
  await assert.rejects(staff.createReturn({ ...b, sendInvitation: false }, { idempotencyKey: "create-key-coupleB" }, deps), /client_ref_conflict/);
  assert.equal(rows(first.summary.caseId)[0].clientRef, a.clientRef, "never overwritten");
  const couple = await staff.createReturn({ ...b, spouseRef: a.clientRef, sendInvitation: false }, { idempotencyKey: "create-key-coupleB2" }, deps);
  assert.equal(couple.adopted, true);
  assert.equal(couple.summary.caseId, first.summary.caseId);
  assert.equal(couple.summary.clientRef, a.clientRef);
  assert.equal(couple.summary.spouseRef, b.clientRef);
  const again = await staff.createReturn({ ...b, email: "b.own@example.ch", sendInvitation: false }, { idempotencyKey: "create-key-coupleB3" }, deps);
  assert.equal(again.summary.caseId, first.summary.caseId, "found by spouseRef");
});

test("link: a half-done e-mail change is finished by the retry (every year, every link)", async () => {
  const created = await staff.createReturn({ ...person(), sendInvitation: false }, { idempotencyKey: "create-key-halfdone" }, deps);
  const caseId = created.summary.caseId;
  const main = rows(caseId)[0];
  await mem.ports.tracker.upsert({ ...main, taxYear: YEAR - 1, trackerId: undefined, modifiedAt: undefined });
  const old = await access.issueLink({ caseId, emailHash: main.emailHash, scope: "edit", purpose: "invitation", ttlMs: DAY, locale: "fr" });
  // The first attempt changed the main year only, then failed.
  await mem.ports.tracker.upsert({ ...rows(caseId).find((r) => r.taxYear === YEAR)!, email: "moved@example.ch", emailHash: access.emailHash("moved@example.ch") });
  await staff.staffAction(caseId, "link", { email: "moved@example.ch" }, meta("link-halfdone-01"), deps);
  assert.ok(rows(caseId).length === 2 && rows(caseId).every((r) => r.email === "moved@example.ch" && r.emailHash === access.emailHash("moved@example.ch")));
  assert.equal(await access.readLink(tokenOf(old)), null);
});

test("remind: excluded clients and client-started drafts get nothing", async () => {
  const created = await staff.createReturn({ ...person(), sendInvitation: false }, { idempotencyKey: "create-key-excl" }, deps);
  const caseId = created.summary.caseId;
  const n = mails.length;
  await staff.staffAction(caseId, "exclude", { taxYear: YEAR }, meta("excl-0001"), deps);
  const excluded = await staff.staffAction(caseId, "remind", { taxYear: YEAR }, meta("excl-0002"), deps);
  assert.equal(excluded.extra?.sent, false);
  assert.equal(excluded.extra?.reason, "excluded");
  await staff.staffAction(caseId, "include", { taxYear: YEAR }, meta("excl-0003"), deps);
  await mem.ports.tracker.upsert({ ...rows(caseId)[0], state: "draft", source: "form" });
  const draft = await staff.staffAction(caseId, "remind", { taxYear: YEAR }, meta("excl-0004"), deps);
  assert.equal(draft.extra?.reason, "nothing_to_send");
  assert.equal(mails.length, n);
});

test("next year's return carries clientRef and spouseRef", async () => {
  const p = person();
  const prev = await deps.campaign.createInvitedReturn({ clientKey: "ck-carry", email: p.email, name: "CARRY Alex", language: "fr", taxYear: YEAR - 1, clientRef: "res.partner:7", spouseRef: "res.partner:8" });
  const next = await deps.campaign.createInvitedReturn({ clientKey: "ck-carry", email: p.email, name: "CARRY Alex", language: "fr", taxYear: YEAR, prefillFrom: prev });
  assert.equal(next.clientRef, "res.partner:7");
  assert.equal(next.spouseRef, "res.partner:8");
});

test("officeDocs: a document the office holds leaves the missing list and the reminder, stays listed for Cadence as office", async () => {
  const created = await staff.createReturn({ ...person(), sendInvitation: false }, { idempotencyKey: "create-key-office" }, deps);
  const caseId = created.summary.caseId;
  const row = rows(caseId)[0];
  const answers = { "start.arkDocs": [{ _id: "ark0001", label: "Relevé UBS" }, { _id: "ark0002", label: "Attestation 3a" }] };
  await storage.putFile(row.driveId, row.folderId, service.DRAFT_FILE, new TextEncoder().encode(JSON.stringify({ version: 1, savedAt: "", stepId: "start", answers, docStatus: {}, locale: "fr" })), "application/json");
  service.forgetCase(caseId);
  let one = await staff.staffReturn(caseId, String(YEAR), deps);
  assert.equal(one.documents.length, 2);
  const ubs = one.documents.find((d) => d.label === "Relevé UBS")!;
  assert.deepEqual(await service.missingDocuments(row, "fr"), ["Relevé UBS", "Attestation 3a"]);

  await assert.rejects(staff.staffAction(caseId, "officeDocs", { taxYear: YEAR, officeDocs: "x" }, meta("office-0002"), deps), /invalid_office_docs/);
  await staff.staffAction(caseId, "officeDocs", { taxYear: YEAR, officeDocs: [ubs.key, ubs.key] }, meta("office-0003"), deps);
  service.forgetCase(caseId);
  one = await staff.staffReturn(caseId, String(YEAR), deps);
  assert.equal(one.documents.find((d) => d.key === ubs.key)?.status, "office", "still listed for Cadence, held by the office");
  assert.deepEqual(await service.missingDocuments(rows(caseId)[0], "fr"), ["Attestation 3a"], "the reminder stops asking");
  const info = await service.getCase(caseId);
  assert.deepEqual(service.officeKeys(await service.officeDocs(storage, info)), [ubs.key], "the client's form leaves it out");

  // Submitted: the missing list and the counts follow at once.
  await mem.ports.tracker.upsert({ ...rows(caseId)[0], state: "submitted", submittedAt: new Date().toISOString() });
  await staff.staffAction(caseId, "officeDocs", { taxYear: YEAR, officeDocs: [ubs.key] }, meta("office-0004"), deps);
  assert.equal(rows(caseId)[0].missingDocs, "Attestation 3a");
  assert.equal(staff.summarize(rows(caseId)[0]).closed, false);
  assert.equal(staff.summarize({ ...rows(caseId)[0], staffStatus: "Clos" }).closed, true, "staff status « Clos » closes it for the office");
  // The whole list, replaced: an empty list asks for it again.
  await staff.staffAction(caseId, "officeDocs", { taxYear: YEAR, officeDocs: [] }, meta("office-0005"), deps);
  assert.equal(rows(caseId)[0].missingDocs, "Relevé UBS\nAttestation 3a");
});

// ---- office pre-fill (questions + prefill) ------------------------------------------------------------

async function withDraft(key: string, answers: Record<string, unknown>, filledBy?: Record<string, string>) {
  const created = await staff.createReturn({ ...person(), sendInvitation: false }, { idempotencyKey: key }, deps);
  const caseId = created.summary.caseId;
  const row = rows(caseId)[0];
  const draft = { version: 1, savedAt: "2020-01-01T00:00:00.000Z", stepId: "regime", answers: { ...answers, "start.email": row.email }, docStatus: { x1: "later" }, locale: "fr", ...(filledBy ? { filledBy } : {}) };
  await storage.putFile(row.driveId, row.folderId, service.DRAFT_FILE, new TextEncoder().encode(JSON.stringify(draft)), "application/json");
  service.forgetCase(caseId);
  return caseId;
}
const storedDraft = async (caseId: string) => {
  service.forgetCase(caseId);
  return (await service.readDraft(storage, await service.getCase(caseId)))!;
};
const prefill = (caseId: string, body: Record<string, unknown>, key: string, hash = "h") => staff.staffAction(caseId, "prefill", { taxYear: YEAR, by: "Sam", ...body }, meta(key, hash), deps);
const refusedWith = (code: string, status: number) => (e: unknown) => (e as { code: string; status: number }).code === code && (e as { status: number }).status === status;
const BASE = { "start.years": [String(YEAR)], "start.household": "single", "start.canton": "GE", "start.commune": "Genève", "start.communeBfs": "6621", "start.firstName": "Alex", "start.phone": "+41 22 000 00 00" };

test("GET one return: questions the client sees now, French labels, hidden and server-owned ones absent", async () => {
  const caseId = await withDraft("create-key-questions", BASE);
  const { questions } = await staff.staffReturn(caseId, String(YEAR), deps);
  const ids = questions.map((q) => q.id);
  const first = questions.find((q) => q.id === "start.firstName")!;
  assert.equal(first.kind, "field");
  assert.equal(first.label, "Prénom");
  assert.equal(first.step, "start");
  assert.equal(first.stepTitle, "Pour commencer");
  assert.equal((first as { required?: boolean }).required, true);
  const household = questions.find((q) => q.id === "start.household") as { options?: { value: string; label: string }[] };
  assert.ok(household.options?.some((o) => o.value === "couple"));
  for (const absent of ["start.spouseFirstName", "start.communeBfs", "start.arkPrefilled", "start.arkDocs", "start.email", "base.taxNumber", "work.employers"]) assert.ok(!ids.includes(absent), absent);
  assert.ok(ids.includes("start.commune") && ids.includes("router.items"));
  // A couple: the spouse's questions appear; groups list their visible row fields.
  const couple = await withDraft("create-key-questions2", { ...BASE, "start.household": "couple", "router.items": ["employed"] });
  const qs = (await staff.staffReturn(couple, String(YEAR), deps)).questions;
  assert.ok(qs.some((q) => q.id === "start.spouseFirstName"));
  const employers = qs.find((q) => q.id === "work.employers") as { kind: string; fields: { id: string }[]; maxRows: number };
  assert.equal(employers.kind, "group");
  assert.ok(employers.fields.some((f) => f.id === "name") && !employers.fields.some((f) => f.id === "carried"));
  assert.ok(employers.maxRows > 0);
});

test("prefill: writes as an office session, only changed answers marked with by; hidden ones reported", async () => {
  const caseId = await withDraft("create-key-prefill", BASE, { "start.firstName": "Anne" });
  const result = await prefill(caseId, { answers: { "start.phone": "+41 22 000 00 00", "start.commune": "Carouge", "start.spouseFirstName": "Kim", "work.employers": [{ name: "Acme SA" }] } }, "prefill-0001");
  assert.equal(result.replayed, false);
  const out = result.extra!.prefill as { written: string[]; unchanged: string[]; hidden: string[] };
  assert.deepEqual(out.written.sort(), ["start.commune", "start.spouseFirstName", "work.employers"]);
  assert.deepEqual(out.unchanged, ["start.phone"]);
  assert.deepEqual(out.hidden.sort(), ["start.spouseFirstName", "work.employers"]);
  const draft = await storedDraft(caseId);
  assert.deepEqual(draft.filledBy, { "start.firstName": "Anne", "start.commune": "Sam", "start.spouseFirstName": "Sam", "work.employers": "Sam" });
  assert.equal(draft.answers["start.commune"], "Carouge");
  assert.equal(draft.answers["start.communeBfs"], undefined, "the BFS number of the old commune goes");
  assert.equal(draft.answers["start.email"], rows(caseId)[0].email);
  assert.equal(draft.stepId, "regime");
  assert.deepEqual(draft.docStatus, { x1: "later" });
  assert.notEqual(draft.savedAt, "2020-01-01T00:00:00.000Z");
  const employers = draft.answers["work.employers"] as { _id: string; name: string }[];
  assert.equal(employers.length, 1);
  assert.match(employers[0]._id, /^[a-z0-9]{6,24}$/);
  // A row given with its stored _id keeps it (and its carried mark); a new row gets a new id.
  const again = await prefill(caseId, { answers: { "work.employers": [{ _id: employers[0]._id, name: "Acme SA" }, { name: "Beta SA" }] } }, "prefill-0002");
  assert.deepEqual((again.extra!.prefill as { written: string[] }).written, ["work.employers"]);
  const two = (await storedDraft(caseId)).answers["work.employers"] as { _id: string; name: string }[];
  assert.equal(two[0]._id, employers[0]._id);
  assert.equal(two[1].name, "Beta SA");
  assert.notEqual(two[1]._id, employers[0]._id);
});

test("prefill: unknown, hidden, server-owned, the address, bad or empty values refused all or nothing", async () => {
  const caseId = await withDraft("create-key-prefill-bad", BASE);
  const before = await storedDraft(caseId);
  const bad = { "start.commune": "Carouge", "nope.field": "x", "start.communeBfs": "6608", "start.arkDocs": [{ label: "x" }], "start.email": "x@example.ch", "start.phone": "abc", "start.firstName": " ", "work.employers": [{ name: "Acme", salary: "1" }] };
  await assert.rejects(prefill(caseId, { answers: bad }, "prefill-bad-1"), (e: unknown) => {
    const err = e as { code: string; status: number; detail: { fields: { id: string; error: string }[] } };
    assert.equal(err.code, "invalid_answers");
    assert.equal(err.status, 400);
    assert.deepEqual(Object.fromEntries(err.detail.fields.map((f) => [f.id, f.error])), {
      "nope.field": "unknown",
      "start.communeBfs": "not_allowed",
      "start.arkDocs": "not_allowed",
      "start.email": "not_allowed",
      "start.phone": "invalid_phone",
      "start.firstName": "empty",
      "work.employers[0].salary": "unknown",
    });
    return true;
  });
  for (const answers of [{}, [], "x", null]) await assert.rejects(prefill(caseId, { answers }, `prefill-bad-${JSON.stringify(answers)}`), refusedWith("invalid_answers", 400));
  assert.deepEqual(await storedDraft(caseId), before, "nothing written");
});

test("prefill: refused without by, closed for the office, submitted, unknown; replay writes once", async () => {
  const caseId = await withDraft("create-key-prefill-refuse", BASE);
  const answers = { "start.phone": "+41 79 111 11 11" };
  await assert.rejects(prefill(caseId, { answers, by: "" }, "pr-1"), refusedWith("invalid_by", 400));
  await assert.rejects(prefill(caseId, { answers, by: undefined }, "pr-2"), refusedWith("invalid_by", 400));
  await assert.rejects(prefill("nosuchcase1", { answers }, "pr-3"), refusedWith("not_found", 404));

  const first = await prefill(caseId, { answers }, "pr-4", "p1");
  assert.deepEqual((first.extra!.prefill as { written: string[] }).written, ["start.phone"]);
  const saved = await storedDraft(caseId);
  const replay = await prefill(caseId, { answers }, "pr-4", "p1");
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.extra!.prefill, { written: [], unchanged: ["start.phone"], hidden: [] });
  assert.deepEqual(await storedDraft(caseId), saved, "a replay writes nothing");
  await assert.rejects(prefill(caseId, { answers: { "start.phone": "+41 79 222 22 22" } }, "pr-4", "p2"), refusedWith("idempotency_conflict", 409));

  // Staff columns: set on the row itself, as in assist.test.ts.
  const row = rows(caseId)[0];
  row.staffStatus = "Clos";
  await assert.rejects(prefill(caseId, { answers }, "pr-5"), refusedWith("case_closed", 409));
  row.staffStatus = undefined;
  row.state = "submitted";
  await assert.rejects(prefill(caseId, { answers }, "pr-6"), refusedWith("already_submitted", 409));
  assert.deepEqual(await storedDraft(caseId), saved);
});
