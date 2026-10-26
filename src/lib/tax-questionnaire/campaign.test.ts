import assert from "node:assert/strict";
import test from "node:test";

import { dueReminder, emailHashOf, runCampaign, type CampaignDeps, type InvitedReturnInput } from "./server/campaign.ts";
import type { ClientPreferences, ReturnRecord } from "./server/ports.ts";
import { clientKey } from "./server/service.ts";
import type { MailMessage } from "./server/storage.ts";

type Client = { id: string; email: string; lastName: string; firstName: string };

function setup(clients: Client[], prefsList: ClientPreferences[] = [], returns: ReturnRecord[] = []) {
  const sent: MailMessage[] = [];
  const prefs = new Map(prefsList.map((p) => [p.clientKey, p]));
  const tracker = new Map(returns.map((r) => [r.caseId, r]));
  const ledger = new Set<string>();
  let seq = 0;
  const deps: CampaignDeps = {
    registry: {
      match: async () => ({ status: "none" }),
      recordTaxClient: async () => null,
      listTaxClients: async () => clients,
    },
    tracker: {
      upsert: async (r) => {
        tracker.set(r.caseId, { ...r });
        return r.caseId;
      },
      findByCase: async (id) => [...tracker.values()].filter((r) => r.caseId === id),
      findByEmailHash: async (h) => [...tracker.values()].filter((r) => r.emailHash === h),
      findByClientKey: async (k) => [...tracker.values()].filter((r) => r.clientKey === k),
      listByYear: async (y) => [...tracker.values()].filter((r) => r.taxYear === y),
    },
    prefs: {
      get: async (k) => prefs.get(k) || null,
      upsert: async (p) => void prefs.set(p.clientKey, { ...p }),
      listOptedIn: async () => [...prefs.values()].filter((p) => p.optIn),
    },
    sendMail: async (m) => void sent.push(m),
    issueLink: async (o) => `https://tax.ark-fid.ch/r/${o.purpose}-${o.caseId.length}`,
    createInvitedReturn: async (input: InvitedReturnInput) => {
      const record: ReturnRecord = {
        caseId: `case${++seq}`,
        householdId: `hh${seq}`,
        clientKey: input.clientKey,
        emailHash: emailHashOf(input.email),
        name: input.name,
        email: input.email,
        language: input.language,
        canton: input.prefillFrom?.canton || "GE",
        taxYear: input.taxYear,
        state: "invited",
        regime: input.prefillFrom?.regime || "",
        optIn: false,
        aiOptIn: false,
        driveId: "d",
        folderId: `f${seq}`,
        folderUrl: "",
      };
      tracker.set(record.caseId, record);
      return record;
    },
    staffRecipients: ["samuel.halff@ark-fid.ch"],
    ledger: { has: async (k) => ledger.has(k), add: async (k) => void ledger.add(k) },
  };
  return { deps, sent, prefs, tracker };
}

const alice: Client = { id: "1", email: "alice@example.ch", lastName: "Martin", firstName: "Alice" };
const bob: Client = { id: "2", email: "bob@example.ch", lastName: "Dupont", firstName: "Bob" };
const aliceKey = clientKey(alice.email, alice.lastName, alice.firstName);
const at = (iso: string) => new Date(`${iso}T06:15:00Z`);

function previousReturn(key: string, canton = "GE"): ReturnRecord {
  return {
    caseId: "old",
    householdId: "hh0",
    clientKey: key,
    emailHash: emailHashOf(alice.email),
    name: "MARTIN Alice",
    email: alice.email,
    language: "fr",
    canton,
    taxYear: 2024,
    state: "submitted",
    regime: "En Suisse toute l'année",
    optIn: true,
    aiOptIn: false,
    driveId: "d",
    folderId: "old",
    folderUrl: "",
  };
}

test("January: advance notice once, only to clients who never used the questionnaire", async () => {
  const { deps, sent, prefs } = setup([alice, bob], [], [{ ...previousReturn(clientKey(bob.email, bob.lastName, bob.firstName)), email: bob.email }]);
  const early = await runCampaign(deps, { now: at("2026-01-03") });
  assert.equal(early.notices, 0);
  const first = await runCampaign(deps, { now: at("2026-01-10") });
  assert.equal(first.notices, 1);
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].to, [alice.email]);
  assert.match(sent[0].html, /optout/);
  assert.equal(prefs.get(aliceKey)?.noticeSentYear, 2026);
  const rerun = await runCampaign(deps, { now: at("2026-01-10") });
  assert.equal(rerun.notices, 0);
  assert.equal(sent.length, 1);
});

test("1 February invitation, prefilled from last year; same-day rerun sends nothing", async () => {
  const { deps, sent, tracker } = setup([alice], [], [previousReturn(aliceKey, "VD")]);
  const r = await runCampaign(deps, { now: at("2026-02-01") });
  assert.equal(r.invitations, 1);
  const invited = [...tracker.values()].find((x) => x.taxYear === 2025)!;
  assert.equal(invited.state, "invited");
  assert.equal(invited.canton, "VD");
  assert.equal(invited.invitedAt, at("2026-02-01").toISOString());
  assert.match(sent[0].subject, /2025/);
  assert.match(sent[0].html, /invitation/);
  const again = await runCampaign(deps, { now: at("2026-02-01") });
  assert.equal(again.invitations + again.reminders, 0);
  assert.equal(sent.length, 1);
});

test("reminders: +14 days, D-30, D-10, then stop after the deadline; reruns idempotent", async () => {
  const { deps, sent } = setup([alice]);
  await runCampaign(deps, { now: at("2026-02-01") }); // invitation, GE → stop 31.03.2026
  assert.equal((await runCampaign(deps, { now: at("2026-02-14") })).reminders, 0);
  assert.equal((await runCampaign(deps, { now: at("2026-02-15") })).reminders, 1);
  assert.equal((await runCampaign(deps, { now: at("2026-02-15") })).reminders, 0); // same day
  assert.equal((await runCampaign(deps, { now: at("2026-02-16") })).reminders, 0);
  const d30 = await runCampaign(deps, { now: at("2026-03-01") });
  assert.equal(d30.reminders, 1);
  assert.ok(d30.escalations >= 1, "staff digest at D-30");
  assert.equal((await runCampaign(deps, { now: at("2026-03-01") })).escalations, 0, "digest once per day");
  const d10 = await runCampaign(deps, { now: at("2026-03-21") });
  assert.equal(d10.reminders, 1);
  assert.equal((await runCampaign(deps, { now: at("2026-04-02") })).reminders, 0);
  const reminders = sent.filter((m) => /Rappel/.test(m.subject));
  assert.equal(reminders.length, 3);
});

test("submitted, declined or closed returns stop the reminders", async () => {
  const { deps, tracker } = setup([alice]);
  await runCampaign(deps, { now: at("2026-02-01") });
  const rec = [...tracker.values()][0];
  tracker.set(rec.caseId, { ...rec, state: "submitted" });
  assert.equal((await runCampaign(deps, { now: at("2026-02-15") })).reminders, 0);
  tracker.set(rec.caseId, { ...rec, state: "invited", staffStatus: "Clos" });
  assert.equal((await runCampaign(deps, { now: at("2026-02-15") })).reminders, 0);
});

test("excluded clients are skipped; opted-in prospects are included", async () => {
  const prospect: ClientPreferences = { clientKey: "pk1", email: "p@example.ch", name: "DOE Jane", language: "en", optIn: true, excluded: false };
  const excluded: ClientPreferences = { clientKey: aliceKey, email: alice.email, name: "MARTIN Alice", language: "fr", optIn: false, excluded: true };
  const { deps, sent } = setup([alice], [prospect, excluded]);
  const r = await runCampaign(deps, { now: at("2026-02-01") });
  assert.equal(r.invitations, 1);
  assert.deepEqual(sent[0].to, ["p@example.ch"]);
  assert.match(sent[0].subject, /Your 2025 tax questionnaire/);
});

test("dry run sends and writes nothing; maxActions caps the run", async () => {
  const { deps, sent, tracker } = setup([alice, bob]);
  const dry = await runCampaign(deps, { now: at("2026-02-01"), dryRun: true });
  assert.equal(dry.invitations, 2);
  assert.equal(sent.length, 0);
  assert.equal(tracker.size, 0);
  const capped = await runCampaign(deps, { now: at("2026-02-01"), maxActions: 1 });
  assert.equal(capped.invitations, 1);
  assert.equal(capped.skipped, 1);
});

test("dueReminder respects the three-day gap after a late invitation", () => {
  const rec = { ...previousReturn("k"), state: "invited" as const, taxYear: 2025, invitedAt: at("2026-03-05").toISOString(), remindersSent: 0 };
  const stop = new Date(Date.UTC(2026, 2, 31));
  assert.equal(dueReminder(rec, stop, at("2026-03-06")), null);
  assert.equal(dueReminder(rec, stop, at("2026-03-08")), "d30");
});
