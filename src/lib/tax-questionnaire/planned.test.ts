import assert from "node:assert/strict";
import test from "node:test";

import { emailHashOf, plannedKey, runCampaign, type CampaignDeps, type InvitedReturnInput } from "./server/campaign.ts";
import type { ReturnRecord } from "./server/ports.ts";
import { memoryPorts } from "./server/sharepoint-registry.ts";
import type { MailMessage } from "./server/storage.ts";

/** A staff inventory row: no case, tax year 2026 (campaign of February 2027). */
const plannedRow = (name: string, extra: Partial<ReturnRecord> = {}): ReturnRecord => ({
  caseId: "",
  householdId: "",
  clientKey: "",
  emailHash: "",
  name,
  email: "",
  language: "",
  canton: "GE",
  taxYear: 2026,
  state: "draft",
  regime: "",
  optIn: false,
  aiOptIn: false,
  driveId: "",
  folderId: "",
  folderUrl: "https://example.sharepoint.com/sites/client",
  source: "inventaire",
  ...extra,
});

function setup(crmClients: { id: string; email: string; lastName: string; firstName: string }[] = []) {
  const mem = memoryPorts();
  const sent: MailMessage[] = [];
  let seq = 0;
  const created: InvitedReturnInput[] = [];
  const deps: CampaignDeps = {
    registry: { ...mem.ports.registry, listTaxClients: async () => crmClients },
    tracker: mem.ports.tracker,
    prefs: mem.ports.prefs,
    sendMail: async (m) => void sent.push(m),
    issueLink: async (o) => `https://tax.ark-fid.ch/fr/#acces=${o.purpose}${o.caseId.length}`,
    createInvitedReturn: async (input) => {
      created.push(input);
      const record: ReturnRecord = {
        ...plannedRow(input.name),
        caseId: `case${++seq}`,
        householdId: `hh${seq}`,
        clientKey: input.clientKey,
        emailHash: emailHashOf(input.email),
        email: input.email,
        language: input.language,
        taxYear: input.taxYear,
        state: "invited",
        source: "campaign",
        trackerId: input.planned?.trackerId,
      };
      record.trackerId = await mem.ports.tracker.upsert(record);
      return record;
    },
    staffRecipients: ["samuel.halff@ark-fid.ch"],
  };
  return { mem, deps, sent, created };
}

const feb = new Date("2027-02-01T06:15:00Z");

async function addPlanned(mem: ReturnType<typeof memoryPorts>, row: ReturnRecord, staffStatus: string) {
  const id = await mem.ports.tracker.upsert(row);
  const stored = mem.returns.find((r) => r.trackerId === id)!;
  stored.staffStatus = staffStatus;
  return id;
}

test("planned rows: two inventory rows of the same year never collide", async () => {
  const { mem } = setup();
  const a = await addPlanned(mem, plannedRow("Allamand Pauline"), "À valider");
  const b = await addPlanned(mem, plannedRow("Bernard Jean"), "À valider");
  assert.notEqual(a, b);
  assert.equal(mem.returns.length, 2);
});

test("planned row validated with an e-mail: invited once, the case is created on that same row", async () => {
  const { mem, deps, sent, created } = setup();
  const id = await addPlanned(mem, plannedRow("Allamand Pauline", { email: "pauline@example.ch" }), "Nouveau");
  const summary = await runCampaign(deps, { now: feb });
  assert.equal(summary.invitations, 1);
  assert.equal(created[0].planned?.trackerId, id);
  assert.equal(mem.returns.length, 1, "no duplicate row");
  const row = mem.returns[0];
  assert.equal(row.caseId, "case1");
  assert.equal(row.state, "invited");
  assert.ok(row.invitedAt);
  assert.equal(row.clientKey, plannedKey({ ...plannedRow("x"), trackerId: id }));
  assert.ok(sent.some((m) => m.to.includes("pauline@example.ch")));
  // Next run: the row is now a return; no second invitation.
  const again = await runCampaign(deps, { now: new Date("2027-02-02T06:15:00Z") });
  assert.equal(again.invitations, 0);
});

test("planned rows still to validate, without e-mail or excluded are not invited", async () => {
  const { mem, deps } = setup();
  await addPlanned(mem, plannedRow("A Valider", { email: "a@example.ch" }), "À valider");
  await addPlanned(mem, plannedRow("Sans Email"), "Nouveau");
  await addPlanned(mem, plannedRow("Exclu Client", { email: "x@example.ch", excludedFromCampaign: true }), "Nouveau");
  const summary = await runCampaign(deps, { now: feb });
  assert.equal(summary.invitations, 0);
  assert.ok(mem.returns.every((r) => !r.caseId));
});

test("a CRM client matching a planned row (same e-mail): nothing while « À valider », then invited once on that row", async () => {
  const { mem, deps, sent, created } = setup([{ id: "1", email: "Pauline@Example.ch", lastName: "Allamand", firstName: "Pauline" }]);
  const id = await addPlanned(mem, plannedRow("Allamand Pauline", { email: "pauline@example.ch" }), "À valider");
  assert.equal((await runCampaign(deps, { now: feb })).invitations, 0);
  mem.returns.find((r) => r.trackerId === id)!.staffStatus = "Nouveau";
  const summary = await runCampaign(deps, { now: feb });
  assert.equal(summary.invitations, 1);
  assert.equal(created[0].planned?.trackerId, id);
  assert.equal(mem.returns.length, 1);
  assert.equal(sent.filter((m) => m.subject.includes("2026")).length, 1);
});

test("a CRM client whose planned row is excluded is skipped", async () => {
  const { mem, deps } = setup([{ id: "1", email: "pauline@example.ch", lastName: "Allamand", firstName: "Pauline" }]);
  await addPlanned(mem, plannedRow("Allamand Pauline", { email: "pauline@example.ch", excludedFromCampaign: true }), "Nouveau");
  const summary = await runCampaign(deps, { now: feb });
  assert.equal(summary.invitations, 0);
});

test("an e-mail shared by a CRM client and two planned rows: each person invited once on their own row; reminders continue", async () => {
  const { mem, deps, created } = setup([{ id: "1", email: "shared@example.ch", lastName: "Un", firstName: "Client" }]);
  const one = await addPlanned(mem, plannedRow("UN Client", { email: "shared@example.ch" }), "Nouveau");
  const two = await addPlanned(mem, plannedRow("DEUX Client", { email: "shared@example.ch" }), "Nouveau");
  await runCampaign(deps, { now: feb });
  assert.deepEqual(created.map((c) => c.planned?.trackerId).sort(), [one, two].sort(), "the CRM client takes its own row, the other family member theirs");
  assert.equal(mem.returns.length, 2, "no duplicate row");

  const ambiguous = setup([{ id: "1", email: "shared@example.ch", lastName: "Trois", firstName: "Client" }]);
  await addPlanned(ambiguous.mem, plannedRow("UN Client", { email: "shared@example.ch" }), "Nouveau");
  await addPlanned(ambiguous.mem, plannedRow("DEUX Client", { email: "shared@example.ch" }), "Nouveau");
  await runCampaign(ambiguous.deps, { now: feb });
  assert.equal(ambiguous.created.filter((c) => c.planned && c.name === "TROIS Client").length, 0, "no planned row given to a CRM client with another name");

  const solo = setup();
  await addPlanned(solo.mem, plannedRow("Allamand Pauline", { email: "pauline@example.ch" }), "Nouveau");
  await runCampaign(solo.deps, { now: feb });
  const reminders = await runCampaign(solo.deps, { now: new Date("2027-02-16T06:15:00Z") });
  assert.equal(reminders.reminders, 1, "the converted row keeps its reminders");
});

test("rows without a case that are not from the inventory are ignored", async () => {
  const { mem, deps } = setup();
  await addPlanned(mem, plannedRow("Ancienne Ligne", { email: "old@example.ch", source: "" }), "Nouveau");
  assert.equal((await runCampaign(deps, { now: feb })).invitations, 0);
});

test("two planned rows on one e-mail (one person handles both returns): each invited on its own row", async () => {
  const { mem, deps, sent, created } = setup();
  const a = await addPlanned(mem, plannedRow("Anders Granath", { email: "family@example.ch" }), "Nouveau");
  const b = await addPlanned(mem, plannedRow("Rogers Piper", { email: "family@example.ch" }), "Nouveau");
  const summary = await runCampaign(deps, { now: feb });
  assert.equal(summary.invitations, 2);
  assert.deepEqual(created.map((c) => c.planned?.trackerId).sort(), [a, b].sort());
  assert.equal(mem.returns.length, 2, "no duplicate row");
  assert.equal(sent.filter((m) => m.to.includes("family@example.ch")).length, 2);
  const again = await runCampaign(deps, { now: new Date("2027-02-02T06:15:00Z") });
  assert.equal(again.invitations, 0);
  const reminders = await runCampaign(deps, { now: new Date("2027-02-16T06:15:00Z") });
  assert.equal(reminders.reminders, 2, "both returns keep their reminders");
});
