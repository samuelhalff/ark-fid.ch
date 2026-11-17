import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

process.env.KYC_QF_TOKEN_SECRET = "test-secret-test-secret-test-secret-0123";
process.env.KYC_QF_STORAGE = "mock";
process.env.KYC_QF_API_KEYS = "cadence:cadence-secret-cadence-secret-cadence-01";

import { docCode, documentList, documentsFor, declaredFor, holdsFile, retiredDocument, samePerson, swissCompany } from "./documents";
import { fieldText, getField, getGroup, isBlockAsked, isBlockVisible, isRetiredId, pruneHidden, sanitizeAnswers, validateAll, validateField, visibleSteps } from "./engine";
import { upgradeAnswers } from "./upgrade";
import { flagsOf, routeMismatch } from "./flags";
import { createChallenge, createPick, createSession, emailHash, linkRef, linkRefusal, linkStatus, readLink, readPick, readSession, STAFF_HASH, redeemAssist, verifyChallenge } from "./server/access";
import { apiKeys } from "./server/config";
import { signRequest, verifyStaffRequest } from "./server/signature";
import { memoryAccess, memoryTracker } from "./server/ports";
import { accessFor, askField, changes, clientCase, confirmSigned, contactOf, createCase, createUpload, deleteUpload, formPdfName, KycError, readPdf, signOnline, loadCase, saveDraft, staffAction, staffCase, submit } from "./server/service";
import { KycMockStorage, getPorts, setPorts } from "./server/sharepoint";
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
  "a.directors": [row("dir0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur", signing: "individual", nationality: "Suisse", country: "Suisse" })],
  "b.transparency": "notYet",
  "c.pep": "none",
  "c.sanctions": "no",
  "c.criminal": "no",
  "d.servicesPm": ["domiciliation", "accounting"],
  "d.purpose": "Conseil",
  "d.activity": "Conseil en gestion",
  "d.countries": "Suisse",
  "d.counterparties": "Clients en Suisse",
  "d.licence": "no",
  "e.companyAssetSources": ["capital", "other"],
  "e.companyAssets": "Capital libéré",
  "f.funds": "no",
  "g.turnover": "100'000",
  "g.typesPm": ["domestic"],
  "i.signers": [row("sgn0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur" })],
  "i.place": "Genève",
  "i.accept": "yes",
};

const pmOp: Answers = {
  ...pmCommon,
  route: "pm-op",
  "a.activityKind": "operates",
  "b.persons": [row("per0001", person)],
  "b.holders": [row("hld0001", { kind: "person", person: "per0001", percent: "100" })],
  "b.qOther": "no",
  "b.forThird": "no",
  "e.ownersWealth": "Salaire",
};

const pmNonOp: Answers = {
  ...pmCommon,
  route: "pm-nonop",
  "a.activityKind": "assets",
  "g.amount": "100'000",
  "b.persons": [row("per0001", { ...person, wealth: "Héritage" })],
  "b.holders": [row("hld0001", { kind: "person", person: "per0001", percent: "100" })],
};

const pp: Answers = {
  route: "pp",
  "start.privacy": "yes",
  "a.lastName": "Martin",
  "a.firstName": "Anne",
  "a.birthDate": "03.04.1980",
  "a.nationality": "France",
  "a.taxCountry": "Suisse",
  "a.address": "Rue de Lausanne 2, 1201 Genève",
  "a.country": "Suisse",
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
  "g.amount": "10'000",
  "g.typesPp": ["domestic"],
  "i.place": "Genève",
  "i.accept": "yes",
};

// ---- schema ------------------------------------------------------------------------------------

test("each route shows its own screens and its section B", () => {
  const ids = (a: Answers) => visibleSteps(a).map((s) => s.id);
  assert.deepEqual(ids(pp).filter((id) => id.startsWith("a.") || id.startsWith("b.")), ["a.pp", "b.pp"]);
  assert.deepEqual(ids(pmOp).filter((id) => id.startsWith("a.") || id.startsWith("b.")), ["a.pm", "b.pm"]);
  assert.equal(pruneHidden(pmNonOp)["b.qOther"], undefined, "no other-control question on the non-operating form");
  const withWealth = pruneHidden({ ...pmOp, "b.persons": [row("per0001", { ...person, wealth: "x" })] })["b.persons"] as { wealth?: string }[];
  assert.equal(withWealth[0].wealth, undefined, "wealth asked of the persons of a non-operating company only");
});

test("complete answers are valid for each route", () => {
  for (const a of [pp, pmOp, pmNonOp]) assert.deepEqual(validateAll(pruneHidden(a)), {}, String(a.route));
});

test("operating cascade: 25 % computed → other control → most senior managers", () => {
  const { "b.qOther": _q, ...noAnswer } = pmOp;
  assert.equal(validateAll(pruneHidden(noAnswer))["b.qOther"], "required", "other control asked once, even with a 25 % holder");
  // Four persons at 20 %: nobody reaches 25 %, nobody controls otherwise → the managers.
  const persons = ["a", "b", "c", "d", "e"].map((x) => row(`per000${x}`, { ...person, lastName: `P${x}` }));
  const small = { ...pmOp, "b.persons": persons, "b.holders": persons.map((p, i) => row(`hld000${i}`, { kind: "person", person: p._id, percent: "20" })) };
  assert.equal(validateAll(pruneHidden(small))["b.managers"], "required");
  const other = pruneHidden({ ...small, "b.qOther": "yes" });
  assert.equal(validateAll(other)["b.controlPersons"], "required");
  assert.equal(validateAll(other)["b.managers"], undefined, "someone controls otherwise: no managers");
  assert.deepEqual(validateAll(pruneHidden({ ...small, "b.qOther": "yes", "b.controlPersons": ["per000a"] })), {});
  // « Je ne sais pas qui est derrière » with nobody found: the managers, picked among the directors.
  const unknown = pruneHidden({ ...pmOp, "b.holders": [], "b.holdersUnknown": "yes" });
  assert.equal(validateAll(unknown)["b.holders"], undefined, "an empty list is fine once unknown is said");
  assert.equal(validateAll(unknown)["b.managers"], "required", "art. 2a al. 3: not identifiable → senior managers");
  const managed = pruneHidden({ ...unknown, "b.persons": [row("dir0001p", person)], "b.managers": ["dir0001p"] });
  assert.deepEqual(validateAll(managed), {});
  assert.equal((managed["b.persons"] as unknown[]).length, 1, "a manager's person is kept");
});

test("currency \"Autre\" asks which currency, and only then", () => {
  const funds = { ...pp, "f.funds": "yes", "f.origin": "Vente d'un appartement", "f.amount": "1000.00", "f.currency": "CHF", "f.bank": "UBS, Suisse, Test" };
  assert.equal(validateAll(pruneHidden(funds))["f.currencyOther"], undefined);
  const other = pruneHidden({ ...funds, "f.currency": "other" });
  assert.equal(validateAll(other)["f.currencyOther"], "required");
  assert.equal(validateAll(pruneHidden({ ...other, "f.currencyOther": "JPY" }))["f.currencyOther"], undefined);
  assert.equal(pruneHidden({ ...funds, "f.currencyOther": "JPY" })["f.currencyOther"], undefined, "hidden answer dropped");
});

test("listed company: no cascade, no share register; the listing is public, no proof asked", () => {
  const listed = pruneHidden({ ...pmOp, "a.listed": "yes", "a.listedWhere": "Holding AG, SIX" });
  assert.equal(listed["b.holders"], undefined);
  assert.deepEqual(validateAll(listed), {});
  assert.ok(!documentsFor(listed).some((d) => d.key === "pm.listed" || d.key === "pm.shareholders"));
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
  const other = { ...pmNonOp, "i.signers": [row("sgn0001", { lastName: "Martin", firstName: "Paul", function: "Administrateur" })] };
  const keys = documentsFor(pruneHidden(other)).map((d) => d.key);
  assert.ok(keys.includes("pm.signer:sgn0001"));
  assert.ok(keys.includes("pm.person:per0001"), "two different people: two IDs");
  assert.ok(documentsFor(pp).some((d) => d.key === "pp.id"));
});

test("documents: one ID per person — a signer also named in section B gives the certified copy once (Sam 2026-11-15)", () => {
  const docs = documentsFor(pruneHidden(pmNonOp));
  const ids = docs.filter((d) => d.key.startsWith("pm.signer:") || d.key.startsWith("pm.person:"));
  assert.deepEqual(ids.map((d) => d.key), ["pm.signer:sgn0001"], "Jean Dupont signs and holds: one item");
  const kept = ids[0];
  assert.deepEqual(kept.also, ["pm.person:per0001"]);
  assert.match(kept.hint!.fr, /^Pour : Administrateur, personne citée au point B\. Copie certifiée/);
  // A file uploaded under the plain ID before the fold stays attached to the kept item.
  assert.ok(holdsFile(kept, docCode("pm.person:per0001")) && holdsFile(kept, docCode("pm.signer:sgn0001")));
  assert.ok(!holdsFile(kept, docCode("pm.person:other")));
  // Same name, different birth dates: two people, two IDs.
  assert.equal(samePerson({ lastName: "DUPONT", firstName: " jean " }, { lastName: "Dupont", firstName: "Jean", birthDate: "01.02.1970" }), true);
  assert.equal(samePerson({ lastName: "Dupont", firstName: "Jean", birthDate: "03.04.1999" }, { lastName: "Dupont", firstName: "Jean", birthDate: "01.02.1970" }), false);
  assert.equal(samePerson({ lastName: "", firstName: "" }, { lastName: "", firstName: "" }), false);
  // Ark took the signer's ID off the list: the section B person's own ID is asked again.
  assert.ok(documentsFor(pruneHidden(pmNonOp), ["pm.signer:sgn0001"]).some((d) => d.key === "pm.person:per0001"));
  // A « plus tard » given under the folded key still counts for the kept item.
  assert.equal(declaredFor(kept, { "pm.person:per0001": "later" }), "later");
});

test("documents: a Swiss company's extract and articles are not on its list at all (Sam, 2026-11-13)", () => {
  const swiss = pruneHidden(pmNonOp);
  assert.equal(swissCompany(swiss), true);
  const listed = documentList(swiss).map((d) => d.key);
  assert.ok(!listed.includes("pm.rc") && !listed.includes("pm.statutes"));
  // A foreign company is asked for both, as before.
  const foreign = pruneHidden({ ...pmNonOp, "a.uid": "HRB 12345", "a.incorporationCountry": "Allemagne" });
  assert.equal(swissCompany(foreign), false);
  assert.ok(documentsFor(foreign).some((d) => d.key === "pm.rc") && documentsFor(foreign).some((d) => d.key === "pm.statutes"));
  // A person never is a company.
  assert.equal(swissCompany({ ...pp, "a.uid": "CHE-123.456.789" }), false);
});

test("documents: a key Ark took off the list is not asked and says so; an unknown key changes nothing", () => {
  const answers = pruneHidden(pmNonOp);
  const asked = documentsFor(answers, ["pm.signer:sgn0001", "nothing.here"]).map((d) => d.key);
  assert.ok(!asked.includes("pm.signer:sgn0001"));
  // The signer was also the section B person: their plain ID comes back in place of the certified copy.
  assert.ok(asked.includes("pm.person:per0001"));
  assert.equal(asked.length, documentsFor(answers).length);
  assert.equal(documentList(answers, ["pm.signer:sgn0001"]).find((d) => d.key === "pm.signer:sgn0001")?.withheld, "removed");
});

// ---- earlier answers (form simplified on 2026-11-13) ---------------------------------------------

const oldPmOp: Answers = {
  ...pmOp,
  "a.directors": [
    row("dir0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur", nationality: "Suisse", country: "Suisse" }),
    row("dir0002", { lastName: "Muller", firstName: "Eva", function: "Membre", nationality: "Suisse", country: "Suisse" }),
  ],
  "a.signatories": [row("sig0001", { lastName: "dupont", firstName: "Jean", signing: "individual" }), row("sig0002", { lastName: "Roth", firstName: "Max", function: "Fondé de procuration", signing: "joint" })],
  "b.shareholders": [row("sha0001", { name: "Jean Dupont", kind: "person", percent: "100" })],
  "a.staffCount": "3",
  "d.sector": "Fiduciaire",
  "d.turnover": "90'000",
  "g.countries": "France, EUR",
  "e.companyAssetSources": undefined,
  "e.companyAssets": "Capital libéré",
  "f.funds": "yes",
  "f.origin": "Épargne",
  "f.amount": "1000",
  "f.currency": "CHF",
  "f.bank": "UBS",
  "f.holder": "Test SA",
  "f.more": "Non",
};

test("earlier answers: a draft's merged questions take them, nothing typed is lost, twice is once", () => {
  const up = upgradeAnswers({ ...oldPmOp }, { infer: true });
  const people = up["a.directors"] as Record<string, string>[];
  assert.deepEqual(people.map((p) => [p.lastName, p.signing, p.function]), [["Dupont", "individual", "Administrateur"], ["Muller", "none", "Membre"], ["Roth", "joint", "Fondé de procuration"]]);
  assert.equal(up["d.activity"], "Conseil en gestion (Fiduciaire)");
  assert.equal(up["d.countries"], "Suisse ; France, EUR");
  assert.equal(up["f.bank"], "UBS, Test SA");
  assert.deepEqual(up["e.companyAssetSources"], ["other"]);
  for (const gone of ["a.signatories", "d.sector", "g.countries", "f.holder"]) assert.equal(up[gone], undefined, gone);
  for (const kept of ["a.staffCount", "d.turnover", "f.more", "b.shareholders"]) assert.ok(up[kept] !== undefined, `${kept} kept for Ark`);
  assert.deepEqual(upgradeAnswers(up, { infer: true }), up, "idempotent");
  // Only what the earlier form never asked is missing: the new signatory's nationality and country.
  assert.deepEqual(Object.keys(validateAll(pruneHidden(up))).sort(), [`a.directors[${people[2]._id}].country`, `a.directors[${people[2]._id}].nationality`]);
  // A retired question shows to readers when answered, is never asked, never required.
  const staffCount = getField("a.staffCount")!;
  assert.equal(isBlockAsked(staffCount, up), false);
  assert.equal(isBlockVisible(staffCount, up), true);
  assert.equal(isBlockVisible(staffCount, { route: "pm-op" }), false);
  assert.equal(isBlockVisible(getGroup("b.shareholders")!, pruneHidden(up)), true);
  assert.ok(retiredDocument("pm.listed")?.label.fr.startsWith("Preuve de la cotation"));
  // Names written differently still match (hyphen, accents, case).
  const hyphen = upgradeAnswers({ "a.directors": [row("dir0001", { lastName: "Muller", firstName: "Jean-Pierre" })], "a.signatories": [row("sig0001", { lastName: "MÜLLER", firstName: "Jean Pierre", signing: "joint" })] });
  assert.equal((hyphen["a.directors"] as Record<string, string>[]).length, 1);
});

test("earlier answers sent by a browser: merged, nothing inferred, nothing retired taken in", () => {
  const clean = sanitizeAnswers(oldPmOp);
  const people = clean["a.directors"] as Record<string, string>[];
  assert.equal(people.find((p) => p.lastName === "Muller")?.signing, undefined, "no signature made up");
  assert.equal(clean["e.companyAssetSources"], undefined);
  for (const retiredId of ["a.staffCount", "d.turnover", "f.more", "b.shareholders"]) assert.equal(clean[retiredId], undefined, `${retiredId} never reaches a new submission`);
  assert.equal(clean["d.activity"], "Conseil en gestion (Fiduciaire)");
});

test("route wording: the non-operating company is asked what it holds; the person where it works and holds assets", () => {
  assert.equal(fieldText(getField("d.activity")!, pmNonOp).label.fr, "Que détient la société ?");
  assert.match(fieldText(getField("d.activity")!, pmOp).label.fr, /^Décrivez/);
  assert.match(fieldText(getField("d.countries")!, pp).label.fr, /avez-vous des biens/);
  // Operating-only questions are not asked of a non-operating company.
  const nonop = pruneHidden({ ...pmNonOp, "a.ownPremises": "no", "g.turnover": "1" });
  assert.equal(nonop["a.ownPremises"], undefined);
  assert.equal(nonop["g.turnover"], undefined);
  // A person's companies and licence only when a service concerns a company.
  assert.equal(pruneHidden({ ...pp, "d.servicesPp": ["tax"], "d.licence": "no" })["d.licence"], undefined);
  assert.equal(pruneHidden(pp)["d.licence"], "no");
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
  assert.ok(summary.documentItems.some((item) => item.files.some((file) => (file.size ?? 0) > 0 && !Number.isNaN(Date.parse(file.receivedAt || "")))), "each received file carries its size and receipt date");

  // Correction: a new revision; the signed one is untouched and its sessions stop working.
  await assert.rejects(staffAction(caseId, "reopen", { expectedRevision: 2 }, { idempotencyKey: "reopen-0001", payloadHash: "r" }), (e: unknown) => e instanceof KycError && e.code === "revision_conflict");
  const reopened = await staffAction(caseId, "reopen", { expectedRevision: 1, prefill: { "d.counterparties": "Fiduciaire" } }, { idempotencyKey: "reopen-0001", payloadHash: "r" });
  assert.equal(reopened.summary.latestRevision.n, 2);
  assert.ok(reopened.link);
  assert.deepEqual(reopened.summary.revisions.map((r) => r.state), ["superseded", "open"]);
  await assert.rejects(clientCase(session), (e: unknown) => e instanceof KycError && e.code === "revision_superseded");
  const v2 = await clientCase({ caseId, revision: 2, emailHash: JEAN });
  assert.equal(v2.answers["d.counterparties"], "Fiduciaire");
  assert.equal(v2.answers["a.name"], "Test SA", "previous answers carried over");
  assert.ok((await f.storage.readFile(record.driveId, rev.folderId, rev.pdf!.name))!.byteLength > 1000, "revision 1 files kept");
  const replay = await staffAction(caseId, "reopen", { expectedRevision: 1, prefill: { "d.counterparties": "Fiduciaire" } }, { idempotencyKey: "reopen-0001", payloadHash: "r" });
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
  await staffAction(caseId, "prefill", { expectedRevision: 1, prefill: { "a.name": "Ark spelling", "d.counterparties": "Fiduciaire" } }, { idempotencyKey: "prefill-race-01", payloadHash: "prefill-race" });
  const staff = await staffCase(caseId);
  assert.equal(staff.draft?.["a.name"], "Client's spelling");
  assert.equal(staff.draft?.["a.lastName"], undefined, "a question hidden on this route is not sent to staff");
  assert.equal(staff.draft?.["d.counterparties"], "Fiduciaire");
  assert.ok(staff.pages.some((page) => page.fieldIds.includes("a.name")));
  assert.ok(staff.pages.some((page) => page.missingFieldIds.includes("a.uid")), "staff sees the form's own incomplete fields");
  assert.ok(staff.pages.some((page) => page.parts.some((part) => part.kind === "field")), "page copy keeps client order");
  assert.ok(staff.pages.find((page) => page.id === "i")?.parts.some((part) => part.id === "i.declarations" && part.text?.fr !== "{declarations}"), "staff sees the actual client declarations");
  assert.ok(staff.pages.some((page) => page.id === "h"), "Ark sees the same pages as the client");
  assert.ok(staff.documentItems.some((item) => item.key === "pm.shareholders"), "Ark sees the document page's items");
  assert.equal(opened.draft?.staffPrefillVersion || 0, 0);
  await assert.rejects(saveDraft(session, { answers: { "a.name": "Client's spelling" }, staffPrefillVersion: 0 }), (e: unknown) => e instanceof KycError && e.code === "draft_changed");
  const current = await clientCase(session);
  await saveDraft(session, { answers: current.draft?.answers, staffPrefillVersion: current.draft?.staffPrefillVersion });
  assert.equal((await staffCase(caseId)).draft?.["d.counterparties"], "Fiduciaire");
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
  assert.equal((await signOnline({ ...session, linkRef: "abcd1234abcd1234" }, { name: "  dupont JEAN ", accept: true, declarationId, drawing: await drawing() }, { ip: "203.0.113.7", userAgent: "Mozilla/5.0 (Test)\u0000\n é" })).state, "signed");
  const record = await loadCase(caseId);
  const rev = record.revisions[0];
  const trace = rev.signers?.[0].signature;
  assert.deepEqual([trace?.ip, trace?.userAgent, trace?.linkRef], ["203.0.113.7", "Mozilla/5.0 (Test)", "abcd1234abcd1234"], "signature trace kept with the case, control and non-ASCII characters dropped");
  assert.ok(trace?.at && trace.email === "jean@example.ch");
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
  assert.equal(rev.signed![0].sha256, createHash("sha256").update(signedPdf!).digest("hex"), "the stored hash is that of the stored signed PDF");
  // Content streams are deflated: inflate them all, then look at what the page draws.
  const { inflateSync } = await import("node:zlib");
  const pdfText = signedDocument.context.enumerateIndirectObjects().map(([, object]) => {
    if (!(object instanceof PDFRawStream) || object.dict.get(PDFName.of("Subtype"))) return "";
    try { return Buffer.from(inflateSync(object.contents)).toString("latin1"); } catch { return ""; }
  }).join("\n");
  for (const shown of ["203.0.113.7", "abcd1234abcd1234", "Mozilla/5.0 (Test)", trace!.pdfSha256.slice(0, 24)]) assert.ok(pdfText.includes(shown) || pdfText.toLowerCase().includes(Buffer.from(shown, "latin1").toString("hex")), `signature page shows ${shown}`);
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
  const jeanRow = paulView.signing?.signers.find((s) => s.name.includes("Jean"));
  assert.ok(jeanRow?.inForm && !jeanRow.invitedAt, "Paul sees the contact signing in the form, not a link never sent");
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

test("Ark sets the signatories after submission: adds, replaces, never touches who signed", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-0015", payloadHash: "h" });
  const caseId = created.summary.caseId;
  const contact = { caseId, revision: 1, emailHash: JEAN };
  const jean = { id: "sgn0001", firstName: "Jean", lastName: "Dupont", function: "Administrateur", email: "jean@example.ch" };
  const answers: Answers = { ...pmOp, "i.signers": [row("sgn0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur" })] };
  await uploadAll(f, caseId, answers);
  await assert.rejects(staffAction(caseId, "signatories", { expectedRevision: 1, by: "Sam", signatories: [jean] }, { idempotencyKey: "sty-open", payloadHash: "o" }), (e: unknown) => e instanceof KycError && e.code === "invalid_state", "before submission the open form's answer is changed instead");
  await submit(contact, { answers });
  assert.equal(f.mails.length, 0, "the sole signatory signs at the contact address");
  const set = (key: string, signatories: unknown[], by = "Sam") => staffAction(caseId, "signatories", { expectedRevision: 1, by, signatories }, { idempotencyKey: key, payloadHash: key });
  const paul = { firstName: "Paul", lastName: "Martin", function: "Directeur", email: "paul@example.ch" };
  await assert.rejects(set("sty-by", [jean, paul], ""), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  await assert.rejects(set("sty-three", [jean, paul, { ...paul, email: "x@example.ch" }]), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  await assert.rejects(set("sty-dup", [jean, { ...paul, email: "JEAN@example.ch" }]), (e: unknown) => e instanceof KycError && e.code === "signer_email_duplicate");
  assert.equal((await loadCase(caseId)).revisions[0].signers?.length, 1, "a refused change leaves the list as it was");
  // A second signatory: Paul gets his own request; Jean stays the contact's signatory.
  const added = await set("sty-add", [jean, paul]);
  const signers = added.summary.latestRevision.signers!;
  assert.deepEqual(signers.map((s) => [s.name, s.function, s.email, s.setBy ?? null]), [["Jean Dupont", "Administrateur", "jean@example.ch", null], ["Paul Martin", "Directeur", "paul@example.ch", "Sam"]]);
  assert.match(signers[1].id, /^ark[0-9a-f]{12}$/);
  assert.deepEqual(f.mails.map((m) => (m as { to: string[] }).to[0]), ["paul@example.ch"]);
  assert.equal((await set("sty-add", [jean, paul])).replayed, true);
  assert.equal(f.mails.length, 1, "a replay sends nothing");
  const declarationId = (await clientCase(contact)).declarationId;
  assert.equal((await signOnline(contact, { name: "Jean Dupont", accept: true, declarationId, drawing: await drawing() })).state, "awaiting_signature", "Paul has not signed yet");
  // Who signed stays exactly as they signed.
  await assert.rejects(set("sty-drop-jean", [{ ...paul, id: signers[1].id }]), (e: unknown) => e instanceof KycError && e.code === "signer_signed");
  await assert.rejects(set("sty-move-jean", [{ ...jean, email: "jean2@example.ch" }, { ...paul, id: signers[1].id }]), (e: unknown) => e instanceof KycError && e.code === "signer_signed");
  // Paul is replaced by Marie: her request goes; Paul's session ends.
  const marie = { firstName: "Marie", lastName: "Rochat", function: "Administratrice", email: "marie@example.ch" };
  const replaced = await set("sty-marie", [jean, marie]);
  assert.deepEqual(replaced.summary.latestRevision.signers!.map((s) => s.name), ["Jean Dupont", "Marie Rochat"]);
  assert.deepEqual(f.mails.map((m) => (m as { to: string[] }).to[0]), ["paul@example.ch", "marie@example.ch"]);
  await assert.rejects(clientCase({ caseId, revision: 1, emailHash: emailHash("paul@example.ch") }), (e: unknown) => e instanceof KycError && e.code === "session_expired");
  const marieSession = { caseId, revision: 1, emailHash: emailHash("marie@example.ch") };
  assert.equal((await signOnline(marieSession, { name: "Marie Rochat", accept: true, declarationId, drawing: await drawing() })).state, "signed");
  // Signed: nobody can be changed any more.
  await assert.rejects(set("sty-late", [jean, marie]), (e: unknown) => e instanceof KycError && e.code === "invalid_state");
});

test("the list sent again after a lost answer changes nothing; taking off the one left unsigned signs the form", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-0017", payloadHash: "h" });
  const caseId = created.summary.caseId;
  const contact = { caseId, revision: 1, emailHash: JEAN };
  const jean = { id: "sgn0001", firstName: "Jean", lastName: "Dupont", function: "Administrateur", email: "jean@example.ch" };
  const answers: Answers = { ...pmOp, "i.signers": [row("sgn0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur" })] };
  await uploadAll(f, caseId, answers);
  await submit(contact, { answers });
  const paul = { firstName: "Paul", lastName: "Martin", function: "Directeur", email: "paul@example.ch" };
  const first = await staffAction(caseId, "signatories", { expectedRevision: 1, by: "Sam", signatories: [jean, paul] }, { idempotencyKey: "sty-retry-1", payloadHash: "1" });
  const again = await staffAction(caseId, "signatories", { expectedRevision: 1, by: "Sam", signatories: [jean, paul] }, { idempotencyKey: "sty-retry-2", payloadHash: "2" });
  assert.deepEqual(again.summary.latestRevision.signers!.map((s) => s.id), first.summary.latestRevision.signers!.map((s) => s.id));
  assert.equal(f.mails.length, 1, "Paul is not invited twice");
  assert.deepEqual([again.summary.latestRevision.signers![1].firstName, again.summary.latestRevision.signers![1].lastName], ["Paul", "Martin"]);
  const declarationId = (await clientCase(contact)).declarationId;
  await signOnline(contact, { name: "Jean Dupont", accept: true, declarationId, drawing: await drawing() });
  const done = await staffAction(caseId, "signatories", { expectedRevision: 1, by: "Sam", signatories: [jean] }, { idempotencyKey: "sty-drop-paul", payloadHash: "d" });
  assert.equal(done.summary.latestRevision.state, "signed");
  assert.equal(done.summary.latestRevision.signed?.length, 1, "the signed PDF is filed");
});

test("one signatory's link on demand: e-mailed, or handed to Ark to copy, never for the contact or who signed", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-0018", payloadHash: "h" });
  const caseId = created.summary.caseId;
  const contact = { caseId, revision: 1, emailHash: JEAN };
  const signer = (id: string, firstName: string, lastName: string, email: string) => row(id, { lastName, firstName, function: "Administrateur", email });
  const answers: Answers = { ...pmOp, "i.signers": [signer("sgn0001", "Paul", "Martin", "paul@example.ch"), signer("sgn0002", "Marie", "Rochat", "marie@example.ch")] };
  await uploadAll(f, caseId, answers);
  const act = (key: string, body: Record<string, unknown>) => staffAction(caseId, "remind_signers", { expectedRevision: 1, ...body }, { idempotencyKey: key, payloadHash: key });
  await assert.rejects(act("one-open", { signerIds: ["sgn0001"] }), (e: unknown) => e instanceof KycError && e.code === "invalid_state");
  await submit(contact, { answers });
  assert.equal(f.mails.length, 2);
  // « Envoyer le lien » on Paul's row: Paul only.
  const one = await act("one-paul", { signerIds: ["sgn0001"] });
  assert.deepEqual(one.reminded, ["sgn0001"]);
  assert.deepEqual((f.mails[2] as { to: string[] }).to, ["paul@example.ch"]);
  // « Copier le lien »: no e-mail; the link is Paul's (his address), and opens only with his code.
  const copied = await act("copy-paul", { signerIds: ["sgn0001"], notify: "none" });
  assert.equal(f.mails.length, 3, "copying sends nothing");
  const token = /#acces=([A-Za-z0-9_-]+)/.exec(copied.links![0].url)![1];
  assert.equal(copied.links![0].id, "sgn0001");
  assert.equal((await readLink(token))?.emailHash, emailHash("paul@example.ch"));
  await assert.rejects(act("copy-two", { signerIds: ["sgn0001", "sgn0002"], notify: "none" }), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  await assert.rejects(act("one-unknown", { signerIds: ["nobody01"] }), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  const declarationId = (await clientCase(contact)).declarationId;
  await signOnline({ caseId, revision: 1, emailHash: emailHash("paul@example.ch") }, { name: "Paul Martin", accept: true, declarationId, drawing: await drawing() });
  await assert.rejects(act("one-signed", { signerIds: ["sgn0001"] }), (e: unknown) => e instanceof KycError && e.code === "signer_signed");
  // The contact signs in the form with the case link: no signatory link for them.
  await staffAction(caseId, "signatories", { expectedRevision: 1, by: "Sam", signatories: [{ id: "sgn0001", firstName: "Paul", lastName: "Martin", function: "Administrateur", email: "paul@example.ch" }, { firstName: "Jean", lastName: "Dupont", function: "Directeur", email: "jean@example.ch" }] }, { idempotencyKey: "sty-contact", payloadHash: "c" });
  const jeanId = (await loadCase(caseId)).revisions[0].signers![1].id;
  await assert.rejects(act("one-contact", { signerIds: [jeanId] }), (e: unknown) => e instanceof KycError && e.code === "signer_is_contact");
});

test("a reminder re-sends each unsigned signatory their own request, once per call", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-0016", payloadHash: "h" });
  const caseId = created.summary.caseId;
  const contact = { caseId, revision: 1, emailHash: JEAN };
  const answers: Answers = { ...pmOp, "i.signers": [row("sgn0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur", email: "jean@example.ch" }), row("sgn0002", { lastName: "Martin", firstName: "Paul", function: "Administrateur", email: "paul@example.ch" })] };
  await uploadAll(f, caseId, answers);
  await assert.rejects(staffAction(caseId, "remind_signers", { expectedRevision: 1 }, { idempotencyKey: "rem-open", payloadHash: "o" }), (e: unknown) => e instanceof KycError && e.code === "invalid_state");
  await submit(contact, { answers });
  assert.equal(f.mails.length, 1);
  const first = await staffAction(caseId, "remind_signers", { expectedRevision: 1 }, { idempotencyKey: "rem-0001", payloadHash: "r1" });
  assert.deepEqual(first.reminded, ["sgn0002"], "the contact is reminded by Cadence, not here");
  const mail = f.mails[1] as { to: string[]; subject: string; html: string };
  assert.deepEqual(mail.to, ["paul@example.ch"]);
  assert.match(mail.subject, /^Rappel : /);
  const token = /#acces=([A-Za-z0-9_-]+)/.exec(mail.html)![1];
  assert.equal((await readLink(token))?.emailHash, emailHash("paul@example.ch"), "the reminder carries Paul's own link");
  const replay = await staffAction(caseId, "remind_signers", { expectedRevision: 1 }, { idempotencyKey: "rem-0001", payloadHash: "r1" });
  assert.deepEqual([replay.replayed, replay.reminded, f.mails.length], [true, [], 2], "a replay sends nothing");
  const declarationId = (await clientCase(contact)).declarationId;
  await signOnline({ caseId, revision: 1, emailHash: emailHash("paul@example.ch") }, { name: "Paul Martin", accept: true, declarationId, drawing: await drawing() });
  const after = await staffAction(caseId, "remind_signers", { expectedRevision: 1 }, { idempotencyKey: "rem-0002", payloadHash: "r2" });
  assert.deepEqual([after.reminded, f.mails.length], [[], 2], "who signed is not reminded");
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
  const viaLink = createChallenge({ caseId: link!.caseId, revision: 1, emailHash: "x", linkRef: linkRef(link!) });
  const verified = verifyChallenge(viaLink.challenge, viaLink.code);
  assert.ok(verified.ok && verified.payload.linkRef === linkRef(link!) && linkRef(link!).length === 16, "the challenge carries the link reference, not the token");
  assert.equal((await readSession(await createSession({ caseId: link!.caseId, revision: 1, emailHash: "x", linkRef: linkRef(link!) })))?.linkRef, linkRef(link!));
  assert.equal((await readSession(raw))?.linkRef, undefined, "a session opened by address carries no link");
  // A new link revokes the old one.
  await staffAction(created.summary.caseId, "link", { expectedRevision: 1 }, { idempotencyKey: "link-0001", payloadHash: "l" });
  assert.equal(await readLink(token), null);
});

test("an unusable link says why: replaced (by e-mail on a date, or otherwise), expired, or invalid", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-0050", payloadHash: "h" });
  const caseId = created.summary.caseId;
  const tokenOf = (url: string) => url.split("#acces=")[1];
  const refusal = async (token: string) => {
    const found = await linkStatus(token);
    assert.notEqual(found.status, "ok");
    return linkRefusal(found as Exclude<typeof found, { status: "ok" }>);
  };
  // Cadence e-mails the new link: the old one says so, with the date.
  const before = Date.now();
  const emailed = await staffAction(caseId, "link", { expectedRevision: 1, notify: "email" }, { idempotencyKey: "link-0050", payloadHash: "e" });
  const byEmail = await refusal(tokenOf(created.link.url));
  assert.equal(byEmail.error, "link_replaced");
  assert.equal(byEmail.via, "email");
  assert.ok(Date.parse(byEmail.at!) >= before && Date.parse(byEmail.at!) <= Date.now());
  assert.ok(f.access.records.filter((r) => r.kind === "link" && r.replacedAt).every((r) => r.revoked));
  // A link handed over otherwise (no notify): "other".
  const handed = await staffAction(caseId, "link", { expectedRevision: 1 }, { idempotencyKey: "link-0051", payloadHash: "o" });
  const other = await refusal(tokenOf(emailed.link!.url));
  assert.equal(other.error, "link_replaced");
  assert.equal(other.via, "other");
  // An idempotent replay of the e-mailed link replaces the current one the same way.
  const replay = await staffAction(caseId, "link", { expectedRevision: 1, notify: "email" }, { idempotencyKey: "link-0050", payloadHash: "e" });
  assert.equal(replay.replayed, true);
  assert.equal((await refusal(tokenOf(handed.link!.url))).via, "email");
  // A replaced link keeps its first reason when the case is closed later.
  assert.equal((await refusal(tokenOf(created.link.url))).via, "email");
  // Expired (TTL passed, never revoked).
  const current = f.access.records.find((r) => r.kind === "link" && !r.revoked)!;
  current.expiresAt = Date.now() - 1;
  assert.deepEqual(await refusal(tokenOf(replay.link!.url)), { error: "link_expired" });
  current.expiresAt = Date.now() + 60_000;
  assert.equal((await linkStatus(tokenOf(replay.link!.url))).status, "ok");
  // Closing revokes without a replacement: invalid, as are unknown or malformed tokens.
  await staffAction(caseId, "close", { expectedRevision: 1 }, { idempotencyKey: "close-0050", payloadHash: "c" });
  assert.deepEqual(await refusal(tokenOf(replay.link!.url)), { error: "link_invalid" });
  assert.equal((await refusal(tokenOf(created.link.url))).via, "email", "an earlier replacement is not overwritten");
  assert.deepEqual(await refusal("A".repeat(43)), { error: "link_invalid" });
  assert.deepEqual(await refusal("short"), { error: "link_invalid" });
  // Sessions revoked with the links carry no replacement.
  assert.ok(f.access.records.filter((r) => r.kind !== "link").every((r) => !r.replacedAt));
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
    const v = await verifyStaffRequest(r, apiKeys());
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
  assert.ok((await staffCase(caseId)).documentItems.some((item) => item.files.some((file) => file.webUrl && file.receivedAt && file.size)), "a carried document keeps its size and date");
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
  await saveDraft(contact, { answers: { "a.name": "Client name", "d.counterparties": "Conseil" }, stepId: "a" });
  assert.equal((await staffCase(caseId)).enteredBy, undefined);
  await saveDraft(staff, { answers: { "a.name": "Client name", "d.counterparties": "Fiduciaire", "d.purpose": "Conseil" }, stepId: "d" });
  assert.deepEqual((await staffCase(caseId)).enteredBy, { "d.counterparties": "Sam", "d.purpose": "Sam" });
  const seen = await clientCase(contact);
  assert.ok(!JSON.stringify(seen).includes("enteredBy"), "provenance is not shown to the client");
  assert.ok(!JSON.stringify(await clientCase(staff)).includes("enteredBy"));
  await saveDraft(contact, { answers: { ...seen.draft!.answers, "d.purpose": "Autre" }, stepId: "d" });
  assert.deepEqual((await staffCase(caseId)).enteredBy, { "d.counterparties": "Sam" });

  // Documents: staff may upload, not the signed scan.
  assert.ok((await createUpload(staff, { kind: "doc", docKey: "pm.shareholders", fileName: "rc.pdf", size: 1000, mime: "application/pdf" })).uploadUrl);
  for (const file of (await clientCase(staff)).files) assert.deepEqual(await deleteUpload(staff, { fileId: file.id }), { ok: true });
  await assert.rejects(createUpload(staff, { kind: "signed", fileName: "s.pdf", size: 1000, mime: "application/pdf" }), (e: unknown) => e instanceof KycError && e.code === "not_allowed");

  // Submit as staff: the stored JSON records provenance and who submitted; the PDF carries internal metadata.
  await saveDraft(staff, { answers: pmOp, stepId: "i" });
  await uploadAll(f, caseId, pmOp);
  const mailsBefore = f.mails.length;
  // The first request fails (mail down): a retry of the same submit sends it.
  const ports = getPorts();
  setPorts({ ...ports, sendMail: async () => { throw new Error("mail down"); } });
  assert.equal((await submit(staff, { answers: pmOp, submitKey: "ks" })).state, "awaiting_signature");
  setPorts(ports);
  assert.equal(f.mails.length, mailsBefore, "nothing went out");
  const sent = await submit(staff, { answers: pmOp, submitKey: "ks" });
  assert.equal(sent.state, "awaiting_signature");
  // Ark filled the form: the contact was never in this session, so their signing link goes to their address (Ricci, 2026-11-17).
  const toContact = (f.mails.slice(mailsBefore) as { to: string[]; html: string }[]).filter((m) => m.to.includes("jean@example.ch"));
  assert.equal(toContact.length, 1, "the contact gets a signing link");
  const contactLink = await readLink(/#acces=([A-Za-z0-9_-]+)/.exec(toContact[0].html)![1]);
  assert.equal(contactLink?.emailHash, JEAN, "bound to the contact's address");
  const staffView = await clientCase(staff);
  assert.ok(staffView.signing?.signers.length && staffView.signing.signers.every((s) => !!s.invitedAt && !s.inForm), "the list says when each link went out");
  await submit(staff, { answers: pmOp, submitKey: "ks" });
  assert.equal(f.mails.length, mailsBefore + toContact.length, "a submit retry sends nothing twice");
  assert.equal((await staffCase(caseId)).email, "jean@example.ch", "Cadence reads the contact's address");
  const record = await loadCase(caseId);
  const rev = record.revisions[0];
  const stored = JSON.parse(new TextDecoder().decode((await f.storage.readFile(record.driveId, rev.folderId, "questionnaire.json"))!));
  assert.equal(stored.submittedBy, "Sam");
  assert.equal(stored.enteredBy["d.counterparties"], "Sam");
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
  await saveDraft(session, { answers: { "a.name": "Client's spelling", "d.counterparties": "Conseil" }, staffPrefillVersion: 0 });
  await assert.rejects(staffAction(caseId, "prefill", { expectedRevision: 1, prefill: { "a.name": "X" }, overwrite: "yes" }, { idempotencyKey: "ow-bad", payloadHash: "bad" }), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  // Without the flag nothing typed by the client is touched (unchanged behaviour).
  await staffAction(caseId, "prefill", { expectedRevision: 1, prefill: { "a.name": "Ark spelling" } }, { idempotencyKey: "ow-plain", payloadHash: "plain" });
  assert.equal((await staffCase(caseId)).draft?.["a.name"], "Client's spelling");
  assert.equal((await staffCase(caseId)).enteredBy, undefined);
  const before = (await clientCase(session)).draft?.staffPrefillVersion || 0;
  await staffAction(caseId, "prefill", { expectedRevision: 1, overwrite: true, by: "Sam", prefill: { "a.name": "Ark spelling", "d.counterparties": "Conseil", "d.purpose": "Nouveau" } }, { idempotencyKey: "ow-yes", payloadHash: "yes" });
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

// ---- the form assistant -----------------------------------------------------------------------

test("a question about a field goes to Cadence signed, with the case's route and only that step's answers", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-ask-01", payloadHash: "ask1" });
  const session = { caseId: created.summary.caseId, revision: 1, emailHash: JEAN };
  const calls: { url: string; init: RequestInit }[] = [];
  const reply = (status: number, body: unknown) =>
    (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

  const answer = await askField(
    session,
    { fieldId: "c.pep", question: "Mon oncle est conseiller d'État, est-ce que ça compte ?", language: "fr", answers: { route: "pp", "c.sanctions": "no", "d.counterparties": "Conseil", "a.name": "Test SA" } },
    reply(200, { off_topic: false, answer: "Oui, un proche compte.", proposal: "close" }),
  );
  assert.deepEqual(answer, { offTopic: false, answer: "Oui, un proche compte.", proposal: "close" });
  const { url, init } = calls[0];
  assert.equal(url, "https://app.ark-fid.ch/api/kyc-form/ask");
  const sent = JSON.parse(String(init.body));
  assert.equal(sent.route, "pm-op", "the case's route, never the browser's");
  assert.equal(sent.caseId, created.summary.caseId);
  assert.deepEqual(sent.answers, { "c.sanctions": "no" }, "only the other answers of the field's step");
  const headers = init.headers as Record<string, string>;
  assert.equal(headers["x-kyc-key-id"], "cadence");
  assert.equal(headers["x-kyc-signature"], signRequest("cadence-secret-cadence-secret-cadence-01", "POST", "/kyc-form/ask", headers["x-kyc-timestamp"], headers["x-kyc-nonce"], String(init.body)));

  // Off the form: no proposal reaches the browser, even if one was sent.
  const off = await askField(session, { fieldId: "c.pep", question: "Quel temps fera-t-il ?" }, reply(200, { off_topic: true, answer: null, proposal: "close" }));
  assert.deepEqual(off, { offTopic: true, answer: null, proposal: null });

  // A proposal that is not a listed option of the field never reaches the browser.
  for (const bad of [["close"], "not-an-option"]) {
    const stray = await askField(session, { fieldId: "c.pep", question: "?" }, reply(200, { off_topic: false, answer: "x", proposal: bad }));
    assert.deepEqual(stray, { offTopic: false, answer: "x", proposal: null });
  }

  // A field without help, an unknown field or an empty question: refused before Cadence.
  const before = calls.length;
  for (const body of [{ fieldId: "a.seat", question: "?" }, { fieldId: "x.nope", question: "?" }, { fieldId: "c.pep", question: "  " }]) {
    await assert.rejects(askField(session, body, reply(200, {})), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  }
  assert.equal(calls.length, before);

  // Cadence's limit and failures come back as the site's own codes.
  await assert.rejects(askField(session, { fieldId: "c.pep", question: "?" }, reply(429, {})), (e: unknown) => e instanceof KycError && e.code === "rate_limited");
  await assert.rejects(askField(session, { fieldId: "c.pep", question: "?" }, reply(502, {})), (e: unknown) => e instanceof KycError && e.code === "assist_unavailable");
});

test("documents taken off by Ark: sent at creation, replaced by the documents action, never asked, never missing", async () => {
  const f = await fixture();
  await assert.rejects(
    createCase({ ...createInput(f.clientFolder), skippedDocuments: "pm.chart" }, { keyId: "cadence", idempotencyKey: "create-skip-bad", payloadHash: "b" }),
    (e: unknown) => e instanceof KycError && e.code === "invalid_request",
  );
  const created = await createCase({ ...createInput(f.clientFolder), skippedDocuments: ["pm.shareholders"] }, { keyId: "cadence", idempotencyKey: "create-skip-01", payloadHash: "s" });
  const caseId = created.summary.caseId;
  assert.deepEqual(created.summary.skippedDocuments, ["pm.shareholders"]);
  const client = await clientCase({ caseId, revision: 1, emailHash: JEAN });
  assert.deepEqual(client.skippedDocuments, ["pm.shareholders"], "the client's form filters the same list");
  let staff = await staffCase(caseId);
  assert.equal(staff.documentItems.find((d) => d.key === "pm.shareholders")?.withheld, "removed");
  assert.ok(!staff.documentItems.some((d) => d.key === "pm.rc" || d.key === "pm.statutes"), "a Swiss company's extract and articles are not listed");
  await assert.rejects(
    createUpload({ caseId, revision: 1, emailHash: JEAN }, { kind: "doc", docKey: "pm.shareholders", fileName: "a.pdf", size: 1000, mime: "application/pdf" }),
    (e: unknown) => e instanceof KycError && e.code === "unknown_document",
  );
  // The whole list, replaced; a replay issues no link and changes nothing.
  await assert.rejects(staffAction(caseId, "documents", { expectedRevision: 1 }, { idempotencyKey: "docs-0001", payloadHash: "d0" }), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  const done = await staffAction(caseId, "documents", { expectedRevision: 1, skippedDocuments: ["pm.financials"] }, { idempotencyKey: "docs-0002", payloadHash: "d1" });
  assert.deepEqual(done.summary.skippedDocuments, ["pm.financials"]);
  assert.equal(done.link, undefined);
  const replay = await staffAction(caseId, "documents", { expectedRevision: 1, skippedDocuments: ["pm.financials"] }, { idempotencyKey: "docs-0002", payloadHash: "d1" });
  assert.equal(replay.replayed, true);
  assert.equal(replay.link, undefined);
  staff = await staffCase(caseId);
  assert.equal(staff.documentItems.find((d) => d.key === "pm.shareholders")?.withheld, null);
  assert.equal(staff.documentItems.find((d) => d.key === "pm.financials")?.withheld, "removed");
  const cleared = await staffAction(caseId, "documents", { expectedRevision: 1, skippedDocuments: [] }, { idempotencyKey: "docs-0003", payloadHash: "d2" });
  assert.deepEqual(cleared.summary.skippedDocuments, []);
  // The office holds one (« Ajouter »): off the client's list, listed for Ark as office; the taken-off list is kept.
  await staffAction(caseId, "documents", { expectedRevision: 1, skippedDocuments: ["pm.shareholders"] }, { idempotencyKey: "docs-0004", payloadHash: "d3" });
  await assert.rejects(staffAction(caseId, "documents", { expectedRevision: 1, officeDocuments: "pm.financials" }, { idempotencyKey: "docs-0005", payloadHash: "d4" }), (e: unknown) => e instanceof KycError && e.code === "invalid_request");
  const held = await staffAction(caseId, "documents", { expectedRevision: 1, officeDocuments: ["pm.financials"] }, { idempotencyKey: "docs-0006", payloadHash: "d5" });
  assert.deepEqual(held.summary.officeDocuments, ["pm.financials"]);
  assert.deepEqual(held.summary.skippedDocuments, ["pm.shareholders"], "a list not sent is kept");
  staff = await staffCase(caseId);
  assert.equal(staff.documentItems.find((d) => d.key === "pm.financials")?.withheld, "office");
  const asked = await clientCase({ caseId, revision: 1, emailHash: JEAN });
  assert.deepEqual(asked.officeDocuments, ["pm.financials"]);
  await assert.rejects(
    createUpload({ caseId, revision: 1, emailHash: JEAN }, { kind: "doc", docKey: "pm.financials", fileName: "a.pdf", size: 1000, mime: "application/pdf" }),
    (e: unknown) => e instanceof KycError && e.code === "unknown_document",
  );
  const back = await staffAction(caseId, "documents", { expectedRevision: 1, officeDocuments: [] }, { idempotencyKey: "docs-0007", payloadHash: "d6" });
  assert.deepEqual(back.summary.officeDocuments, []);
});

test("documents Ark asks on this case only: stored by the documents action, asked after the standard ones, with their help", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-extra-01", payloadHash: "x" });
  const caseId = created.summary.caseId;
  assert.deepEqual(created.summary.extraDocuments, [], "none by default");
  const docs = (body: Record<string, unknown>, key: string) => staffAction(caseId, "documents", { expectedRevision: 1, ...body }, { idempotencyKey: key, payloadHash: key });
  const refused = (e: unknown) => e instanceof KycError && e.code === "invalid_request" && e.detail?.field === "extraDocuments";
  for (const [i, bad] of [
    "x",
    [{ key: "other", label: "A", required: true }],
    [{ key: "extra:a b", label: "A" }],
    [{ key: "extra:1", label: "   " }],
    [{ key: "extra:1", label: "A".repeat(201) }],
    [{ key: "extra:1", label: "A", help: 3 }],
    [{ key: "extra:1", label: "A", help: "h".repeat(1001) }],
    [{ key: "extra:1", label: "A", required: "no" }],
    Array.from({ length: 31 }, (_, n) => ({ key: `extra:${n}`, label: "A" })),
  ].entries()) await assert.rejects(docs({ extraDocuments: bad }, `extra-bad-${i}`), refused);
  const done = await docs({ extraDocuments: [
    { key: "extra:3f2a-1", label: "  Bail   à loyer ", help: " Le bail signé de vos bureaux. ", required: true },
    { key: "extra:3f2a-2", label: "Organigramme", help: "", required: false },
    { key: "extra:3f2a-1", label: "Doublon" },
    { key: "extra:3f2a-3", label: "Attestation" },
  ] }, "extra-0001");
  assert.deepEqual(done.summary.extraDocuments, [
    { key: "extra:3f2a-1", label: "Bail à loyer", help: "Le bail signé de vos bureaux.", required: true },
    { key: "extra:3f2a-2", label: "Organigramme", required: false },
    { key: "extra:3f2a-3", label: "Attestation", required: true },
  ]);
  assert.deepEqual(done.summary.skippedDocuments, [], "a list not sent is kept");
  // The client's list: after the standard ones, help as the hint, optional when not required.
  const client = await clientCase({ caseId, revision: 1, emailHash: JEAN });
  const items = documentsFor(pruneHidden({ ...pmOp, "a.uid": "CHE-123.456.789" }), client.skippedDocuments, client.officeDocuments, client.extraDocuments);
  const lease = items.find((d) => d.key === "extra:3f2a-1")!;
  assert.deepEqual(lease.hint, { fr: "Le bail signé de vos bureaux.", en: "Le bail signé de vos bureaux." });
  assert.equal(lease.required, true);
  assert.equal(lease.code, docCode("extra:3f2a-1"));
  assert.equal(items.find((d) => d.key === "extra:3f2a-2")?.required, false);
  assert.ok(items.findIndex((d) => d.key === "other") < items.findIndex((d) => d.key === "extra:3f2a-1"), "after the standard ones");
  assert.ok((await createUpload({ caseId, revision: 1, emailHash: JEAN }, { kind: "doc", docKey: "extra:3f2a-1", fileName: "bail.pdf", size: 1000, mime: "application/pdf" })).uploadUrl);
  // Staff items carry the help, standard documents too.
  let staff = await staffCase(caseId);
  assert.deepEqual(staff.documentItems.find((d) => d.key === "extra:3f2a-1")?.help, { fr: "Le bail signé de vos bureaux.", en: "Le bail signé de vos bureaux." });
  assert.equal(staff.documentItems.find((d) => d.key === "extra:3f2a-2")?.help, undefined);
  // Taken off and held by the office apply to them like any document.
  await docs({ skippedDocuments: ["extra:3f2a-2"], officeDocuments: ["extra:3f2a-3"] }, "extra-0002");
  staff = await staffCase(caseId);
  assert.equal(staff.documentItems.find((d) => d.key === "extra:3f2a-2")?.withheld, "removed");
  assert.equal(staff.documentItems.find((d) => d.key === "extra:3f2a-3")?.withheld, "office");
  assert.equal(staff.extraDocuments.length, 3, "an extraDocuments list not sent is kept");
  const asked = documentsFor(pruneHidden(pmOp), ["extra:3f2a-2"], ["extra:3f2a-3"], staff.extraDocuments).map((d) => d.key);
  assert.ok(asked.includes("extra:3f2a-1") && !asked.includes("extra:3f2a-2") && !asked.includes("extra:3f2a-3"));
  // Replaced, then cleared by an empty list.
  const replaced = await docs({ extraDocuments: [{ key: "extra:9", label: "Autre pièce", required: false }] }, "extra-0003");
  assert.deepEqual(replaced.summary.extraDocuments, [{ key: "extra:9", label: "Autre pièce", required: false }]);
  const cleared = await docs({ extraDocuments: [] }, "extra-0004");
  assert.deepEqual(cleared.summary.extraDocuments, []);
  assert.equal((await loadCase(caseId)).extraDocuments, undefined);
  assert.ok(!(await staffCase(caseId)).documentItems.some((d) => d.key.startsWith("extra:")));
});

test("a standard document's help reaches the staff items; without extras the list is unchanged", () => {
  const a = pruneHidden(pp);
  assert.deepEqual(documentList(a, [], [], []), documentList(a));
  const id = documentList(a).find((d) => d.key === "pp.id")!;
  assert.ok(id.hint?.fr.startsWith("Copie certifiée"));
});

test("a retired question is never prefilled; an operating company starts with « its business » ticked", async () => {
  const f = await fixture();
  const created = await createCase({ ...createInput(f.clientFolder, "pp"), prefill: { "a.lastName": "Martin", "a.idNumber": "X1" } }, { keyId: "cadence", idempotencyKey: "create-retired-01", payloadHash: "r1" });
  const view = await clientCase({ caseId: created.summary.caseId, revision: 1, emailHash: JEAN });
  assert.equal(view.answers["a.idNumber"], undefined);
  assert.deepEqual(view.prefilledIds, ["a.lastName"]);
  const op = await createCase({ ...createInput(f.clientFolder), clientRef: "cadence-43" }, { keyId: "cadence", idempotencyKey: "create-default-01", payloadHash: "d1" });
  const opView = await clientCase({ caseId: op.summary.caseId, revision: 1, emailHash: JEAN });
  assert.deepEqual(opView.answers["e.companyAssetSources"], ["activity"]);
  assert.ok(!opView.prefilledIds.includes("e.companyAssetSources"), "a default, not Ark's prefill");
});

test("a case sent with the earlier form still shows Ark every answer it holds", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder, "pm-nonop"), { keyId: "cadence", idempotencyKey: "create-old-01", payloadHash: "o1" });
  const caseId = created.summary.caseId;
  const session = { caseId, revision: 1, emailHash: JEAN };
  await uploadAll(f, caseId, pmNonOp);
  await submit(session, { answers: pmNonOp, submitKey: "old-1" });
  const record = await loadCase(caseId);
  const rev = record.revisions[0];
  const stored = JSON.parse(new TextDecoder().decode(await f.storage.readFile(record.driveId, rev.folderId, "questionnaire.json")));
  // As the earlier form stored it: separate signatories, sector, turnover and premises on this route.
  delete stored.formVersion;
  stored.answers = { ...stored.answers, "a.signatories": [row("sig0001", { lastName: "Dupont", firstName: "Jean", signing: "joint" })], "d.sector": "Immobilier", "g.turnover": "50'000", "a.ownPremises": "no", "a.idNumber": "X1" };
  stored.answers["a.directors"] = [row("dir0001", { lastName: "Dupont", firstName: "Jean", function: "Administrateur", nationality: "Suisse", country: "Suisse" })];
  await f.storage.putFile(record.driveId, rev.folderId, "questionnaire.json", new TextEncoder().encode(JSON.stringify(stored)), "application/json");
  const staff = await staffCase(caseId);
  assert.equal((staff.answers?.["a.directors"] as Record<string, string>[])[0].signing, "joint");
  assert.match(String(staff.answers?.["d.activity"]), /Immobilier/);
  const shown = staff.pages.flatMap((page) => page.fieldIds);
  for (const id of ["g.turnover", "a.ownPremises", "d.activity"]) assert.ok(shown.includes(id), `${id} shown`);
  assert.ok(staff.pages.every((page) => page.missingFieldIds.length === 0), "a sent form is never « missing » under newer rules");
  const label = staff.pages.flatMap((page) => page.parts).find((part) => part.id === "d.activity")?.label?.fr;
  assert.equal(label, "Que détient la société ?", "the route's wording travels with the page");
});

// ---- Cadence's layout: <Client>/<YYYY>/Pièces/ and <Client>/Données techniques/ -------------------

/** A client folder with the two layout folders Cadence makes, as Cadence would send them. */
async function layoutFixture() {
  const f = await fixture();
  const client = path.join("Dossiers LBA Clients", "Test SA");
  const pieces = path.join(client, "2026", "Pièces");
  const technical = path.join(client, "Données techniques");
  await fs.mkdir(path.join(f.base, pieces), { recursive: true });
  await fs.mkdir(path.join(f.base, technical), { recursive: true });
  const ref = (rel: string) => ({ driveId: "mock-drive", itemId: f.storage.idOf(rel) });
  return {
    ...f,
    client: path.join(f.base, client),
    piecesDir: path.join(f.base, pieces),
    technicalDir: path.join(f.base, technical),
    input: (route = "pm-op") => ({ ...createInput(f.clientFolder, route), piecesFolder: ref(pieces), technicalFolder: ref(technical) }),
  };
}

/** Uploads the required documents the way the form does (the name is the form's), then gives each its bytes. */
async function uploadViaForm(f: Awaited<ReturnType<typeof layoutFixture>>, caseId: string, answers: Answers) {
  const session = { caseId, revision: (await loadCase(caseId)).revisions.length, emailHash: JEAN };
  await saveDraft(session, { answers, stepId: "d" });
  for (const item of documentsFor(pruneHidden(answers)).filter((d) => d.required)) {
    await createUpload(session, { kind: "doc", docKey: item.key, fileName: "scan.pdf", size: 13, mime: "application/pdf" });
  }
  for (const name of await fs.readdir(f.piecesDir)) {
    const full = path.join(f.piecesDir, name);
    if (name.endsWith(`(${caseId} R${session.revision}).pdf`) && (await fs.stat(full)).size === 0) await fs.writeFile(full, "%PDF-1.4 test");
  }
}

test("a case sent with the layout folders files into them and nowhere else, beside another case of the client", async () => {
  const f = await layoutFixture();
  const a = (await createCase(f.input(), { keyId: "cadence", idempotencyKey: "create-lay-a1", payloadHash: "a" })).summary.caseId;
  const b = (await createCase({ ...f.input(), clientRef: "cadence-43" }, { keyId: "cadence", idempotencyKey: "create-lay-b1", payloadHash: "b" })).summary.caseId;
  const replay = await createCase(f.input(), { keyId: "cadence", idempotencyKey: "create-lay-a1", payloadHash: "a" });
  assert.equal(replay.summary.caseId, a);
  assert.equal(replay.replayed, true);

  // No `KYC <id>/` folder: the client folder holds only the year and the technical folder.
  assert.deepEqual((await fs.readdir(f.client)).sort(), ["2026", "Données techniques"]);
  const record = await loadCase(a);
  assert.equal(record.folderId, f.input().technicalFolder.itemId);
  assert.equal(record.folders?.piecesFolderId, f.input().piecesFolder.itemId);
  assert.ok((await fs.readdir(f.technicalDir)).includes(`KYC ${a} - case.json`));

  const answers = pmOp;
  await uploadViaForm(f, a, answers);
  await uploadViaForm(f, b, answers);
  const sessionA = { caseId: a, revision: 1, emailHash: JEAN };
  // Case B's documents sit in the same folder and never count for case A, nor does a forged name.
  await fs.writeFile(path.join(f.piecesDir, `[000000000000] x - forged (${a} R1) (${b} R1).pdf`), "%PDF-1.4 other");
  assert.ok(((await clientCase(sessionA)).files as { name: string }[]).every((file) => file.name.endsWith(`(${a} R1).pdf`)));
  const sent = await submit(sessionA, { answers, submitKey: "k1" });
  assert.equal(sent.state, "awaiting_signature");

  const rev = (await loadCase(a)).revisions[0];
  assert.ok(rev.pdf?.name.endsWith(`(${a} R1).pdf`), "the PDF to sign is named for its case");
  assert.ok((await fs.readdir(f.piecesDir)).includes(rev.pdf!.name), "the PDF to sign is in Pièces");
  const data = await fs.readdir(f.technicalDir);
  for (const name of [`KYC ${a} R1 - draft.json`, `KYC ${a} R1 - questionnaire.json`, `KYC ${a} R1 - questionnaire.sha256`]) assert.ok(data.includes(name), name);
  assert.ok(!(await fs.readdir(f.piecesDir)).some((name) => name.endsWith(".json") || name.endsWith(".sha256")), "no data file among the documents");
  assert.ok(rev.documents?.every((d) => d.files.every((x) => x.name.endsWith(`(${a} R1).pdf`))), "only this case's documents are frozen");

  // What Cadence reads: the readable folder is Pièces.
  const summary = await staffCase(a);
  assert.equal(summary.folder.itemId, f.input().piecesFolder.itemId);
  assert.equal(summary.latestRevision.folder.itemId, f.input().piecesFolder.itemId);

  // The signed scan goes to Pièces too; another case's signed file there is neither read nor deleted.
  const foreign = `Formulaire signé scan (${b} R1).pdf`;
  await fs.writeFile(path.join(f.piecesDir, foreign), "%PDF-1.4 foreign");
  // A client document whose file name says « signé en ligne » is still a document, not a signed form.
  await fs.writeFile(path.join(f.piecesDir, `[000000000001] a - signé en ligne (${a} R1).pdf`), "%PDF-1.4 doc");
  await assert.rejects(confirmSigned(sessionA), (e: unknown) => e instanceof KycError && e.code === "signed_missing");
  await createUpload(sessionA, { kind: "signed", fileName: "scan.pdf", size: 15, mime: "application/pdf" });
  const mine = `Formulaire signé scan (${a} R1).pdf`;
  assert.ok((await fs.readdir(f.piecesDir)).includes(mine));
  await fs.writeFile(path.join(f.piecesDir, mine), "%PDF-1.4 signed");
  assert.equal((await confirmSigned(sessionA)).state, "signed");
  assert.deepEqual((await loadCase(a)).revisions[0].signed?.map((x) => x.name), [mine]);
  assert.ok((await fs.readdir(f.piecesDir)).includes(foreign));

  // A correction keeps filing into the same two folders, still with no folder of its own.
  await staffAction(a, "reopen", { expectedRevision: 1 }, { idempotencyKey: "reopen-lay-01", payloadHash: "r" });
  const next = (await loadCase(a)).revisions[1];
  assert.equal(next.folderId, f.input().technicalFolder.itemId);
  assert.equal(next.docsFolderId, f.input().piecesFolder.itemId);
  assert.ok((await fs.readdir(f.technicalDir)).includes(`KYC ${a} R2 - draft.json`));
  assert.deepEqual((await fs.readdir(f.client)).sort(), ["2026", "Données techniques"]);
});

test("a case without the layout folders keeps its own folders, beside layout cases", async () => {
  const f = await layoutFixture();
  const legacy = (await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-lay-old", payloadHash: "o" })).summary.caseId;
  const laid = (await createCase(f.input(), { keyId: "cadence", idempotencyKey: "create-lay-new", payloadHash: "n" })).summary.caseId;
  const old = await loadCase(legacy);
  assert.equal(old.folders, undefined);
  assert.ok((await fs.readdir(path.join(f.client, `KYC ${legacy}`))).includes("case.json"));
  assert.ok((await fs.readdir(path.join(f.client, `KYC ${legacy}`, "Révision 1"))).includes("draft.json"));
  assert.equal((await loadCase(laid)).caseId, laid);
  await uploadAll(f, legacy, pmOp);
  assert.equal((await submit({ caseId: legacy, revision: 1, emailHash: JEAN }, { answers: pmOp })).state, "awaiting_signature");
  assert.ok((await fs.readdir(path.join(f.client, `KYC ${legacy}`, "Révision 1"))).some((name) => name.endsWith("à signer.pdf")), "the old way, untouched");
  assert.deepEqual((await fs.readdir(f.piecesDir)).filter((name) => name.includes(legacy)), []);
});

test("the layout folders come both or neither, and only from the client's library", async () => {
  const f = await layoutFixture();
  const meta = (n: string) => ({ keyId: "cadence", idempotencyKey: `create-lay-bad-${n}`, payloadHash: n });
  const bad = (e: unknown) => e instanceof KycError && e.code === "invalid_request";
  await assert.rejects(createCase({ ...f.input(), technicalFolder: undefined }, meta("1")), bad);
  await assert.rejects(createCase({ ...f.input(), piecesFolder: undefined }, meta("2")), bad);
  await assert.rejects(createCase({ ...f.input(), piecesFolder: { driveId: "another-drive", itemId: f.input().piecesFolder.itemId } }, meta("3")), bad);
  await assert.rejects(createCase({ ...f.input(), technicalFolder: { driveId: "mock-drive", itemId: "no-such-folder" } }, meta("4")), (e: unknown) => e instanceof KycError && e.code === "client_folder_not_found");
});

test("the form's two PDFs keep two names in the shared folder, even for a very long client name", () => {
  const record = { caseId: "KABCDEFGHIJKL", folders: { piecesFolderId: "p", technicalFolderId: "t" } } as unknown as Parameters<typeof formPdfName>[0];
  const rev = { n: 1 } as Parameters<typeof formPdfName>[1];
  const name = "Société de gestion d'actifs et de participations immobilières internationales ".repeat(2);
  const toSign = formPdfName(record, rev, name, "à signer");
  const online = formPdfName(record, rev, name, "signé en ligne");
  assert.notEqual(toSign, online);
  assert.ok(toSign.endsWith("(KABCDEFGHIJKL R1).pdf") && online.endsWith("(KABCDEFGHIJKL R1).pdf"));
});

test("section G: an operating company gives its turnover, others the amount through the accounts; no payment count", () => {
  const visible = (a: Answers) => Object.keys(pruneHidden({ ...a, "g.turnover": "1", "g.amount": "1", "g.paymentsPerYear": "2", "g.paymentsTotal": "3" })).filter((k) => k.startsWith("g.") && !k.startsWith("g.types"));
  assert.deepEqual(visible(pmOp).sort(), ["g.paymentsPerYear", "g.paymentsTotal", "g.turnover"], "old numbers only read-only (retired)");
  assert.deepEqual(visible(pmNonOp).sort(), ["g.amount", "g.paymentsPerYear", "g.paymentsTotal"]);
  assert.deepEqual(visible(pp).sort(), ["g.amount", "g.paymentsPerYear", "g.paymentsTotal"]);
  for (const id of ["g.operations", "g.paymentsPerYear", "g.paymentsTotal"]) assert.equal(isRetiredId(id), true, id);
  assert.equal(getField("g.amount")!.type, "money");
  const { "g.amount": _a, ...noAmount } = pp;
  assert.deepEqual(Object.keys(validateAll(pruneHidden(noAmount))).filter((k) => k.startsWith("g.")), ["g.amount"]);
  assert.deepEqual(Object.keys(validateAll(pruneHidden({ ...noAmount, "g.paymentsPerYear": "5" }))).filter((k) => k.startsWith("g.")), [], "an earlier answer counts");
});

test("a draft saved before the 2026-11-15 changes: old answers moved, kept through the client's saves and sent read-only", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-old-draft", payloadHash: "old" });
  const caseId = created.summary.caseId;
  const session = { caseId, revision: 1, emailHash: JEAN };
  const record = await loadCase(caseId);
  const rev = record.revisions[0];
  // What a client had typed under the old section B and G (formVersion 3: holders already moved).
  const { "b.qOther": _q, ...rest } = pmOp;
  const oldAnswers: Answers = {
    ...rest,
    "b.q25": "yes",
    "b.controllers25": [row("per0001", { ...person, percent: "100" })],
    "b.qOther": "yes",
    "b.controllersOther": [row("ctl0002", { ...person, lastName: "Keller", firstName: "Eva", controlType: "Pacte d'actionnaires" })],
    "b.structureDetails": "Détenue à 100 % par M. Dupont",
    "g.operations": "40 paiements, 200 000 CHF",
  };
  await f.storage.putFile(record.driveId, rev.folderId, "draft.json", new TextEncoder().encode(JSON.stringify({ savedAt: "2026-11-14T10:00:00Z", stepId: "g", answers: oldAnswers, docDeclared: {}, formVersion: 3 })), "application/json");

  const staff = await staffCase(caseId);
  assert.deepEqual(staff.draft?.["b.controlPersons"], ["ctl0002p"], "other control moved to the persons");
  assert.equal(staff.draft?.["b.controlHow"], "Pacte d'actionnaires");
  assert.equal(staff.draft?.["b.structureDetails"], "Détenue à 100 % par M. Dupont", "a retired answer still shows to Ark");
  assert.ok(staff.pages.some((page) => page.parts.some((part) => part.id === "b.structureDetails" && part.retired)));
  const missing = staff.pages.flatMap((page) => page.missingFieldIds);
  assert.ok(!missing.some((k) => k.startsWith("b.") || k.startsWith("g.")), `nothing new to answer because of the change: ${missing.join(", ")}`);

  // The client's next save (the form never sends retired answers) keeps them in the draft.
  const view = await clientCase(session);
  assert.equal(view.draft?.answers["b.structureDetails"], "Détenue à 100 % par M. Dupont");
  const { "b.structureDetails": _s, "b.controllersOther": _c, "b.q25": _q25, "b.controllers25": _c25, ...fromBrowser } = view.draft!.answers;
  await saveDraft(session, { answers: fromBrowser, stepId: "g" });
  const saved = JSON.parse(new TextDecoder().decode((await f.storage.readFile(record.driveId, rev.folderId, "draft.json"))!));
  assert.equal(saved.formVersion, 4);
  assert.equal(saved.answers["b.structureDetails"], "Détenue à 100 % par M. Dupont");
  assert.ok(saved.answers["b.controllersOther"], "the old list stays, retired");
  assert.deepEqual(saved.answers["b.controlPersons"], ["ctl0002p"]);

  // Sent: retired answers go along, read-only.
  await uploadAll(f, caseId, saved.answers);
  const sent = await submit(session, { answers: fromBrowser, submitKey: "old-1" });
  assert.equal(sent.state, "awaiting_signature");
  const stored = JSON.parse(new TextDecoder().decode((await f.storage.readFile(record.driveId, rev.folderId, "questionnaire.json"))!));
  assert.equal(stored.answers["g.operations"], "40 paiements, 200 000 CHF");
  assert.equal(stored.answers["b.structureDetails"], "Détenue à 100 % par M. Dupont");
  const after = await staffCase(caseId);
  assert.ok(after.pages.some((page) => page.parts.some((part) => part.id === "b.structureDetails")), "Ark still reads it once sent");
});

test("a person's draft with this morning's two payment numbers: the total becomes the amount, nothing new to answer", async () => {
  const f = await fixture();
  const created = await createCase({ ...createInput(f.clientFolder, "pp") }, { keyId: "cadence", idempotencyKey: "create-old-pp", payloadHash: "pp" });
  const caseId = created.summary.caseId;
  const record = await loadCase(caseId);
  const rev = record.revisions[0];
  const { "g.amount": _a, ...rest } = pp;
  for (const [n, answers] of [[1, { ...rest, "g.paymentsPerYear": "5", "g.paymentsTotal": "10'000" }], [2, { ...rest, "g.operations": "Variable" }]] as const) {
    await f.storage.putFile(record.driveId, rev.folderId, "draft.json", new TextEncoder().encode(JSON.stringify({ savedAt: "2026-11-15T08:00:00Z", stepId: "g", answers, docDeclared: {}, formVersion: 3 })), "application/json");
    const staff = await staffCase(caseId);
    assert.equal(staff.draft?.["g.amount"], n === 1 ? "10'000" : undefined);
    assert.ok(!staff.pages.flatMap((page) => page.missingFieldIds).some((k) => k.startsWith("g.")), `case ${n}: nothing in G becomes incomplete`);
  }
});

test("reopening a form sent before 2026-11-15: the new draft takes the moved answers and keeps the retired ones", async () => {
  const f = await fixture();
  const created = await createCase(createInput(f.clientFolder), { keyId: "cadence", idempotencyKey: "create-old-reopen", payloadHash: "reo" });
  const caseId = created.summary.caseId;
  const session = { caseId, revision: 1, emailHash: JEAN };
  await uploadAll(f, caseId, pmOp);
  await submit(session, { answers: pmOp });
  const record = await loadCase(caseId);
  const rev = record.revisions[0];
  const stored = JSON.parse(new TextDecoder().decode((await f.storage.readFile(record.driveId, rev.folderId, "questionnaire.json"))!));
  const { "b.qOther": _q, ...rest } = stored.answers;
  stored.answers = { ...rest, "b.qOther": "yes", "b.controllersOther": [row("ctl0002", { ...person, lastName: "Keller", firstName: "Eva", controlType: "Veto" })], "g.operations": "40 paiements, 200 000 CHF" };
  delete stored.formVersion;
  await f.storage.putFile(record.driveId, rev.folderId, "questionnaire.json", new TextEncoder().encode(JSON.stringify(stored)), "application/json");
  const signedFolder = await f.storage.ensureSubfolder(record.driveId, rev.folderId, "Signé");
  await f.storage.putFile(record.driveId, signedFolder, "Formulaire signé R1 - scan.pdf", new TextEncoder().encode("%PDF-1.4 signed"), "application/pdf");
  await confirmSigned(session);
  await staffAction(caseId, "reopen", { expectedRevision: 1 }, { idempotencyKey: "reopen-old-01", payloadHash: "ro" });
  const v2 = (await staffCase(caseId)).draft!;
  assert.deepEqual(v2["b.controlPersons"], ["ctl0002p"]);
  assert.equal(v2["g.operations"], "40 paiements, 200 000 CHF", "retired answer kept, read-only");
  assert.ok(v2["b.controllersOther"]);
});

test("draft PDF: the form's layout, every page marked, nothing to sign; a bad route is refused", async () => {
  const { previewPdf } = await import("./server/service");
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await previewPdf("pm-op", { ...pmOp, "g.operations": "50" }, "Test SA", "fr");
  assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 2);
  // Every page carries the draft footer; nothing to sign and no declarations.
  const { inflateSync } = await import("node:zlib");
  const pageText = doc.getPages().map((page) => {
    const contents = page.node.Contents();
    const streams = contents && "asArray" in contents ? contents.asArray() : contents ? [contents] : [];
    return streams.map((ref) => {
      const stream = doc.context.lookup(ref) as unknown as { getContents(): Uint8Array; dict: { get(k: unknown): unknown } };
      const raw = Buffer.from(stream.getContents());
      try { return inflateSync(raw).toString("latin1"); } catch { return raw.toString("latin1"); }
    }).join("");
  });
  const hex = (text: string) => Buffer.from(text, "latin1").toString("hex").toUpperCase();
  for (const text of pageText) assert.ok(text.includes(hex("Brouillon")), "draft on every page");
  const all = pageText.join("");
  assert.ok(!all.includes(hex("Signature en ligne")) && !all.includes(hex("Lieu et date")), "no signature block");
  assert.ok(!all.includes(hex("En signant pour")), "no declarations");
  assert.equal(doc.getTitle(), "Questionnaire client – Test SA");
  await assert.rejects(previewPdf("nope", pmOp, "Test SA", "fr"), (e: { code?: string; status?: number }) => e.status === 400);
});
