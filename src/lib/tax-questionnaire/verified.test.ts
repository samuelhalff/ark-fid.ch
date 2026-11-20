import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.TAX_QF_STORAGE = "mock";
process.env.TAX_QF_MOCK_DIR = mkdtempSync(path.join(os.tmpdir(), "tqf-verified-"));
process.env.TAX_QF_TOKEN_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.TAX_QF_API_KEYS = "cadence:tax-secret-tax-secret-tax-secret-0123456";

const { getStorage, MockStorage } = await import("./server/storage.ts");
const service = await import("./server/service.ts");
const { memoryPorts, setPortsForTests } = await import("./server/sharepoint-registry.ts");
const staff = await import("./server/staff.ts");

const YEAR = new Date().getUTCFullYear() - 1;
const mem = memoryPorts();
setPortsForTests(mem.ports);
const storage = getStorage() as InstanceType<typeof MockStorage>;
const deps: import("./server/staff.ts").StaffDeps = {
  campaign: { ...staff.appCampaignDeps(storage), sendMail: async (m) => void storage.sent.push(m) },
  storage,
  ledger: { has: async () => false, add: async () => undefined },
  origin: "https://tax.ark-fid.ch",
  now: () => new Date(),
};
const rowOf = (caseId: string) => mem.returns.find((r) => r.caseId === caseId && r.taxYear === YEAR)!;
const answers = { "start.years": [String(YEAR)], "start.household": "single", "start.canton": "GE" };

test("a partner-invited case is not reported verified and is not adopted by e-mail (S-F1)", async () => {
  const email = "victim@example.ch";
  const partner = await service.createCase(storage, { identity: { email, firstName: "Vic", lastName: "Tim" }, locale: "fr", answers, source: "partner" });
  assert.equal(staff.summarize(rowOf(partner.caseId)).emailVerified, false);
  const input = { clientRef: "res.partner:901", firstName: "Vic", lastName: "Tim", email, language: "fr", canton: "GE", taxYear: YEAR, sendInvitation: false };
  const created = await staff.createReturn(input, { idempotencyKey: "verified-0001" }, deps);
  assert.equal(created.adopted, false, "the unverified case is not adopted");
  assert.equal(created.created, true);
  assert.notEqual(created.summary.caseId, partner.caseId);
});

test("the e-mailed code sets the flag; a verified case is adopted and reported verified (S-F1)", async () => {
  const email = "owner@example.ch";
  const web = await service.createCase(storage, { identity: { email, firstName: "Ola", lastName: "Owner" }, locale: "fr", answers, source: "web", emailVerified: true });
  assert.equal(rowOf(web.caseId).emailVerified, true);
  assert.equal(staff.summarize(rowOf(web.caseId)).emailVerified, true);
  const invited = await service.createCase(storage, { identity: { email: "guest@example.ch", firstName: "Gus", lastName: "Guest" }, locale: "fr", answers, source: "partner" });
  assert.equal(staff.summarize(rowOf(invited.caseId)).emailVerified, false);
  await service.markEmailVerified(await service.getCase(invited.caseId));
  assert.equal(staff.summarize(rowOf(invited.caseId)).emailVerified, true, "link code returned: verified");
  const input = { clientRef: "res.partner:902", firstName: "Gus", lastName: "Guest", email: "guest@example.ch", language: "fr", canton: "GE", taxYear: YEAR, sendInvitation: false };
  const created = await staff.createReturn(input, { idempotencyKey: "verified-0002" }, deps);
  assert.equal(created.adopted, true);
});
