import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.KYC_QF_TOKEN_SECRET = "test-secret-test-secret-test-secret-0123";
process.env.KYC_QF_STORAGE = "mock";
process.env.KYC_QF_API_KEYS = "cadence:cadence-secret-cadence-secret-cadence-01";

import { documentsFor } from "./documents";
import { pruneHidden, sanitizeAnswers, validateAll, visibleSteps } from "./engine";
import { flagsOf, routeMismatch } from "./flags";
import { createChallenge, createSession, emailHash, readLink, readSession, verifyChallenge } from "./server/access";
import { signRequest, verifyStaffRequest } from "./server/signature";
import { memoryAccess, memoryTracker } from "./server/ports";
import { changes, clientCase, confirmSigned, createCase, KycError, loadCase, saveDraft, staffAction, staffCase, submit } from "./server/service";
import { KycMockStorage, setPorts } from "./server/sharepoint";
import type { Answers } from "./types";

const row = (id: string, fields: Record<string, string>) => ({ _id: id, ...fields });
const person = { lastName: "Dupont", firstName: "Jean", birthDate: "01.02.1970", nationality: "Suisse", address: "Rue du Rhône 1, 1204 Genève", country: "Suisse" };

const pmCommon: Answers = {
  "start.privacy": "yes",
  "a.name": "Test SA",
  "a.legalForm": "SA",
  "a.uid": "CHE-123.456.789",
  "a.incorporationDate": "01.01.2020",
  "a.incorporationCountry": "Suisse",
  "a.seat": "c/o Ark Fiduciaire SA, bd Georges-Favon 26, 1204 Genève",
  "a.companyTaxCountry": "Suisse",
  "a.contactName": "Jean Dupont",
  "a.contactEmail": "jean@example.ch",
  "a.contactPhone": "+41 22 000 00 00",
  "a.ownPremises": "no",
  "a.ownStaff": "no",
  "a.listed": "no",
  "a.directors": [row("dir0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur", nationality: "Suisse", country: "Suisse" })],
  "a.signatories": [row("sig0001", { lastName: "Dupont", firstName: "Jean", signing: "individual" })],
  "b.shareholders": [row("sha0001", { name: "Jean Dupont", kind: "person", percent: "100" })],
  "b.structure": "no",
  "b.transparency": "notYet",
  "c.pep": "none",
  "c.sanctions": "no",
  "c.criminal": "no",
  "d.servicesPm": ["domiciliation", "accounting"],
  "d.purpose": "Conseil",
  "d.activity": "Conseil en gestion",
  "d.sector": "Conseil",
  "d.countries": "Suisse",
  "d.counterparties": "Clients en Suisse",
  "d.licence": "no",
  "e.companyAssets": "Capital libéré",
  "f.funds": "no",
  "g.turnover": "100'000",
  "g.operations": "50 par an, CHF 100'000",
  "g.typesPm": ["domestic"],
  "g.countries": "Suisse, CHF",
  "i.signers": [row("sgn0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur" })],
  "i.place": "Genève",
  "i.accept": "yes",
};

const pmOp: Answers = {
  ...pmCommon,
  route: "pm-op",
  "a.activityKind": "operates",
  "b.q25": "yes",
  "b.controllers25": [row("ctl0001", { ...person, percent: "100", holding: ["direct"] as unknown as string })],
  "b.forThird": "no",
  "e.ownersWealth": "Salaire",
};

const pmNonOp: Answers = {
  ...pmCommon,
  route: "pm-nonop",
  "a.activityKind": "assets",
  "b.ubos": [row("ubo0001", { ...person, wealth: "Héritage" })],
};

const pp: Answers = {
  route: "pp",
  "start.privacy": "yes",
  "a.lastName": "Martin",
  "a.firstName": "Anne",
  "a.birthDate": "03.04.1980",
  "a.birthPlace": "Lyon",
  "a.nationality": "France",
  "a.taxCountry": "Suisse",
  "a.address": "Rue de Lausanne 2, 1201 Genève",
  "a.country": "Suisse",
  "a.idType": "passport",
  "a.idNumber": "X123",
  "a.idExpiry": "01.01.2030",
  "a.profession": "Consultante",
  "a.email": "anne@example.ch",
  "a.phone": "+41 79 000 00 00",
  "b.ppOwner": "self",
  "b.ppStructure": "no",
  "c.pep": "none",
  "c.sanctions": "no",
  "c.criminal": "no",
  "d.servicesPp": ["formation"],
  "d.countries": "Suisse",
  "d.counterparties": "—",
  "d.licence": "no",
  "e.wealthSources": ["salary"],
  "e.wealthDetails": "Salaire",
  "f.funds": "no",
  "g.operations": "Peu",
  "g.typesPp": ["domestic"],
  "g.countries": "Suisse",
  "i.place": "Genève",
  "i.accept": "yes",
};

// ---- schema ------------------------------------------------------------------------------------

test("each route shows its own screens and its section B", () => {
  const ids = (a: Answers) => visibleSteps(a).map((s) => s.id);
  assert.deepEqual(ids(pp).filter((id) => id.startsWith("a.") || id.startsWith("b.")), ["a.pp", "b.pp"]);
  assert.deepEqual(ids(pmOp).filter((id) => id.startsWith("a.") || id.startsWith("b.")), ["a.pm", "b.pm"]);
  assert.equal(pruneHidden(pmOp)["b.ubos"], undefined, "no beneficial-owner list on the operating form");
  assert.equal(pruneHidden(pmNonOp)["b.controllers25"], undefined, "no 25 % cascade on the non-operating form");
});

test("complete answers are valid for each route", () => {
  for (const a of [pp, pmOp, pmNonOp]) assert.deepEqual(validateAll(pruneHidden(a)), {}, String(a.route));
});

test("operating cascade: 25 % → other control → most senior manager", () => {
  const no25 = pruneHidden({ ...pmOp, "b.q25": "no" });
  assert.equal(validateAll(no25)["b.qOther"], "required");
  const manager = pruneHidden({ ...pmOp, "b.q25": "no", "b.qOther": "no" });
  assert.equal(validateAll(manager)["b.manager"], "min_rows");
  assert.equal(manager["b.controllers25"], undefined);
  const unidentified = pruneHidden({ ...pmOp, "b.q25": "unidentified" });
  assert.equal(validateAll(unidentified)["b.manager"], "min_rows", "art. 2a al. 3: not identifiable → senior manager");
  assert.equal(validateAll(unidentified)["b.unidentifiedReason"], "required");
});

test("listed company: no cascade, no shareholder list, proof of listing requested", () => {
  const listed = pruneHidden({ ...pmOp, "a.listed": "yes", "a.listedWhere": "Holding AG, SIX" });
  assert.equal(listed["b.q25"], undefined);
  assert.deepEqual(validateAll(listed), {});
  assert.ok(documentsFor(listed).some((d) => d.key === "pm.listed"));
  assert.ok(flagsOf(listed).includes("listed"));
});

test("the route is server-owned: sanitising drops it", () => {
  assert.equal(sanitizeAnswers({ route: "pp", "a.name": "X" }).route, undefined);
});

test("route mismatch: operating form for an asset-holding company and the reverse", () => {
  assert.equal(routeMismatch({ ...pmOp, "a.activityKind": "assets" }), true);
  assert.equal(routeMismatch({ ...pmNonOp, "a.activityKind": "supports" }), true);
  assert.equal(routeMismatch({ ...pmNonOp, "a.activityKind": "notStarted" }), false);
});

test("documents: certified ID per form signatory, ID per section B person", () => {
  const keys = documentsFor(pruneHidden(pmNonOp)).map((d) => d.key);
  assert.ok(keys.includes("pm.signer:sgn0001"));
  assert.ok(keys.includes("pm.person:ubo0001"));
  assert.ok(documentsFor(pp).some((d) => d.key === "pp.id"));
});

// ---- service ---------------------------------------------------------------------------------

async function fixture() {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), "kyc-test-"));
  const storage = new KycMockStorage(base);
  const tracker = memoryTracker();
  const access = memoryAccess();
  const mails: unknown[] = [];
  setPorts({ storage, tracker, access, sendMail: async (m) => void mails.push(m) });
  const rel = path.join("Dossiers LBA Clients", "Test SA");
  await fs.mkdir(path.join(base, rel), { recursive: true });
  const clientFolder = { driveId: "mock-drive", itemId: storage.idOf(rel) };
  return { base, storage, tracker, access, mails, clientFolder };
}

const createInput = (clientFolder: { driveId: string; itemId: string }, route = "pm-op") => ({
  clientRef: "cadence-42",
  displayName: "Test SA",
  route,
  language: "fr",
  email: "jean@example.ch",
  clientFolder,
  prefill: { "a.name": "Test SA", "a.uid": "CHE-123.456.789", route: "pp" },
});

async function uploadAll(f: Awaited<ReturnType<typeof fixture>>, caseId: string, answers: Answers) {
  const record = await loadCase(caseId);
  for (const item of documentsFor(pruneHidden(answers)).filter((d) => d.required)) {
    await f.storage.putFile(record.driveId, record.revisions[record.revisions.length - 1].docsFolderId, `[${item.code}] doc - scan.pdf`, new TextEncoder().encode("%PDF-1.4 test"), "application/pdf");
  }
}

test("create → fill → submit → PDF → signed scan, frozen with its SHA-256", async () => {
  const f = await fixture();
  const meta = { keyId: "cadence", idempotencyKey: "create-0001", payloadHash: "h1" };
  const created = await createCase(createInput(f.clientFolder), meta);
  assert.equal(f.mails.length, 0, "no e-mail sent on creation (Cadence sends the invitation)");
  assert.match(created.link.url, /#acces=/);
  const caseId = created.summary.caseId;

  // Replay with the same key and payload: same case; another payload under that key: conflict.
  const again = await createCase(createInput(f.clientFolder), meta);
  assert.equal(again.summary.caseId, caseId);
  assert.equal(again.replayed, true);
  await assert.rejects(createCase(createInput(f.clientFolder), { ...meta, payloadHash: "other" }), (e: unknown) => e instanceof KycError && e.code === "idempotency_conflict");

  const session = { caseId, revision: 1 };
  const view = await clientCase(session);
  assert.equal(view.answers.route, "pm-op", "the prefill cannot change Ark's route");
  assert.ok(view.prefilledIds.includes("a.uid"));

  await saveDraft(session, { answers: pmOp, stepId: "d" });
  await assert.rejects(submit(session, { answers: pmOp }), (e: unknown) => e instanceof KycError && e.code === "missing_documents");
  await uploadAll(f, caseId, pmOp);
  const sent = await submit(session, { answers: pmOp, submitKey: "k1" });
  assert.equal(sent.state, "awaiting_signature");
  assert.match(String(sent.declarationId), new RegExp(`^${caseId}-R1-[0-9A-F]{8}$`));
  assert.deepEqual(await submit(session, { answers: pmOp, submitKey: "k1" }), sent, "a repeated submit returns the same result");

  const record = await loadCase(caseId);
  const rev = record.revisions[0];
  const json = await f.storage.readFile(record.driveId, rev.folderId, "questionnaire.json");
  const { createHash } = await import("node:crypto");
  assert.equal(createHash("sha256").update(json!).digest("hex"), rev.json!.sha256);
  assert.ok(rev.pdf && (await f.storage.readFile(record.driveId, rev.folderId, rev.pdf.name))!.byteLength > 1000);

  await assert.rejects(confirmSigned(session), (e: unknown) => e instanceof KycError && e.code === "signed_missing");
  const signedFolder = await f.storage.ensureSubfolder(record.driveId, rev.folderId, "Signé");
  await f.storage.putFile(record.driveId, signedFolder, "Formulaire signé R1 - scan.pdf", new TextEncoder().encode("%PDF-1.4 signed"), "application/pdf");
  assert.equal((await confirmSigned(session)).state, "signed");
  const summary = await staffCase(caseId);
  assert.equal(summary.actionRequired, "review_kyc");
  assert.equal(summary.latestRevision.signed?.length, 1);
  assert.equal(summary.answers?.["a.name"], "Test SA");

  // Correction: a new revision; the signed one is untouched and its sessions stop working.
  await assert.rejects(staffAction(caseId, "reopen", { expectedRevision: 2 }, { idempotencyKey: "reopen-0001", payloadHash: "r" }), (e: unknown) => e instanceof KycError && e.code === "revision_conflict");
  const reopened = await staffAction(caseId, "reopen", { expectedRevision: 1, prefill: { "d.sector": "Fiduciaire" } }, { idempotencyKey: "reopen-0001", payloadHash: "r" });
  assert.equal(reopened.summary.latestRevision.n, 2);
  assert.ok(reopened.link);
  assert.deepEqual(reopened.summary.revisions.map((r) => r.state), ["superseded", "open"]);
  await assert.rejects(clientCase(session), (e: unknown) => e instanceof KycError && e.code === "revision_superseded");
  const v2 = await clientCase({ caseId, revision: 2 });
  assert.equal(v2.answers["d.sector"], "Fiduciaire");
  assert.equal(v2.answers["a.name"], "Test SA", "previous answers carried over");
  assert.ok((await f.storage.readFile(record.driveId, rev.folderId, rev.pdf!.name))!.byteLength > 1000, "revision 1 files kept");
  const replay = await staffAction(caseId, "reopen", { expectedRevision: 1, prefill: { "d.sector": "Fiduciaire" } }, { idempotencyKey: "reopen-0001", payloadHash: "r" });
  assert.equal(replay.summary.latestRevision.n, 2, "a replayed reopen does not create a third revision");

  const feed = await changes("", 10);
  assert.equal(feed.items[0].caseId, caseId);
  assert.equal(feed.items[0].revision, 2);
  assert.equal((await changes(feed.nextCursor, 10)).items.length, 0);

  await staffAction(caseId, "close", { expectedRevision: 2 }, { idempotencyKey: "close-0001", payloadHash: "c" });
  await assert.rejects(clientCase({ caseId, revision: 2 }), (e: unknown) => e instanceof KycError && e.code === "case_closed");
});

test("a client description contradicting Ark's form goes back to Ark, nothing to sign", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder, "pm-op"), { keyId: "cadence", idempotencyKey: "create-0002", payloadHash: "h" });
  const answers = { ...pmOp, "a.activityKind": "assets" };
  await uploadAll(f, created.summary.caseId, answers);
  const sent = await submit({ caseId: created.summary.caseId, revision: 1 }, { answers });
  assert.equal(sent.state, "returned");
  assert.equal(sent.declarationId, null);
  assert.equal((await staffCase(created.summary.caseId)).actionRequired, "review_route");
  // Ark changes the route on the new revision.
  const reopened = await staffAction(created.summary.caseId, "reopen", { expectedRevision: 1, route: "pm-nonop" }, { idempotencyKey: "reopen-0002", payloadHash: "x" });
  assert.equal(reopened.summary.route, "pm-nonop");
});

test("client folder outside LBA - OAR or missing is refused", async () => {
  const f = await fixture();
  await assert.rejects(createCase({ ...createInput(f.clientFolder), clientFolder: { driveId: "mock-drive", itemId: f.storage.idOf("nope") } }, { keyId: "c", idempotencyKey: "create-0003", payloadHash: "h" }), (e: unknown) => e instanceof KycError && e.code === "client_folder_not_found");
  await assert.rejects(createCase({ ...createInput(f.clientFolder), route: "trust" }, { keyId: "c", idempotencyKey: "create-0004", payloadHash: "h" }), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
});

// ---- access --------------------------------------------------------------------------------------

test("links, one-time codes and sessions", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-0005", payloadHash: "h" });
  const token = created.link.url.split("#acces=")[1];
  const link = await readLink(token);
  assert.equal(link?.caseId, created.summary.caseId);
  const { code, challenge } = createChallenge({ caseId: link!.caseId, revision: 1, emailHash: emailHash("jean@example.ch") });
  assert.equal(verifyChallenge(challenge, "000000").ok, code === "000000");
  const ok = verifyChallenge(challenge, code);
  if (code !== "000000") assert.equal(ok.ok, true);
  assert.equal(verifyChallenge(challenge, code).ok, false, "single use");
  const raw = await createSession({ caseId: link!.caseId, revision: 1, emailHash: "x" });
  assert.equal((await readSession(raw))?.caseId, link!.caseId);
  // A new link revokes the old one.
  await staffAction(created.summary.caseId, "link", { expectedRevision: 1 }, { idempotencyKey: "link-0001", payloadHash: "l" });
  assert.equal(await readLink(token), null);
});

test("Cadence requests: signature, clock window, single-use nonce, idempotency key", async () => {
  const secret = "cadence-secret-cadence-secret-cadence-01";
  const make = (opts: { ts?: number; nonce?: string; sig?: string; idem?: string } = {}) => {
    const ts = String(opts.ts ?? Date.now());
    const nonce = opts.nonce ?? `n${Math.random().toString(36).slice(2)}abcdefghij`;
    const body = JSON.stringify({ a: 1 });
    const sig = opts.sig ?? signRequest(secret, "POST", "/api/kyc-questionnaire/staff/cases", ts, nonce, body);
    return new Request("https://kyc.ark-fid.ch/api/kyc-questionnaire/staff/cases", {
      method: "POST",
      body,
      headers: { "x-kyc-key-id": "cadence", "x-kyc-timestamp": ts, "x-kyc-nonce": nonce, "x-kyc-signature": sig, "idempotency-key": opts.idem ?? "idem-key-0001" },
    });
  };
  const status = async (r: Request) => {
    const v = await verifyStaffRequest(r);
    return v.ok ? 200 : v.status;
  };
  assert.equal(await status(make()), 200);
  assert.equal(await status(make({ sig: "bad" })), 401);
  assert.equal(await status(make({ ts: Date.now() - 10 * 60 * 1000 })), 401);
  const fixed = "fixed-nonce-abcdefghijkl";
  assert.equal(await status(make({ nonce: fixed })), 200);
  assert.equal(await status(make({ nonce: fixed })), 401, "replay refused");
  assert.equal(await status(make({ idem: "x" })), 400);
});

test("a correction keeps the documents already sent: they count, frozen with their hash, not deletable", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder, "pm-op"), { keyId: "cadence", idempotencyKey: "create-0006", payloadHash: "h" });
  const caseId = created.summary.caseId;
  await uploadAll(f, caseId, pmOp);
  await submit({ caseId, revision: 1 }, { answers: pmOp });
  const r1 = (await loadCase(caseId)).revisions[0];
  assert.ok(r1.documents?.every((d) => d.status !== "uploaded" || d.files.every((x) => /^[0-9a-f]{64}$/.test(x.sha256))));
  await staffAction(caseId, "reopen", { expectedRevision: 1 }, { idempotencyKey: "reopen-0006", payloadHash: "r" });
  const v2 = await clientCase({ caseId, revision: 2 });
  assert.ok(v2.files.length > 0 && v2.files.every((x) => "carried" in x));
  const sent = await submit({ caseId, revision: 2 }, { answers: pmOp });
  assert.equal(sent.state, "awaiting_signature", "no new upload needed");
  const { deleteUpload } = await import("./server/service");
  await assert.rejects(deleteUpload({ caseId, revision: 2 }, { fileId: v2.files[0].id }), (e: unknown) => e instanceof KycError);
});

test("a create retried after a partial failure resumes the same case", async () => {
  const f = await fixture();
  const meta = { keyId: "cadence", idempotencyKey: "create-0007", payloadHash: "h" };
  const first = await createCase(createInput(f.clientFolder), meta);
  f.tracker.rows.length = 0; // the list row was never written
  const again = await createCase(createInput(f.clientFolder), meta);
  assert.equal(again.summary.caseId, first.summary.caseId);
  assert.equal(again.replayed, true);
  assert.equal(f.tracker.rows.length, 1);
});
