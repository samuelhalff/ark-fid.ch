import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, apiCaller, uploadInChunks } from "./api-client.ts";
import { fromForm, keyPath, toForm, toName } from "./form-values.ts";
import { collectIssues, issuesFromKeys, stepSchema } from "./issues.ts";
import type { KitBase, KitBlock, KitStrings } from "./kit.ts";
import { segmentBlocks } from "./segments.ts";
import { fill } from "./kit.ts";
import { getField as kycField, validateStep as kycValidateStep } from "../kyc-questionnaire/engine.ts";
import { kycIssueAdapter, kycKit } from "../kyc-questionnaire/kit.ts";
import { STEPS as KYC_STEPS } from "../kyc-questionnaire/schema.ts";
import { KYC_LOCALES } from "../kyc-questionnaire/types.ts";
import { getField as taxField, validateStep as taxValidateStep } from "../tax-questionnaire/logic.ts";
import { taxIssueAdapter, taxKit } from "../tax-questionnaire/kit.ts";
import { STEPS as TAX_STEPS } from "../tax-questionnaire/schema.ts";
import { QF_LOCALES } from "../tax-questionnaire/types.ts";

// The two forms the shared components serve, each with its own kit and issue adapter.
const FORMS = [
  { name: "kyc", locales: KYC_LOCALES as readonly string[], kit: (l: string) => kycKit(l as "fr"), adapter: (l: string) => kycIssueAdapter(l as "fr"), getField: kycField },
  { name: "tax", locales: QF_LOCALES as readonly string[], kit: (l: string) => taxKit(l as "fr"), adapter: (l: string) => taxIssueAdapter(l as "fr"), getField: taxField },
];

const REQUIRED_STRINGS: (keyof KitStrings)[] = ["optional", "yes", "no", "choose", "datePlaceholder", "remove", "noRows", "addRow", "addAnother", "otherPerson", "edit", "showAll", "showLess", "stepOf", "saving", "savedAt", "saveFailed", "missingOne", "missingMany"];

for (const form of FORMS) {
  test(`${form.name}: the kit has every shared string, in each of its languages`, () => {
    for (const locale of form.locales) {
      const kit: KitBase = form.kit(locale);
      assert.equal(kit.locale, locale);
      for (const key of REQUIRED_STRINGS) assert.ok(typeof kit.strings[key] === "string" && (kit.strings[key] as string).trim(), `${form.name}/${locale}: ${key}`);
      assert.match(fill(kit.strings.stepOf, { n: 2, total: 5 }), /2.*5/);
      assert.match(fill(kit.strings.missingMany, { n: 3 }), /3/);
    }
  });

  test(`${form.name}: autofill only on the client's own top-level answers`, () => {
    const kit = form.kit("fr");
    for (const name of Object.keys(kit.autofill)) assert.ok(form.getField(name.replace(/__/g, ".")), `${name} is a top-level field`);
    assert.deepEqual([...new Set(Object.values(kit.autofill))].sort(), ["email", "family-name", "given-name"]);
  });

  test(`${form.name}: text caps and the green check go through the form's own rules`, () => {
    const kit = form.kit("fr");
    assert.equal(kit.maxLength({ id: "x", type: "text", label: { fr: "X" } }), 200);
    assert.equal(kit.maxLength({ id: "x", type: "textarea", label: { fr: "X" } }), 4000);
    assert.equal(kit.maxLength({ id: "x", type: "text", label: { fr: "X" }, maxLength: 40 }), 40);
    const email = { id: "e", type: "email", label: { fr: "E-mail" }, required: true };
    assert.equal(kit.isFilled(email, "a@b.ch"), true);
    assert.equal(kit.isFilled(email, "not an email"), false);
    assert.equal(kit.isFilled({ id: "b", type: "boolean", label: { fr: "B" } }, "yes"), false, "a single checkbox shows its own state");
  });
}

test("form values: dots become __ and back; empty values and empty row fields are dropped", () => {
  const answers = { "a.lastName": "Dupont", "a.blank": "", "a.directors": [{ _id: "r1abcd", lastName: "X", firstName: "" }] };
  const values = toForm(answers);
  assert.deepEqual(Object.keys(values).sort(), ["a__blank", "a__directors", "a__lastName"]);
  assert.deepEqual(fromForm(values), { "a.lastName": "Dupont", "a.directors": [{ _id: "r1abcd", lastName: "X" }] });
});

test("keyPath: top-level, a row (tax) and a nested row (KYC holders); null for a row no longer there", () => {
  assert.deepEqual(keyPath("start.email", {}), ["start__email"]);
  const tax = { "assets.banks": [{ _id: "bank01", bank: "UBS" }, { _id: "bank02" }] };
  assert.deepEqual(keyPath("assets.banks[bank02].bank", tax), ["assets__banks", 1, "bank"]);
  assert.equal(keyPath("assets.banks[gone99].bank", tax), null);
  const kyc = { "b.holders": [{ _id: "hld001", holders: [{ _id: "hld002" }, { _id: "hld003" }] }] };
  assert.deepEqual(keyPath("b.holders[hld001].holders[hld003].percent", kyc), ["b__holders", 0, "holders", 1, "percent"]);
});

test("step schema: the KYC validator's errors land on react-hook-form paths, with the server's route", () => {
  const step = KYC_STEPS.find((s) => s.blocks.some((b) => b.id === "a.directors"))!;
  const values = toForm({ "a.directors": [{ _id: "dir001", lastName: "Dupont" }] });
  const result = stepSchema((a) => kycValidateStep(step, a as never), (code) => `msg:${code}`, { route: "pm-op" }).safeParse(values);
  assert.equal(result.success, false);
  const paths = result.error!.issues.map((i) => i.path.join("."));
  assert.ok(paths.includes("a__directors.0.firstName"), paths.join(", "));
  assert.ok(result.error!.issues.every((i) => i.message.startsWith("msg:")));
});

test("step schema: the tax validator's errors land on react-hook-form paths", () => {
  const step = TAX_STEPS.find((s) => s.blocks.some((b) => b.id === "start.email"))!;
  const result = stepSchema((a) => taxValidateStep(step, a as never), (code) => code).safeParse(toForm({ "start.email": "nope" }));
  assert.equal(result.success, false);
  assert.ok(result.error!.issues.some((i) => i.path.join(".") === "start__email"));
});

test("issues (KYC): a field, a row named « Personne 1 · DUPONT Jean », and the holders tree as one line", () => {
  const adapter = kycIssueAdapter("fr");
  const answers = { route: "pm-op", "a.directors": [{ _id: "dir001", lastName: "Dupont", firstName: "Jean" }] };
  const errors = { a__email: { message: "x" }, a__directors: [{ firstName: { message: "x" } }], b__persons: { message: "x" }, b__managers: { message: "x" } };
  const issues = collectIssues(errors, answers, adapter);
  assert.deepEqual(issues[0], { name: "a__email", label: "E-mail" });
  assert.equal(issues[1].name, "a__directors.0.firstName");
  assert.match(issues[1].label, /\(Personne 1 · DUPONT Jean\)$/);
  assert.equal(issues.filter((i) => i.name === "b__holders").length, 1, "one line for the holders component");
  // Server keys: a row no longer there is dropped; a holders key is worded and points to the component.
  const fromServer = issuesFromKeys(["a.directors[dir001].firstName", "a.directors[gone01].firstName", "a.email"], answers, adapter);
  assert.deepEqual(fromServer.map((i) => i.name), ["a__directors.0.firstName", "a__email"]);
  assert.equal(issuesFromKeys(["b.persons"], answers, adapter)[0].name, "b__holders");
});

test("issues (tax): a row named by its title (« UBS »), else « Banque 2 »; labels in the page's language", () => {
  const answers = { "assets.banks": [{ _id: "bank01", bank: "UBS" }, { _id: "bank02" }] };
  const errors = { "assets__banks": [{ country: { message: "x" } }, { bank: { message: "x" } }] };
  const fr = collectIssues(errors, answers, taxIssueAdapter("fr"));
  assert.deepEqual(fr.map((i) => i.label), ["Pays (UBS)", "Banque / courtier (Banque 2)"]);
  const de = collectIssues(errors, answers, taxIssueAdapter("de"));
  assert.equal(de[1].label, "Bank / Broker (Bank 2)");
  assert.deepEqual(issuesFromKeys(["assets.banks[bank02].bank", "assets.banks[gone01].bank"], answers, taxIssueAdapter("fr")).map((i) => i.name), ["assets__banks.1.bank"]);
  assert.equal(issuesFromKeys([toName("start.email").replace("__", ".")], {}, taxIssueAdapter("en"))[0].label, "Email");
});

test("api caller: per-form path and CSRF/action headers; a refusal carries the server's code and body", async () => {
  const seen: { url: string; headers: Headers }[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    seen.push({ url, headers: new Headers(init.headers) });
    return url.endsWith("bad") ? new Response(JSON.stringify({ error: "not_allowed", why: 1 }), { status: 403 }) : new Response(JSON.stringify({ ok: true }));
  }) as unknown as typeof fetch;
  for (const [base, header] of [["kyc-questionnaire", "x-kqf"], ["tax-questionnaire", "x-tqf"]]) {
    const call = apiCaller(base, header, fake);
    assert.deepEqual(await call("case", { method: "POST", action: "save", body: "{}" }), { ok: true });
    const last = seen.at(-1)!;
    assert.equal(last.url, `/api/${base}/case`);
    assert.equal(last.headers.get(header), "1");
    assert.equal(last.headers.get(`${header}-action`), "save");
    assert.equal(last.headers.get("content-type"), "application/json");
    await assert.rejects(call("bad"), (e: unknown) => e instanceof ApiError && e.code === "not_allowed" && e.status === 403 && e.detail.why === 1);
  }
  const down = apiCaller("kyc-questionnaire", "x-kqf", (async () => { throw new TypeError("offline"); }) as unknown as typeof fetch);
  await assert.rejects(down("case"), (e: unknown) => e instanceof ApiError && e.code === "network");
});

test("chunked upload: Content-Range per chunk, progress, the stored name; a refused chunk fails", async () => {
  const ranges: string[] = [];
  const file = new File([new Uint8Array(10)], "scan.pdf");
  const fake = (async (_url: string, init: RequestInit) => {
    const range = new Headers(init.headers).get("content-range")!;
    ranges.push(range);
    return range.endsWith("9/10") ? new Response(JSON.stringify({ name: "scan (1).pdf", size: 10 }), { status: 201 }) : new Response(null, { status: 202 });
  }) as unknown as typeof fetch;
  const progress: number[] = [];
  const done = await uploadInChunks(file, async () => ({ uploadUrl: "https://upload", chunkBytes: 4 }), (p) => progress.push(p), fake).promise;
  assert.deepEqual(ranges, ["bytes 0-3/10", "bytes 4-7/10", "bytes 8-9/10"]);
  assert.deepEqual(progress, [0.4, 0.8, 1]);
  assert.deepEqual(done, { name: "scan (1).pdf", size: 10 });
  const refused = (async () => new Response(null, { status: 413 })) as unknown as typeof fetch;
  await assert.rejects(uploadInChunks(file, async () => ({ uploadUrl: "https://upload", chunkBytes: 4 }), () => {}, refused).promise, (e: unknown) => e instanceof ApiError && e.code === "upload_failed");
});

test("segments (KYC): a heading followed by prefilled answers becomes their card; others share a grid", () => {
  const step = KYC_STEPS.find((s) => s.blocks.some((b) => b.kind === "heading" && b.prefill))!;
  const blocks = step.blocks as unknown as KitBlock[];
  const heading = blocks.find((b) => b.kind === "heading" && b.prefill)!;
  const after = blocks.slice(blocks.indexOf(heading) + 1);
  const firstField = after.find((b) => b.kind === "field")!;
  const prefilled = new Set([firstField.id]);
  const withRows = segmentBlocks(blocks, (b) => b.kind === "field" && prefilled.has(b.id));
  const card = withRows.find((s) => s.kind === "prefilled");
  assert.ok(card, "a prefilled segment");
  const none = segmentBlocks(blocks, () => false);
  assert.ok(!none.some((s) => s.kind === "prefilled"));
  assert.ok(none.every((s, i) => !(s.kind === "fields" && none[i + 1]?.kind === "fields")), "consecutive questions share one grid");
});

test("segments (tax): every block of every screen lands in exactly one segment", () => {
  for (const step of TAX_STEPS) {
    const blocks = step.blocks as unknown as KitBlock[];
    const segments = segmentBlocks(blocks, () => false);
    const count = segments.reduce((n, s) => n + (s.kind === "fields" || s.kind === "prefilled" ? s.items.length : 1), 0);
    assert.equal(count, blocks.length, step.id);
  }
});
