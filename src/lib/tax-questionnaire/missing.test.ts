import assert from "node:assert/strict";
import test from "node:test";

import { dueMissingReminder, emailHashOf, runCampaign, type CampaignDeps } from "./server/campaign.ts";
import type { ReturnRecord } from "./server/ports.ts";
import { nextStaffStatus } from "./server/service.ts";
import { memoryPorts } from "./server/sharepoint-registry.ts";
import type { MailMessage } from "./server/storage.ts";

const submitted = (extra: Partial<ReturnRecord> = {}): ReturnRecord => ({
  caseId: "case0001",
  householdId: "hh",
  clientKey: "key0001",
  emailHash: emailHashOf("anne@example.ch"),
  name: "MARTIN Anne",
  email: "anne@example.ch",
  language: "fr",
  canton: "GE",
  taxYear: 2025,
  state: "submitted",
  regime: "",
  optIn: false,
  aiOptIn: false,
  driveId: "d",
  folderId: "f",
  folderUrl: "",
  source: "campaign",
  submittedAt: "2026-03-02T10:00:00Z",
  missingDocs: "Relevé fiscal au 31.12.2025 – UBS",
  ...extra,
});

function setup(record: ReturnRecord, missing: () => string[]) {
  const mem = memoryPorts();
  const sent: MailMessage[] = [];
  const deps: CampaignDeps = {
    registry: { ...mem.ports.registry, listTaxClients: async () => [] },
    tracker: mem.ports.tracker,
    prefs: mem.ports.prefs,
    sendMail: async (m) => void sent.push(m),
    issueLink: async (o) => `https://tax.ark-fid.ch/fr/#acces=${o.purpose}`,
    createInvitedReturn: async () => {
      throw new Error("no invitation expected");
    },
    refreshMissing: async () => missing(),
    staffRecipients: ["samuel.halff@ark-fid.ch", "sebastien.gallie@ark-fid.ch"],
  };
  return { mem, deps, sent, ready: mem.ports.tracker.upsert(record) };
}

const day = (iso: string) => new Date(`${iso}T06:15:00Z`);
const missingMails = (sent: MailMessage[]) => sent.filter((m) => m.subject.startsWith("Documents pour votre déclaration"));

test("missing documents: reminder 7 days after submission, then every 14 days, with the list and the status link", async () => {
  const { mem, deps, sent, ready } = setup(submitted(), () => ["Relevé fiscal au 31.12.2025 – UBS"]);
  await ready;
  assert.equal((await runCampaign(deps, { now: day("2026-03-08") })).missingReminders, 0, "day 6");
  assert.equal((await runCampaign(deps, { now: day("2026-03-09") })).missingReminders, 1, "day 7");
  const mail = missingMails(sent)[0];
  assert.match(mail.html, /Il nous manque encore/);
  assert.match(mail.html, /Relevé fiscal au 31\.12\.2025 – UBS/);
  assert.match(mail.html, /acces=status/);
  assert.equal((await runCampaign(deps, { now: day("2026-03-20") })).missingReminders, 0, "11 days later");
  assert.equal((await runCampaign(deps, { now: day("2026-03-23") })).missingReminders, 1, "14 days later");
  const row = mem.returns[0];
  assert.equal(row.missingRemindersSent, 2);
  assert.ok(row.lastMissingReminderAt?.startsWith("2026-03-23"));
});

test("missing documents: stops when complete, on a staff stop status, after the deadline or on opt-out", async () => {
  let list = ["Relevé fiscal au 31.12.2025 – UBS"];
  const complete = setup(submitted(), () => list);
  await complete.ready;
  list = [];
  assert.equal((await runCampaign(complete.deps, { now: day("2026-03-09") })).missingReminders, 0, "nothing missing");

  const staff = setup(submitted(), () => ["X"]);
  await staff.ready;
  staff.mem.returns[0].staffStatus = "Dossier complet";
  assert.equal((await runCampaign(staff.deps, { now: day("2026-03-09") })).missingReminders, 0, "staff stop status");

  const late = setup(submitted({ submittedAt: "2026-04-20T10:00:00Z" }), () => ["X"]);
  await late.ready;
  assert.equal((await runCampaign(late.deps, { now: day("2026-05-05") })).missingReminders, 0, "after the deadline");

  const optedOut = setup(submitted(), () => ["X"]);
  await optedOut.ready;
  await optedOut.mem.ports.prefs.upsert({ clientKey: "key0001", email: "anne@example.ch", name: "MARTIN Anne", language: "fr", optIn: false, excluded: true });
  assert.equal((await runCampaign(optedOut.deps, { now: day("2026-03-09") })).missingReminders, 0, "opted out");
});

test("missing documents: staff digest after two unanswered reminders", async () => {
  const { deps, sent, ready } = setup(submitted({ missingRemindersSent: 1, lastMissingReminderAt: "2026-03-09T06:15:00Z" }), () => ["X", "Y"]);
  await ready;
  await runCampaign(deps, { now: day("2026-03-23") });
  const digest = sent.find((m) => m.subject.includes("suivi des relances"));
  assert.ok(digest, "digest sent");
  assert.match(digest!.html, /2 document\(s\) manquant\(s\), 2 rappels sans réponse/);
});

test("dueMissingReminder and the automatic staff status", () => {
  assert.equal(dueMissingReminder(submitted({ submittedAt: undefined }), day("2026-04-01")), false);
  assert.equal(nextStaffStatus(undefined, 2), "Documents manquants");
  assert.equal(nextStaffStatus("Nouveau", 0), "Dossier complet");
  assert.equal(nextStaffStatus("Documents manquants", 0), "Dossier complet");
  assert.equal(nextStaffStatus("Dossier complet", 1), "Documents manquants");
  assert.equal(nextStaffStatus("En cours", 0), null, "staff choice kept");
  assert.equal(nextStaffStatus("Clos", 3), null);
  assert.equal(nextStaffStatus("Dossier complet", 0), null);
});
