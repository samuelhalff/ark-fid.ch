import assert from "node:assert/strict";
import test from "node:test";

import { dueReminder, emailHashOf, knownClientKey, runCampaign, type CampaignDeps, type InvitedReturnInput } from "./server/campaign.ts";
import type { ClientPreferences, ReturnRecord } from "./server/ports.ts";
import { clientKey } from "./server/service.ts";
import type { MailMessage } from "./server/storage.ts";

type Client = { id: string; email: string; lastName: string; firstName: string; clientRef?: string; language?: string };

function setup(clients: Client[], prefsList: ClientPreferences[] = [], returns: ReturnRecord[] = []) {
  const sent: MailMessage[] = [];
  const prefs = new Map(prefsList.map((p) => [p.clientKey, p]));
  const tracker = new Map(returns.map((r) => [r.caseId, r]));
  const ledger = new Set<string>();
  let seq = 0;
  const years: number[] = [];
  const deps: CampaignDeps = {
    registry: {
      match: async () => ({ status: "none" }),
      recordTaxClient: async () => null,
      listTaxClients: async (year: number) => {
        years.push(year);
        return clients;
      },
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
        ...(input.clientRef ? { clientRef: input.clientRef } : {}),
      };
      tracker.set(record.caseId, record);
      return record;
    },
    staffRecipients: ["samuel.halff@ark-fid.ch"],
    ledger: { has: async (k) => ledger.has(k), add: async (k) => void ledger.add(k) },
  };
  return { deps, sent, prefs, tracker, years };
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

test("Cadence's list: asked for the tax year, its client reference and language reach the return", async () => {
  const carol: Client = { id: "odoo:42", email: "carol@example.ch", lastName: "Keller", firstName: "Carol", clientRef: "odoo:42", language: "de" };
  const { deps, sent, tracker, years } = setup([carol]);
  await runCampaign(deps, { now: at("2027-02-01") });
  assert.deepEqual(years, [2026]);
  const created = [...tracker.values()].find((r) => r.email === carol.email);
  assert.equal(created?.clientRef, "odoo:42");
  assert.equal(created?.language, "de");
  assert.equal(sent.length, 1);
});

test("a list the registry cannot give stops the run before any mail", async () => {
  const { deps, sent } = setup([alice]);
  deps.registry.listTaxClients = async () => {
    throw new Error("client_list_unavailable:unreachable");
  };
  await assert.rejects(runCampaign(deps, { now: at("2027-02-01") }), /client_list_unavailable/);
  assert.equal(sent.length, 0);
});

test("Cadence's person keeps last year's client key whatever the spelling: no second return, the opt-out holds", async () => {
  // Last year's return was written from the CRM as « MARTIN Alice »; Cadence spells her « Martin-Dubois Alice ».
  const odooAlice: Client = { ...alice, lastName: "Martin-Dubois", clientRef: "odoo:7" };
  const last = { ...previousReturn(aliceKey), taxYear: 2025, state: "submitted" as const, submittedAt: "2026-03-01T00:00:00Z" };
  const { deps, sent, tracker } = setup([odooAlice], [], [last]);
  await runCampaign(deps, { now: at("2027-02-01") });
  const mine = [...tracker.values()].filter((r) => r.taxYear === 2026);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].clientKey, aliceKey, "the same client, not a new one");
  assert.equal(sent.length, 1);

  const excluded = setup([odooAlice], [{ clientKey: aliceKey, email: alice.email, name: "MARTIN Alice", language: "fr", optIn: false, excluded: true }], [last]);
  await runCampaign(excluded.deps, { now: at("2027-02-01") });
  assert.equal(excluded.sent.length, 0, "her opt-out is under the old key");
});

test("a spouse covered by the household's return of the year is not invited alone", async () => {
  const spouse: Client = { id: "odoo:9", email: "paul@example.ch", lastName: "Martin", firstName: "Paul", clientRef: "odoo:9" };
  const household = { ...previousReturn(aliceKey), caseId: "hh", taxYear: 2026, state: "invited" as const, invitedAt: "2027-02-01T06:00:00Z", spouseRef: "odoo:9" };
  const { deps, sent } = setup([spouse], [], [household]);
  await runCampaign(deps, { now: at("2027-02-01") });
  assert.equal(sent.length, 0);
});

test("an e-mail shared by several family members names no client key", () => {
  const a = { ...previousReturn("k1"), clientKey: "k1" };
  const b = { ...previousReturn("k2"), caseId: "other", clientKey: "k2" };
  assert.equal(knownClientKey([a, b], "odoo:1", alice.email), null);
  assert.equal(knownClientKey([a], "odoo:1", alice.email), "k1");
  assert.equal(knownClientKey([a, { ...b, clientRef: "odoo:1" }], "odoo:1", alice.email), "k2");
});
