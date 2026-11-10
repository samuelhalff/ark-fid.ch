import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

process.env.KYC_QF_TOKEN_SECRET = "test-secret-test-secret-test-secret-0123";
process.env.KYC_QF_STORAGE = "mock";
process.env.KYC_QF_API_KEYS = "cadence:cadence-secret-cadence-secret-cadence-01";

import { documentsFor } from "./documents";
import { pruneHidden, sanitizeAnswers, validateAll, visibleSteps } from "./engine";
import { flagsOf, routeMismatch } from "./flags";
import { createChallenge, createPick, createSession, emailHash, readLink, readPick, readSession, STAFF_HASH, redeemAssist, verifyChallenge } from "./server/access";
import { signRequest, verifyStaffRequest } from "./server/signature";
import { memoryAccess, memoryTracker } from "./server/ports";
import { accessFor, changes, clientCase, confirmSigned, contactOf, createCase, createUpload, deleteUpload, KycError, readPdf, signOnline, loadCase, saveDraft, staffAction, staffCase, submit } from "./server/service";
import { KycMockStorage, setPorts } from "./server/sharepoint";
import type { Answers } from "./types";

const row = (id: string, fields: Record<string, string>) => ({ _id: id, ...fields });
const drawing = async (ink = true) => {
  const pixels = Buffer.alloc(600 * 180 * 4);
  if (ink) for (let x = 80; x < 320; x++) for (let y = 65; y < 69; y++) {
    const at = (y * 600 + x) * 4;
    pixels[at + 3] = 255;
  }
  const png = await sharp(pixels, { raw: { width: 600, height: 180, channels: 4 } }).png().toBuffer();
  return `data:image/png;base64,${png.toString("base64")}`;
};
const JEAN = emailHash("jean@example.ch");
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
  assert.ok(flagsOf({ ...pmOp, "a.ownPremises": "no", "a.ownStaff": "no" }).includes("noSubstance"));
  assert.ok(!flagsOf({ ...pmOp, "a.ownPremises": "yes", "a.ownStaff": "no" }).includes("noSubstance"));
  assert.ok(!flagsOf({ ...pmNonOp, "a.ownPremises": "no", "a.ownStaff": "no" }).includes("noSubstance"));
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

  const session = { caseId, revision: 1, emailHash: JEAN };
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
  assert.ok(summary.documentItems.some((item) => item.files.some((file) => file.webUrl)), "staff receives links to files that still exist");

  // Correction: a new revision; the signed one is untouched and its sessions stop working.
  await assert.rejects(staffAction(caseId, "reopen", { expectedRevision: 2 }, { idempotencyKey: "reopen-0001", payloadHash: "r" }), (e: unknown) => e instanceof KycError && e.code === "revision_conflict");
  const reopened = await staffAction(caseId, "reopen", { expectedRevision: 1, prefill: { "d.sector": "Fiduciaire" } }, { idempotencyKey: "reopen-0001", payloadHash: "r" });
  assert.equal(reopened.summary.latestRevision.n, 2);
  assert.ok(reopened.link);
  assert.deepEqual(reopened.summary.revisions.map((r) => r.state), ["superseded", "open"]);
  await assert.rejects(clientCase(session), (e: unknown) => e instanceof KycError && e.code === "revision_superseded");
  const v2 = await clientCase({ caseId, revision: 2, emailHash: JEAN });
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
  await assert.rejects(clientCase({ caseId, revision: 2, emailHash: JEAN }), (e: unknown) => e instanceof KycError && e.code === "case_closed");
});

test("staff prefill keeps client answers and rejects a stale open-tab save", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-prefill-race", payloadHash: "race" });
  const caseId = created.summary.caseId;
  const session = { caseId, revision: 1, emailHash: JEAN };
  const opened = await clientCase(session);
  await saveDraft(session, { answers: { "a.name": "Client's spelling", "a.lastName": "Hidden old value" }, staffPrefillVersion: 0 });
  await staffAction(caseId, "prefill", { expectedRevision: 1, prefill: { "a.name": "Ark spelling", "d.sector": "Fiduciaire" } }, { idempotencyKey: "prefill-race-01", payloadHash: "prefill-race" });
  const staff = await staffCase(caseId);
  assert.equal(staff.draft?.["a.name"], "Client's spelling");
  assert.equal(staff.draft?.["a.lastName"], undefined, "a question hidden on this route is not sent to staff");
  assert.equal(staff.draft?.["d.sector"], "Fiduciaire");
  assert.ok(staff.pages.some((page) => page.fieldIds.includes("a.name")));
  assert.ok(staff.pages.some((page) => page.missingFieldIds.includes("a.uid")), "staff sees the form's own incomplete fields");
  assert.ok(staff.pages.some((page) => page.parts.some((part) => part.kind === "field")), "page copy keeps client order");
  assert.ok(staff.pages.find((page) => page.id === "i")?.parts.some((part) => part.id === "i.declarations" && part.text?.fr !== "{declarations}"), "staff sees the actual client declarations");
  assert.ok(staff.pages.some((page) => page.id === "h"), "Ark sees the same pages as the client");
  assert.ok(staff.documentItems.some((item) => item.key === "pm.rc"), "Ark sees the document page's items");
  assert.equal(opened.draft?.staffPrefillVersion || 0, 0);
  await assert.rejects(saveDraft(session, { answers: { "a.name": "Client's spelling" }, staffPrefillVersion: 0 }), (e: unknown) => e instanceof KycError && e.code === "draft_changed");
  const current = await clientCase(session);
  await saveDraft(session, { answers: current.draft?.answers, staffPrefillVersion: current.draft?.staffPrefillVersion });
  assert.equal((await staffCase(caseId)).draft?.["d.sector"], "Fiduciaire");
});

test("signing online binds the verified name and drawing to the PDF the signer read", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-0010", payloadHash: "h" });
  const caseId = created.summary.caseId;
  const session = { caseId, revision: 1, emailHash: JEAN };
  await uploadAll(f, caseId, pmOp);
  await submit(session, { answers: pmOp });
  const view = await clientCase(session);
  assert.equal(view.signing?.online, true);
  assert.deepEqual(view.signing?.signers.map((s) => [s.name, s.mine]), [["Jean Dupont", true]], "a company's sole signatory signs at the case address");
  assert.equal(f.mails.length, 0, "no request e-mail to the contact");
  const declarationId = view.declarationId;
  await assert.rejects(signOnline(session, { name: "Jean Dupont", accept: true, declarationId: "OTHER-R1-00000000" }), (e: unknown) => e instanceof KycError && e.code === "case_changed");
  await assert.rejects(signOnline(session, { name: "Jean Dupont", declarationId }), (e: unknown) => e instanceof KycError && e.code === "signature_not_accepted");
  await assert.rejects(signOnline(session, { name: "Paul Martin", accept: true, declarationId }), (e: unknown) => e instanceof KycError && e.code === "signature_name");
  await assert.rejects(signOnline(session, { name: "---", accept: true, declarationId }), (e: unknown) => e instanceof KycError && e.code === "signature_name");
  await assert.rejects(signOnline(session, { name: "Jean Dupont", accept: true, declarationId }), (e: unknown) => e instanceof KycError && e.code === "signature_image");
  await assert.rejects(signOnline(session, { name: "Jean Dupont", accept: true, declarationId, drawing: await drawing(false) }), (e: unknown) => e instanceof KycError && e.code === "signature_image");
  assert.equal((await signOnline(session, { name: "  dupont JEAN ", accept: true, declarationId, drawing: await drawing() })).state, "signed");
  const record = await loadCase(caseId);
  const rev = record.revisions[0];
  assert.equal(rev.signers?.[0].signature?.email, "jean@example.ch");
  const original = await f.storage.readFile(record.driveId, rev.folderId, rev.pdf!.name);
  const { createHash } = await import("node:crypto");
  assert.equal(rev.signers?.[0].signature?.pdfSha256, createHash("sha256").update(original!).digest("hex"));
  assert.ok(rev.signers?.[0].signature?.drawnPng, "drawing stays with the signer's evidence");
  const signedFolder = await f.storage.ensureSubfolder(record.driveId, rev.folderId, "Signé");
  const signedPdf = await f.storage.readFile(record.driveId, signedFolder, rev.signed![0].name);
  const { PDFDocument, PDFName, PDFRawStream } = await import("pdf-lib");
  const signedDocument = await PDFDocument.load(signedPdf!);
  assert.equal(signedDocument.getPageCount(), (await PDFDocument.load(original!)).getPageCount() + 1, "one signature page added");
  assert.ok(signedDocument.context.enumerateIndirectObjects().some(([, object]) => object instanceof PDFRawStream && object.dict.get(PDFName.of("Subtype"))?.toString() === "/Image"), "the PDF embeds the drawn PNG");
  assert.equal((await staffCase(caseId)).latestRevision.signers?.[0].typed, "dupont JEAN");
  assert.equal((await signOnline(session, { name: "x", accept: true, declarationId })).state, "signed", "a repeated signature changes nothing");
});

test("several signatories: each signs with their own address and code; the contact cannot sign for them", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-0012", payloadHash: "h" });
  const caseId = created.summary.caseId;
  const contact = { caseId, revision: 1, emailHash: JEAN };
  const two = (paulEmail: string): Answers => ({
    ...pmOp,
    "i.signers": [row("sgn0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur", email: "jean@example.ch" }), row("sgn0002", { lastName: "Martin", firstName: "Paul", function: "Administrateur", email: paulEmail })],
  });
  await uploadAll(f, caseId, two("paul@example.ch"));
  await assert.rejects(submit(contact, { answers: two("JEAN@example.ch") }), (e: unknown) => e instanceof KycError && e.code === "signer_email_duplicate");
  await submit(contact, { answers: two("paul@example.ch"), submitKey: "s12" });
  // Paul gets one request with his own link; nothing goes to the contact.
  assert.equal(f.mails.length, 1);
  const mail = f.mails[0] as { to: string[]; html: string };
  assert.deepEqual(mail.to, ["paul@example.ch"]);
  const token = /#acces=([A-Za-z0-9_-]+)/.exec(mail.html)![1];
  const link = await readLink(token);
  assert.equal(link?.emailHash, emailHash("paul@example.ch"));
  assert.equal((await accessFor(caseId, emailHash("paul@example.ch")))?.email, "paul@example.ch", "Paul's code goes to Paul");
  assert.equal(await accessFor(caseId, emailHash("other@example.ch")), null);
  assert.deepEqual(await f.access.casesByEmail(emailHash("paul@example.ch")), [caseId], "Paul can also ask for a code without the link");
  // A submit retry does not send the request twice.
  await submit(contact, { answers: two("paul@example.ch"), submitKey: "s12" });
  assert.equal(f.mails.length, 1);

  const paul = { caseId, revision: 1, emailHash: emailHash("paul@example.ch") };
  const paulView = await clientCase(paul);
  assert.equal(paulView.signing?.role, "signer");
  assert.deepEqual(paulView.answers, { route: "pm-op" }, "a signer does not see the answers");
  assert.equal(paulView.files.length, 0);
  await assert.rejects(saveDraft(paul, { answers: pmOp }), (e: unknown) => e instanceof KycError && e.code === "not_allowed");
  await assert.rejects(confirmSigned(paul), (e: unknown) => e instanceof KycError && e.code === "not_allowed");
  assert.ok((await readPdf(paul)).bytes.byteLength > 1000, "a signer reads the PDF");
  const declarationId = paulView.declarationId;
  // The contact signs as Jean, never as Paul.
  await assert.rejects(signOnline(contact, { name: "Paul Martin", accept: true, declarationId }), (e: unknown) => e instanceof KycError && e.code === "signature_name");
  assert.equal((await signOnline(contact, { name: "Jean Dupont", accept: true, declarationId, drawing: await drawing() })).state, "awaiting_signature");
  assert.equal((await signOnline(contact, { name: "Jean Dupont", accept: true, declarationId })).state, "awaiting_signature", "signing twice changes nothing");
  // Online started: no paper scan any more.
  await assert.rejects(createUpload(contact, { kind: "signed", fileName: "scan.pdf", size: 1000, mime: "application/pdf" }), (e: unknown) => e instanceof KycError && e.code === "online_signing_started");
  // A reminder to the contact (new link) does not cut Paul off.
  await staffAction(caseId, "link", { expectedRevision: 1 }, { idempotencyKey: "link-0012", payloadHash: "l" });
  assert.ok(await readLink(token), "Paul's link survives the contact's new link");
  assert.equal((await signOnline(paul, { name: "martin paul", accept: true, declarationId, drawing: await drawing() })).state, "signed");
  const rev = (await loadCase(caseId)).revisions[0];
  const signedFolder = await f.storage.ensureSubfolder("mock-drive", rev.folderId, "Signé");
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load((await f.storage.readFile("mock-drive", signedFolder, rev.signed![0].name))!);
  assert.ok(pdf.getPageCount() > 1);
  assert.equal(await accessFor(caseId, emailHash("paul@example.ch")), null, "after signing, no more codes for Paul");
});

test("Ark gives the signatories' addresses after submission (form entered by hand): requests go out", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-0013", payloadHash: "h" });
  const caseId = created.summary.caseId;
  const contact = { caseId, revision: 1, emailHash: JEAN };
  const answers: Answers = { ...pmOp, "i.signers": [row("sgn0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur" }), row("sgn0002", { lastName: "Martin", firstName: "Paul", function: "Administrateur" })] };
  await uploadAll(f, caseId, answers);
  await submit(contact, { answers });
  assert.equal((await clientCase(contact)).signing?.online, false, "no addresses: paper");
  await assert.rejects(staffAction(caseId, "signers", { expectedRevision: 1, signers: [{ id: "sgn0001", email: "a@example.ch" }, { id: "sgn0002", email: "A@example.ch" }] }, { idempotencyKey: "sig-0013a", payloadHash: "a" }), (e: unknown) => e instanceof KycError && e.code === "signer_email_duplicate");
  const done = await staffAction(caseId, "signers", { expectedRevision: 1, signers: [{ id: "sgn0001", email: "jean.d@example.ch" }, { id: "sgn0002", email: "paul@example.ch" }] }, { idempotencyKey: "sig-0013", payloadHash: "s" });
  assert.deepEqual(done.summary.latestRevision.signers?.map((s) => [s.email, s.emailBy, !!s.invitedAt]), [["jean.d@example.ch", "ark", true], ["paul@example.ch", "ark", true]]);
  assert.deepEqual(f.mails.map((m) => (m as { to: string[] }).to[0]), ["jean.d@example.ch", "paul@example.ch"]);
  const replay = await staffAction(caseId, "signers", { expectedRevision: 1, signers: [{ id: "sgn0001", email: "jean.d@example.ch" }, { id: "sgn0002", email: "paul@example.ch" }] }, { idempotencyKey: "sig-0013", payloadHash: "s" });
  assert.equal(replay.replayed, true);
  assert.equal(f.mails.length, 2, "a replay sends nothing");
  // The contact is not a signer here: it can follow, not sign.
  const view = await clientCase(contact);
  assert.equal(view.signing?.online, true);
  assert.ok(view.signing?.signers.every((s) => !s.mine));
  await assert.rejects(signOnline(contact, { name: "Jean Dupont", accept: true, declarationId: view.declarationId }), (e: unknown) => e instanceof KycError && e.code === "not_a_signer");
});

test("addresses given in two steps: both signatories get their request once the second is known", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-0014", payloadHash: "h" });
  const caseId = created.summary.caseId;
  const answers: Answers = { ...pmOp, "i.signers": [row("sgn0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur" }), row("sgn0002", { lastName: "Martin", firstName: "Paul", function: "Administrateur" })] };
  await uploadAll(f, caseId, answers);
  await submit({ caseId, revision: 1, emailHash: JEAN }, { answers });
  await staffAction(caseId, "signers", { expectedRevision: 1, signers: [{ id: "sgn0001", email: "jean.d@example.ch" }] }, { idempotencyKey: "sig-0014a", payloadHash: "a" });
  assert.equal(f.mails.length, 0, "not yet: Paul has no address");
  await staffAction(caseId, "signers", { expectedRevision: 1, signers: [{ id: "sgn0002", email: "paul@example.ch" }] }, { idempotencyKey: "sig-0014b", payloadHash: "b" });
  assert.deepEqual(f.mails.map((m) => (m as { to: string[] }).to[0]).sort(), ["jean.d@example.ch", "paul@example.ch"]);
  await staffAction(caseId, "signers", { expectedRevision: 1, signers: [{ id: "sgn0002", email: "paul@example.ch" }] }, { idempotencyKey: "sig-0014c", payloadHash: "c" });
  assert.equal(f.mails.length, 2, "the same address is not requested twice");
});

test("a client description contradicting Ark's form goes back to Ark, nothing to sign", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder, "pm-op"), { keyId: "cadence", idempotencyKey: "create-0002", payloadHash: "h" });
  const answers = { ...pmOp, "a.activityKind": "assets" };
  await uploadAll(f, created.summary.caseId, answers);
  const sent = await submit({ caseId: created.summary.caseId, revision: 1, emailHash: JEAN }, { answers });
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
  await submit({ caseId, revision: 1, emailHash: JEAN }, { answers: pmOp });
  const r1 = (await loadCase(caseId)).revisions[0];
  assert.ok(r1.documents?.every((d) => d.status !== "uploaded" || d.files.every((x) => /^[0-9a-f]{64}$/.test(x.sha256))));
  await staffAction(caseId, "reopen", { expectedRevision: 1 }, { idempotencyKey: "reopen-0006", payloadHash: "r" });
  const v2 = await clientCase({ caseId, revision: 2, emailHash: JEAN });
  assert.ok(v2.files.length > 0 && v2.files.every((x) => "carried" in x));
  assert.ok((await staffCase(caseId)).documentItems.some((item) => item.files.some((file) => file.webUrl)), "staff can open a carried document");
  const sent = await submit({ caseId, revision: 2, emailHash: JEAN }, { answers: pmOp });
  assert.equal(sent.state, "awaiting_signature", "no new upload needed");
  const missingDocument = r1.documents!.find((item) => item.files.length)!;
  await f.storage.deleteFile("mock-drive", missingDocument.files[0].itemId);
  assert.equal((await staffCase(caseId)).documentItems.find((item) => item.key === missingDocument.key)?.unavailable, true,
    "a frozen filename does not hide a missing SharePoint file");
  const { deleteUpload } = await import("./server/service");
  await assert.rejects(deleteUpload({ caseId, revision: 2, emailHash: JEAN }, { fileId: v2.files[0].id }), (e: unknown) => e instanceof KycError);
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

test("code without the link: cases found by e-mail, signed choice of form", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-0007", payloadHash: "h" });
  const hash = emailHash("  Jean@Example.CH ");
  assert.deepEqual(await f.access.casesByEmail(hash), [created.summary.caseId]);
  assert.deepEqual(await f.access.casesByEmail(emailHash("other@example.ch")), []);
  const { code, challenge } = createChallenge({ caseId: "", revision: 0, emailHash: hash, byEmail: true });
  const checked = verifyChallenge(challenge, code);
  assert.equal(checked.ok && checked.payload.byEmail, true);
  const pick = createPick(hash, ["K1", "K2"]);
  assert.deepEqual(readPick(pick), { emailHash: hash, caseIds: ["K1", "K2"] });
  // Ark changes the contact: the new address finds the case, the old one no longer does.
  const token = created.link.url.split("#acces=")[1];
  await assert.rejects(staffAction(created.summary.caseId, "link", { expectedRevision: 1, email: "not-an-email" }, { idempotencyKey: "link-0007a", payloadHash: "a" }), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  const moved = await staffAction(created.summary.caseId, "link", { expectedRevision: 1, email: "Claude@Example.ch" }, { idempotencyKey: "link-0007", payloadHash: "l" });
  assert.ok(moved.link);
  assert.equal(await readLink(token), null, "old link revoked");
  assert.equal((await readLink(moved.link!.url.split("#acces=")[1]))?.emailHash, emailHash("claude@example.ch"));
  assert.equal((await contactOf(created.summary.caseId)).emailHash, emailHash("claude@example.ch"));
  await assert.rejects(clientCase({ caseId: created.summary.caseId, revision: 1, emailHash: hash }), (e: unknown) => e instanceof KycError && e.code === "session_expired", "old-address session ends");
  assert.ok(await clientCase({ caseId: created.summary.caseId, revision: 1, emailHash: emailHash("claude@example.ch") }));
  assert.notEqual((await contactOf(created.summary.caseId)).emailHash, hash);
  assert.equal(readPick(pick.replace(/^./, (c) => (c === "e" ? "f" : "e"))), null, "tampered");
  assert.equal(readPick(pick, Date.now() + 11 * 60 * 1000), null, "expired");
});

// ---- Ark assistance (assist access, role "staff", provenance, prefill overwrite) --------------------

test("assist: single-use link or code opens a staff session that fills and submits but never signs", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-assist-1", payloadHash: "a1" });
  const caseId = created.summary.caseId;
  await assert.rejects(staffAction(caseId, "assist", {}, { idempotencyKey: "assist-no-by", payloadHash: "n" }), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  await assert.rejects(staffAction(caseId, "assist", { by: "Sam", ttlMinutes: 0 }, { idempotencyKey: "assist-ttl", payloadHash: "t" }), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  const issued = await staffAction(caseId, "assist", { by: "Sam", ttlMinutes: 15 }, { idempotencyKey: "assist-0001", payloadHash: "as1" });
  const assist = issued.assist!;
  assert.match(assist.link, /#assist=[A-Za-z0-9_-]{43}$/);
  assert.match(assist.code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.ok(Math.abs(Date.parse(assist.expiresAt) - Date.now() - 15 * 60_000) < 5_000);
  assert.equal((await readLink(assist.link.split("#assist=")[1])), null, "an assist token is not a client link");

  // Single use across both ways in; the code is read loosely.
  assert.equal(await redeemAssist({ code: "wrong-code" }), null);
  const used = await redeemAssist({ code: assist.code.toLowerCase().replace("-", " ") });
  assert.equal(used?.by, "Sam");
  assert.equal(await redeemAssist({ code: assist.code }), null, "the code is single use");
  assert.equal(await redeemAssist({ token: assist.link.split("#assist=")[1] }), null, "the link is spent with the code");
  const second = (await staffAction(caseId, "assist", { by: "Anne" }, { idempotencyKey: "assist-0002", payloadHash: "as2" })).assist!;
  assert.equal((await redeemAssist({ token: second.link.split("#assist=")[1] }))?.by, "Anne");
  assert.equal(await redeemAssist({ code: second.code }), null, "the code is spent with the link");

  const staff = { caseId, revision: 1, emailHash: STAFF_HASH, staffBy: "Sam" };
  const raw = await createSession(staff);
  assert.equal((await readSession(raw))?.staffBy, "Sam");
  assert.equal((await readSession(await createSession({ caseId, revision: 1, emailHash: JEAN })))?.staffBy, undefined);

  // Provenance: Ark's answers are marked, the client's later edits unmark them, the form never sees marks.
  const contact = { caseId, revision: 1, emailHash: JEAN };
  await saveDraft(contact, { answers: { "a.name": "Client name", "d.sector": "Conseil" }, stepId: "a" });
  assert.equal((await staffCase(caseId)).enteredBy, undefined);
  await saveDraft(staff, { answers: { "a.name": "Client name", "d.sector": "Fiduciaire", "d.purpose": "Conseil" }, stepId: "d" });
  assert.deepEqual((await staffCase(caseId)).enteredBy, { "d.sector": "Sam", "d.purpose": "Sam" });
  const seen = await clientCase(contact);
  assert.ok(!JSON.stringify(seen).includes("enteredBy"), "provenance is not shown to the client");
  assert.ok(!JSON.stringify(await clientCase(staff)).includes("enteredBy"));
  await saveDraft(contact, { answers: { ...seen.draft!.answers, "d.purpose": "Autre" }, stepId: "d" });
  assert.deepEqual((await staffCase(caseId)).enteredBy, { "d.sector": "Sam" });

  // Documents: staff may upload, not the signed scan.
  assert.ok((await createUpload(staff, { kind: "doc", docKey: "pm.rc", fileName: "rc.pdf", size: 1000, mime: "application/pdf" })).uploadUrl);
  for (const file of (await clientCase(staff)).files) assert.deepEqual(await deleteUpload(staff, { fileId: file.id }), { ok: true });
  await assert.rejects(createUpload(staff, { kind: "signed", fileName: "s.pdf", size: 1000, mime: "application/pdf" }), (e: unknown) => e instanceof KycError && e.code === "not_allowed");

  // Submit as staff: the stored JSON records provenance and who submitted; the PDF carries internal metadata.
  await saveDraft(staff, { answers: pmOp, stepId: "i" });
  await uploadAll(f, caseId, pmOp);
  const sent = await submit(staff, { answers: pmOp, submitKey: "ks" });
  assert.equal(sent.state, "awaiting_signature");
  const record = await loadCase(caseId);
  const rev = record.revisions[0];
  const stored = JSON.parse(new TextDecoder().decode((await f.storage.readFile(record.driveId, rev.folderId, "questionnaire.json"))!));
  assert.equal(stored.submittedBy, "Sam");
  assert.equal(stored.enteredBy["d.sector"], "Sam");
  assert.equal(stored.enteredBy["d.purpose"], "Sam", "changed back by Ark after the client edited it");
  assert.ok(Object.keys(stored.enteredBy).length > 5, "everything staff changed in this session is marked");
  assert.ok(Object.values(stored.enteredBy).every((by) => by === "Sam"));
  const pdf = new TextDecoder("latin1").decode((await f.storage.readFile(record.driveId, rev.folderId, rev.pdf!.name))!);
  assert.ok(pdf.length > 1000);
  assert.deepEqual((await staffCase(caseId)).enteredBy, stored.enteredBy);

  // Staff never signs, online or by scan, and cannot confirm a scan; it can read the PDF.
  await assert.rejects(signOnline(staff, { name: "Jean Dupont", accept: true, declarationId: sent.declarationId, drawing: await drawing() }), (e: unknown) => e instanceof KycError && e.code === "not_allowed");
  await assert.rejects(confirmSigned(staff), (e: unknown) => e instanceof KycError && e.code === "not_allowed");
  await assert.rejects(saveDraft(staff, { answers: pmOp }), (e: unknown) => e instanceof KycError && e.code === "not_editable");
  assert.ok((await readPdf(staff)).bytes.byteLength > 1000);
  assert.equal((await clientCase(staff)).signing?.role, "staff");
  // A staff session of a case that moved on ends.
  await assert.rejects(clientCase({ ...staff, caseId: "unknown" }), (e: unknown) => e instanceof KycError);
});

test("assist is refused when the revision is not open, and a new link revokes assist access", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-assist-2", payloadHash: "b1" });
  const caseId = created.summary.caseId;
  const open = (await staffAction(caseId, "assist", { expectedRevision: 1, by: "Sam" }, { idempotencyKey: "assist-open", payloadHash: "o" })).assist!;
  await assert.rejects(staffAction(caseId, "assist", { expectedRevision: 2, by: "Sam" }, { idempotencyKey: "assist-stale", payloadHash: "s" }), (e: unknown) => e instanceof KycError && e.code === "revision_conflict");
  // A replayed request issues a fresh single-use access, not the old secrets.
  const replay = await staffAction(caseId, "assist", { expectedRevision: 1, by: "Sam" }, { idempotencyKey: "assist-open", payloadHash: "o" });
  assert.equal(replay.replayed, true);
  assert.notEqual(replay.assist?.code, open.code);
  await staffAction(caseId, "link", { expectedRevision: 1 }, { idempotencyKey: "assist-relink", payloadHash: "rl" });
  assert.equal(await redeemAssist({ code: open.code }), null, "a new link revokes outstanding assist access");

  const session = { caseId, revision: 1, emailHash: JEAN };
  await saveDraft(session, { answers: pmOp });
  await uploadAll(f, caseId, pmOp);
  await submit(session, { answers: pmOp });
  await assert.rejects(staffAction(caseId, "assist", { by: "Sam" }, { idempotencyKey: "assist-submitted", payloadHash: "x" }), (e: unknown) => e instanceof KycError && e.code === "invalid_state");
  await staffAction(caseId, "close", { expectedRevision: 1 }, { idempotencyKey: "assist-close", payloadHash: "cl" });
  await assert.rejects(staffAction(caseId, "assist", { by: "Sam" }, { idempotencyKey: "assist-closed", payloadHash: "y" }), (e: unknown) => e instanceof KycError && (e.code === "case_closed" || e.code === "invalid_state"));
});

test("prefill overwrite replaces client answers while open, marks them as Ark's and bumps the version", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-overwrite", payloadHash: "w1" });
  const caseId = created.summary.caseId;
  const session = { caseId, revision: 1, emailHash: JEAN };
  await saveDraft(session, { answers: { "a.name": "Client's spelling", "d.sector": "Conseil" }, staffPrefillVersion: 0 });
  await assert.rejects(staffAction(caseId, "prefill", { expectedRevision: 1, prefill: { "a.name": "X" }, overwrite: "yes" }, { idempotencyKey: "ow-bad", payloadHash: "bad" }), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  // Without the flag nothing typed by the client is touched (unchanged behaviour).
  await staffAction(caseId, "prefill", { expectedRevision: 1, prefill: { "a.name": "Ark spelling" } }, { idempotencyKey: "ow-plain", payloadHash: "plain" });
  assert.equal((await staffCase(caseId)).draft?.["a.name"], "Client's spelling");
  assert.equal((await staffCase(caseId)).enteredBy, undefined);
  const before = (await clientCase(session)).draft?.staffPrefillVersion || 0;
  await staffAction(caseId, "prefill", { expectedRevision: 1, overwrite: true, by: "Sam", prefill: { "a.name": "Ark spelling", "d.sector": "Conseil", "d.purpose": "Nouveau" } }, { idempotencyKey: "ow-yes", payloadHash: "yes" });
  const staff = await staffCase(caseId);
  assert.equal(staff.draft?.["a.name"], "Ark spelling");
  assert.equal(staff.draft?.["d.purpose"], "Nouveau");
  assert.deepEqual(staff.enteredBy, { "a.name": "Sam" }, "only values that replaced a client answer are marked; empty ones are plain prefill");
  const view = await clientCase(session);
  assert.equal((view.draft?.staffPrefillVersion || 0), before + 1);
  assert.ok(view.prefilledIds.includes("a.name"), "the client sees it as to check");
  assert.ok(!JSON.stringify(view).includes("enteredBy"));
  await assert.rejects(saveDraft(session, { answers: { "a.name": "Client's spelling" }, staffPrefillVersion: before }), (e: unknown) => e instanceof KycError && e.code === "draft_changed");
  // The client edits the overwritten answer: it is theirs again.
  await saveDraft(session, { answers: { ...view.draft!.answers, "a.name": "Back to client" }, staffPrefillVersion: before + 1 });
  assert.equal((await staffCase(caseId)).enteredBy, undefined);
  // Overwrite is for open revisions only.
  await saveDraft(session, { answers: pmOp, staffPrefillVersion: before + 1 });
  await uploadAll(f, caseId, pmOp);
  await submit(session, { answers: pmOp });
  await assert.rejects(staffAction(caseId, "prefill", { expectedRevision: 1, overwrite: true, prefill: { "a.name": "Late" } }, { idempotencyKey: "ow-late", payloadHash: "late" }), (e: unknown) => e instanceof KycError && e.code === "invalid_state");
});
