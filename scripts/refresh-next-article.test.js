"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  claimNext,
  refreshClaimed,
  finalize,
  pickStaleSlug,
  evaluateSteps,
  MAX_ATTEMPTS,
} = require("./refresh-next-article");

const NOW = new Date("2026-10-24T00:00:00Z");
const log = () => {};
const OK_STEPS = Object.fromEntries(["refresh", "links", "sources", "facts", "validate"].map((k) => [k, { outcome: "success" }]));

function env(queue) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rq-"));
  const queueFile = path.join(dir, "q.json");
  const statusFile = path.join(dir, "status.json");
  fs.writeFileSync(queueFile, JSON.stringify(queue));
  return { dir, queueFile, statusFile };
}
const readQ = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

/** Fake git: records calls; `checkout -- f` restores f from a snapshot. */
function fakeGit({ changed = [], pushResults = [true], revs = ["a", "a"], rebaseOk = true, snapshot = {} } = {}) {
  const calls = [];
  const pushes = [...pushResults];
  const revQueue = [...revs];
  const git = (args) => {
    calls.push(args);
    const [cmd] = args;
    if (cmd === "diff" && args.includes("--name-only")) return { ok: true, stdout: changed.join("\n"), stderr: "" };
    if (cmd === "diff") return { ok: false, stdout: "", stderr: "" }; // staged changes exist
    if (cmd === "rev-parse") return { ok: true, stdout: revQueue.shift() ?? "a", stderr: "" };
    if (cmd === "rebase" && args[1] !== "--abort") return { ok: rebaseOk, stdout: "", stderr: "" };
    if (cmd === "push") return { ok: pushes.length ? pushes.shift() : true, stdout: "", stderr: "" };
    if (cmd === "checkout") {
      const f = args[2];
      if (snapshot[f] !== undefined) fs.writeFileSync(f, snapshot[f]);
    }
    return { ok: true, stdout: "", stderr: "" };
  };
  git.calls = calls;
  return git;
}
const cmds = (git, name) => git.calls.filter((c) => c[0] === name);

test("claim keeps slug in queue, bumps attempts, writes status", () => {
  const e = env({ queue: ["a", "b"], done: [], failed: [] });
  const r = claimNext({ ...e, articles: [], now: NOW, log });
  assert.deepEqual(r, { status: "claimed", slug: "a", attempt: 1 });
  const q = readQ(e.queueFile);
  assert.deepEqual(q.queue, ["a", "b"]);
  assert.deepEqual(q.attempts, { a: 1 });
  assert.equal(readQ(e.statusFile).phase, "claimed");
});

test("attempts cap: slug at limit is marked failed, next slug claimed", () => {
  const e = env({ queue: ["a", "b"], done: [], failed: [], attempts: { a: MAX_ATTEMPTS } });
  const r = claimNext({ ...e, articles: [], now: NOW, log });
  assert.equal(r.slug, "b");
  const q = readQ(e.queueFile);
  assert.deepEqual(q.queue, ["b"]);
  assert.equal(q.failed[0].slug, "a");
  assert.match(q.failed[0].reason, /attempt limit/);
  assert.equal(q.attempts.a, undefined);
});

test("two claims in a row then a third never retries the slug", () => {
  const e = env({ queue: ["a"], done: [], failed: [] });
  claimNext({ ...e, articles: [], now: NOW, log });
  claimNext({ ...e, articles: [], now: NOW, log });
  const r = claimNext({ ...e, articles: [{ slug: "fresh", date: "2026-05-01" }], now: NOW, log });
  assert.equal(r.status, "empty");
  assert.equal(readQ(e.queueFile).failed[0].slug, "a");
});

test("empty queue and nothing stale: no claim, no status file", () => {
  const e = env({ queue: [], done: [], failed: [] });
  const r = claimNext({ ...e, articles: [{ slug: "fresh", date: "2026-05-01" }], now: NOW, log });
  assert.equal(r.status, "empty");
  assert.equal(fs.existsSync(e.statusFile), false);
});

test("empty queue auto-fills with oldest stale article, skipping failed", () => {
  const e = env({ queue: [], done: [], failed: [{ slug: "old1", date: "2026-01-01", reason: "x" }] });
  const articles = [
    { slug: "old1", date: "2023-01-01" },
    { slug: "old2", date: "2024-03-01" },
    { slug: "upd", date: "2022-01-01", updated: "2026-06-01" },
    { slug: "old3", date: "2024-01-01" },
  ];
  assert.equal(claimNext({ ...e, articles, now: NOW, log }).slug, "old3");
});

test("pickStaleSlug uses updated over date and 12 month cutoff", () => {
  const st = { queue: [], failed: [] };
  assert.equal(pickStaleSlug([{ slug: "a", date: "2025-10-25" }], st, NOW), null);
  assert.equal(pickStaleSlug([{ slug: "a", date: "2025-10-23" }], st, NOW), "a");
  assert.equal(pickStaleSlug([{ slug: "a", date: "2020-01-01", updated: "2026-01-01" }], st, NOW), null);
});

test("refreshClaimed records result in status file and leaves the queue alone", () => {
  const e = env({ queue: ["a"], done: [], failed: [] });
  claimNext({ ...e, articles: [], now: NOW, log });
  const before = fs.readFileSync(e.queueFile, "utf8");
  assert.equal(refreshClaimed({ statusFile: e.statusFile, refresh: () => ({ ok: true }), log }).phase, "refreshed");
  assert.equal(fs.readFileSync(e.queueFile, "utf8"), before);
  const bad = refreshClaimed({ statusFile: e.statusFile, refresh: () => ({ ok: false, reason: "boom" }), log });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "boom");
  const thrown = refreshClaimed({ statusFile: e.statusFile, refresh: () => { throw new Error("x"); }, log });
  assert.equal(thrown.phase, "refresh-failed");
});

test("evaluateSteps: any non-success or missing step fails", () => {
  assert.equal(evaluateSteps(OK_STEPS).ok, true);
  assert.match(evaluateSteps({ ...OK_STEPS, facts: { outcome: "failure" } }).reason, /facts: failure/);
  assert.match(evaluateSteps({ ...OK_STEPS, validate: { outcome: "skipped" } }).reason, /validate: skipped/);
  assert.match(evaluateSteps({ refresh: { outcome: "cancelled" } }).reason, /refresh: cancelled/);
});

function claimedEnv() {
  const e = env({ queue: ["a", "b"], done: [], failed: [] });
  claimNext({ ...e, articles: [], now: NOW, log });
  refreshClaimed({ statusFile: e.statusFile, refresh: () => ({ ok: true }), log });
  const tr = path.join(e.dir, "fr.json");
  fs.writeFileSync(tr, "REFRESHED");
  return { ...e, tr };
}

test("finalize success: marks done, keeps translations, commits them with the queue", () => {
  const e = claimedEnv();
  const git = fakeGit({ changed: [e.tr], snapshot: { [e.tr]: "ORIGINAL" } });
  const r = finalize({ ...e, steps: OK_STEPS, now: NOW, git, validate: () => ({ ok: true }), log });
  assert.deepEqual(r, { status: "done", slug: "a" });
  assert.equal(fs.readFileSync(e.tr, "utf8"), "REFRESHED");
  assert.equal(cmds(git, "checkout").length, 0);
  const q = readQ(e.queueFile);
  assert.deepEqual(q.queue, ["b"]);
  assert.deepEqual(q.done, [{ slug: "a", date: "2026-10-24" }]);
  assert.equal(q.attempts, undefined);
  const add = cmds(git, "add")[0];
  assert.ok(add.some((f) => f.endsWith("fr/ressources.json")) && add.includes("data/refresh-queue.json"));
  assert.equal(cmds(git, "push").length, 1);
});

test("finalize failure: restores files, marks failed with reason, never requeues, commits queue only", () => {
  const e = claimedEnv();
  const git = fakeGit({ changed: [e.tr, "data/refresh-queue.json", ".claude/x"], snapshot: { [e.tr]: "ORIGINAL" } });
  const steps = { ...OK_STEPS, facts: { outcome: "failure" }, validate: { outcome: "skipped" } };
  const r = finalize({ ...e, steps, now: NOW, git, validate: () => ({ ok: true }), log });
  assert.equal(r.status, "failed");
  assert.match(r.reason, /step facts: failure/);
  assert.equal(fs.readFileSync(e.tr, "utf8"), "ORIGINAL");
  assert.deepEqual(cmds(git, "checkout").map((c) => c[2]), [e.tr]);
  const q = readQ(e.queueFile);
  assert.deepEqual(q.queue, ["b"]);
  assert.equal(q.failed[0].slug, "a");
  assert.match(q.failed[0].reason, /facts/);
  assert.deepEqual(cmds(git, "add")[0], ["add", "--", "data/refresh-queue.json"]);
});

test("finalize after timeout (status still 'claimed'): failed, restored", () => {
  const e = env({ queue: ["a"], done: [], failed: [] });
  claimNext({ ...e, articles: [], now: NOW, log });
  const git = fakeGit({ changed: ["src/translations/fr/ressources.json"] });
  const r = finalize({ ...e, steps: { refresh: { outcome: "cancelled" } }, now: NOW, git, log });
  assert.equal(r.status, "failed");
  assert.match(r.reason, /timed out or cancelled/);
  assert.equal(readQ(e.queueFile).queue.length, 0);
});

test("finalize with nothing claimed is a no-op", () => {
  const e = env({ queue: [], done: [], failed: [] });
  assert.equal(finalize({ ...e, steps: {}, git: fakeGit(), log }).status, "none");
});

test("push retried (bounded), succeeds on 3rd try", () => {
  const e = claimedEnv();
  const git = fakeGit({ pushResults: [false, false, true] });
  const r = finalize({ ...e, steps: OK_STEPS, now: NOW, git, validate: () => ({ ok: true }), log });
  assert.equal(r.status, "done");
  assert.equal(cmds(git, "push").length, 3);
});

test("push failing 3 times: push-failed, never more than 3 pushes", () => {
  const e = claimedEnv();
  const git = fakeGit({ pushResults: [false, false, false, false] });
  const r = finalize({ ...e, steps: OK_STEPS, now: NOW, git, validate: () => ({ ok: true }), log });
  assert.equal(r.status, "push-failed");
  assert.equal(cmds(git, "push").length, 3);
});

test("after a rebase that moved upstream the slug validator re-runs; failure turns into failed", () => {
  const e = claimedEnv();
  let validated = 0;
  // before HEAD~1 = a, after rebase HEAD~1 = b (upstream moved)
  const git = fakeGit({ revs: ["a", "b"] });
  const r = finalize({
    ...e,
    steps: OK_STEPS,
    now: NOW,
    git,
    validate: () => (validated++, { ok: false, reason: "bad link" }),
    log,
  });
  assert.equal(validated, 1);
  assert.equal(r.status, "failed");
  assert.match(r.reason, /validation after rebase/);
  assert.equal(cmds(git, "reset").length, 1);
  assert.equal(readQ(e.queueFile).failed[0].slug, "a");
});

test("validator not re-run when the rebase did not move upstream", () => {
  const e = claimedEnv();
  let validated = 0;
  const git = fakeGit({ revs: ["a", "a"] });
  finalize({ ...e, steps: OK_STEPS, now: NOW, git, validate: () => (validated++, { ok: true }), log });
  assert.equal(validated, 0);
});

test("finalize failure reason includes the last 10 lines of the failing step log, capped at 500 chars", () => {
  const e = claimedEnv();
  const logDir = path.join(e.dir, "logs");
  fs.mkdirSync(logDir);
  const lines = Array.from({ length: 30 }, (_, i) => `line ${i} ${"x".repeat(80)}`);
  fs.writeFileSync(path.join(logDir, "validate.log"), lines.join("\n") + "\n");
  const git = fakeGit({ changed: [] });
  const steps = { ...OK_STEPS, validate: { outcome: "failure" } };
  const r = finalize({ ...e, steps, logDir, now: NOW, git, log });
  assert.equal(r.status, "failed");
  assert.match(r.reason, /^step validate: failure - /);
  assert.match(r.reason, /line 29/);
  assert.doesNotMatch(r.reason, /line 5 /);
  assert.ok(r.reason.length <= "step validate: failure - ".length + 500);
  assert.equal(readQ(e.queueFile).failed[0].reason, r.reason);
});

test("tailLog keeps only the last 10 lines and tolerates a missing log", () => {
  const { tailLog } = require("./refresh-next-article");
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "tl-")), "a.log");
  fs.writeFileSync(f, Array.from({ length: 15 }, (_, i) => `L${i}`).join("\n"));
  assert.equal(tailLog(f), "L5 | L6 | L7 | L8 | L9 | L10 | L11 | L12 | L13 | L14");
  assert.equal(tailLog(f + ".missing"), "");
  assert.equal(evaluateSteps({ refresh: { outcome: "failure" } }, ["refresh"], path.dirname(f)).reason, "step refresh: failure");
});

test("bookkeeping commits carry [skip ci]; the success commit does not", () => {
  const msg = (git) => cmds(git, "commit").map((c) => c[c.indexOf("-m") + 1]);
  // success
  let e = claimedEnv();
  let git = fakeGit({ changed: [] });
  finalize({ ...e, steps: OK_STEPS, now: NOW, git, validate: () => ({ ok: true }), log });
  assert.equal(msg(git).length, 1);
  assert.doesNotMatch(msg(git)[0], /skip ci/);
  // queue-only failure
  e = claimedEnv();
  git = fakeGit({ changed: [] });
  finalize({ ...e, steps: { ...OK_STEPS, facts: { outcome: "failure" } }, now: NOW, git, log });
  assert.match(msg(git)[0], /\[skip ci\]/);
  // post-rebase validation failure ends in a queue-only commit too
  e = claimedEnv();
  git = fakeGit({ changed: [], revs: ["a", "b"] });
  finalize({ ...e, steps: OK_STEPS, now: NOW, git, validate: () => ({ ok: false, reason: "x" }), log });
  const m = msg(git);
  assert.doesNotMatch(m[0], /skip ci/);
  assert.match(m[m.length - 1], /\[skip ci\]/);
});

test("claim commit message includes [skip ci]", () => {
  const src = fs.readFileSync(path.join(__dirname, "refresh-next-article.js"), "utf8");
  assert.match(src, /claim refresh of \$\{out\.slug\}[^\n]*\$\{SKIP_CI\}/);
});
