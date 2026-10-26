#!/usr/bin/env node
"use strict";
/**
 * Autonomous refresh of existing articles, driven by data/refresh-queue.json.
 * Every run must end in a committed, terminal queue state (done or failed).
 *
 *   --claim     pick the head of the queue (auto-fill with the oldest article older than
 *               12 months when empty), bump its `attempts` counter, write .refresh-run.json
 *               and commit+push the queue so the attempt survives a killed job.
 *               A slug already attempted MAX_ATTEMPTS times is marked failed instead.
 *   --refresh   run ai-ressources-update.js --refresh=<slug> --apply; records the result in
 *               .refresh-run.json. Never touches the queue (the entry stays "in progress").
 *   --finalize  (run with `if: always()`) all steps ok -> mark done, keep translations;
 *               otherwise restore the touched files and mark failed (never re-queued).
 *               Commits + pushes with a bounded fetch/rebase/push loop.
 *
 * Step outcomes reach --finalize via STEPS_JSON (`${{ toJSON(steps) }}`).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { isDataReportArticle } = require("./lib/articleTopicGuardrails");

const ROOT = path.resolve(__dirname, "..");
const QUEUE_REL = "data/refresh-queue.json";
const QUEUE_PATH = path.join(ROOT, QUEUE_REL);
const STATUS_PATH = path.join(ROOT, ".refresh-run.json");
const FR_PATH = path.join(ROOT, "src", "translations", "fr", "ressources.json");
const UPDATE_SCRIPT = path.join(__dirname, "ai-ressources-update.js");
const LOCALES = ["fr", "en", "de", "es", "pt"];
const TRANSLATION_FILES = LOCALES.map((l) => `src/translations/${l}/ressources.json`);
const STALE_MONTHS = 12;
const MAX_ATTEMPTS = 2;
const MAX_PUSH_TRIES = 3;
// Workflow step ids that must all succeed, in order.
const LOG_DIR = process.env.REFRESH_LOG_DIR || path.join(ROOT, ".refresh-logs");
const LOG_TAIL_LINES = 10;
const LOG_TAIL_CHARS = 500;
// "[skip ci]" keeps bookkeeping commits from triggering push workflows (IndexNow, ...).
// The success commit carries translations and must NOT have it so the deploy runs.
const SKIP_CI = "[skip ci]";
const STEP_ORDER = ["refresh", "links", "sources", "facts", "validate"];
const AUTHOR = "samuelhalff <660062+samuelhalff@users.noreply.github.com>";

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function normalizeQueue(raw) {
  const q = raw && typeof raw === "object" ? raw : {};
  return {
    queue: Array.isArray(q.queue) ? q.queue : [],
    done: Array.isArray(q.done) ? q.done : [],
    failed: Array.isArray(q.failed) ? q.failed : [],
    attempts: q.attempts && typeof q.attempts === "object" && !Array.isArray(q.attempts) ? q.attempts : {},
  };
}

function readQueue(file = QUEUE_PATH) {
  try {
    return normalizeQueue(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (e) {
    if (e.code === "ENOENT") return normalizeQueue(null);
    throw e;
  }
}

function writeQueue(state, file = QUEUE_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const out = { ...state };
  if (!Object.keys(out.attempts || {}).length) delete out.attempts;
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
}

function readStatus(file = STATUS_PATH) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function writeStatus(status, file = STATUS_PATH) {
  fs.writeFileSync(file, JSON.stringify(status, null, 2) + "\n");
}

/** Oldest article by (updated ?? date), older than STALE_MONTHS, not queued/failed. */
function pickStaleSlug(articles, state, now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - STALE_MONTHS);
  const skip = new Set([...state.queue, ...state.failed.map((f) => f.slug)]);
  const candidates = (articles || [])
    .filter((a) => a && a.slug && !skip.has(a.slug) && !isDataReportArticle(a))
    .map((a) => ({ slug: a.slug, when: new Date(a.updated || a.date || "") }))
    .filter((a) => !Number.isNaN(a.when.getTime()) && a.when < cutoff)
    .sort((a, b) => a.when - b.when);
  return candidates.length ? candidates[0].slug : null;
}

function markFailed(state, slug, date, reason) {
  state.queue = state.queue.filter((s) => s !== slug);
  state.done = state.done.filter((d) => d.slug !== slug);
  state.failed = state.failed.filter((f) => f.slug !== slug);
  state.failed.push({ slug, date, reason: String(reason || "unknown").slice(0, 700) });
  delete state.attempts[slug];
}

function markDone(state, slug, date) {
  state.queue = state.queue.filter((s) => s !== slug);
  state.failed = state.failed.filter((f) => f.slug !== slug);
  state.done = state.done.filter((d) => d.slug !== slug);
  state.done.push({ slug, date });
  delete state.attempts[slug];
}

/**
 * Pick the next slug and persist the attempt. Over-limit slugs become failed.
 * @returns {{status: "empty"|"claimed", slug?: string, attempt?: number}}
 */
function claimNext({
  queueFile = QUEUE_PATH,
  statusFile = STATUS_PATH,
  articles,
  now = new Date(),
  log = console.log,
} = {}) {
  const state = readQueue(queueFile);
  const date = isoDay(now);
  let claimed = null;
  for (let guard = 0; guard < 1000; guard++) {
    if (!state.queue.length) {
      const list = articles ?? JSON.parse(fs.readFileSync(FR_PATH, "utf8")).Articles;
      const stale = pickStaleSlug(list, state, now);
      if (!stale) break;
      log(`Queue empty: auto-filling with oldest stale article ${stale}`);
      state.queue.push(stale);
    }
    const slug = state.queue[0];
    if (state.failed.some((f) => f.slug === slug)) {
      // already failed: drop it from the queue, never re-run
      state.queue.shift();
      continue;
    }
    const n = Number(state.attempts[slug] || 0);
    if (n >= MAX_ATTEMPTS) {
      log(`${slug}: attempt limit (${MAX_ATTEMPTS}) reached, marking failed`);
      markFailed(state, slug, date, `attempt limit reached (${MAX_ATTEMPTS})`);
      continue;
    }
    state.attempts[slug] = n + 1;
    claimed = { slug, attempt: n + 1 };
    break;
  }
  writeQueue(state, queueFile);
  if (!claimed) {
    log("Nothing to do: refresh queue is empty and no article is older than 12 months.");
    try {
      fs.rmSync(statusFile, { force: true });
    } catch {}
    return { status: "empty" };
  }
  writeStatus({ slug: claimed.slug, phase: "claimed", ok: false, attempt: claimed.attempt, reason: "refresh not completed" }, statusFile);
  log(`Claimed ${claimed.slug} (attempt ${claimed.attempt}/${MAX_ATTEMPTS})`);
  return { status: "claimed", ...claimed };
}

function runRefresh(slug) {
  const res = spawnSync(process.execPath, [UPDATE_SCRIPT, `--refresh=${slug}`, "--apply"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  if (res.status === 0) return { ok: true };
  const text = (res.stderr || res.stdout || res.error?.message || "").trim();
  const lines = text.split("\n").filter(Boolean);
  return { ok: false, reason: (lines[lines.length - 1] || `exit ${res.status}`).slice(0, 500) };
}

/** Runs the refresh for the claimed slug and records the outcome in the status file. */
function refreshClaimed({ statusFile = STATUS_PATH, refresh = runRefresh, log = console.log } = {}) {
  const status = readStatus(statusFile);
  if (!status?.slug) throw new Error("no claimed slug (.refresh-run.json missing)");
  log(`Refreshing ${status.slug}`);
  let result;
  try {
    result = refresh(status.slug);
  } catch (e) {
    result = { ok: false, reason: String(e?.message || e).slice(0, 500) };
  }
  const next = result.ok
    ? { ...status, phase: "refreshed", ok: true, reason: "" }
    : { ...status, phase: "refresh-failed", ok: false, reason: result.reason || "unknown" };
  writeStatus(next, statusFile);
  return next;
}

function defaultGit(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, stdout: (r.stdout || "").trim(), stderr: (r.stderr || "").trim() };
}

/**
 * Commit `files` and push with a bounded fetch/rebase/push loop. When the rebase
 * pulled in new upstream commits, `validate` is re-run before pushing.
 * @returns {{pushed: boolean, reason?: "nothing"|"validation"|"push", detail?: string}}
 */
function commitAndPush({ files, message, git = defaultGit, validate = null, log = console.log }) {
  git(["add", "--", ...files]);
  if (git(["diff", "--cached", "--quiet"]).ok) {
    log("No changes to commit");
    return { pushed: false, reason: "nothing" };
  }
  const c = git(["commit", "-m", message, `--author=${AUTHOR}`]);
  if (!c.ok) return { pushed: false, reason: "push", detail: `commit failed: ${c.stderr}` };
  for (let i = 1; i <= MAX_PUSH_TRIES; i++) {
    const before = git(["rev-parse", "HEAD~1"]).stdout;
    git(["fetch", "origin", "main"]);
    if (!git(["rebase", "origin/main"]).ok) {
      git(["rebase", "--abort"]);
      log(`push attempt ${i}: rebase failed`);
      continue;
    }
    const after = git(["rev-parse", "HEAD~1"]).stdout;
    if (validate && before !== after) {
      const v = validate();
      if (!v.ok) return { pushed: false, reason: "validation", detail: v.reason };
    }
    if (git(["push", "origin", "HEAD:main"]).ok) return { pushed: true };
    log(`push attempt ${i}: push rejected`);
  }
  return { pushed: false, reason: "push", detail: `push failed after ${MAX_PUSH_TRIES} attempts` };
}

function defaultValidate(slug) {
  const r = spawnSync(process.execPath, [path.join(__dirname, "validate-refreshed-article.js"), `--slug=${slug}`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return { ok: r.status === 0, reason: (r.stderr || r.stdout || "").trim().split("\n").slice(0, 4).join("; ").slice(0, 400) };
}

/** Last ~10 non-empty lines of a step log, joined, trimmed, capped at 500 chars (keeps the end). */
function tailLog(file, lines = LOG_TAIL_LINES, max = LOG_TAIL_CHARS) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
  const tail = text
    .replace(/\x1b\[[0-9;]*m/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-lines)
    .join(" | ");
  return tail.length > max ? "..." + tail.slice(tail.length - (max - 3)) : tail;
}

/** @returns {{ok: boolean, reason?: string, step?: string}} from the workflow's toJSON(steps). */
function evaluateSteps(steps, order = STEP_ORDER, logDir = LOG_DIR) {
  for (const id of order) {
    const outcome = steps?.[id]?.outcome;
    if (outcome !== "success") {
      const tail = tailLog(path.join(logDir, `${id}.log`));
      return { ok: false, step: id, reason: `step ${id}: ${outcome || "missing"}` + (tail ? ` - ${tail}` : "") };
    }
  }
  return { ok: true };
}

function failureFiles(git) {
  const changed = git(["diff", "--name-only"]).stdout.split("\n").filter(Boolean);
  return changed.filter((f) => f !== QUEUE_REL && !f.startsWith(".claude/"));
}

/**
 * @returns {{status: "none"|"done"|"failed"|"push-failed", slug?: string, reason?: string}}
 */
function finalize({
  queueFile = QUEUE_PATH,
  statusFile = STATUS_PATH,
  steps,
  logDir = LOG_DIR,
  now = new Date(),
  git = defaultGit,
  validate = defaultValidate,
  log = console.log,
} = {}) {
  const status = readStatus(statusFile);
  if (!status?.slug) {
    log("finalize: nothing claimed");
    return { status: "none" };
  }
  const { slug } = status;
  const date = isoDay(now);
  const verdict = evaluateSteps(steps, STEP_ORDER, logDir);
  let ok = verdict.ok && status.ok === true && status.phase === "refreshed";
  let reason = "";
  if (!ok) {
    reason = !verdict.ok
      ? verdict.reason + (status.reason && status.phase !== "refreshed" ? ` (${status.reason})` : "")
      : status.reason || "refresh did not complete";
    if (status.phase === "claimed" && !verdict.ok) reason += " [timed out or cancelled during refresh]";
  }

  if (ok) {
    const state = readQueue(queueFile);
    markDone(state, slug, date);
    writeQueue(state, queueFile);
    const res = commitAndPush({
      files: [...TRANSLATION_FILES, QUEUE_REL],
      message: `chore(ressources): refresh article ${slug}`,
      git,
      validate: () => validate(slug),
      log,
    });
    if (res.pushed || res.reason === "nothing") {
      log(`Finalized ${slug}: done`);
      return { status: "done", slug };
    }
    if (res.reason === "push") {
      log(`Finalize: push failed for ${slug}: ${res.detail}`);
      return { status: "push-failed", slug, reason: res.detail };
    }
    // post-rebase validation failed: drop our commit and record the failure on top of upstream
    reason = `validation after rebase: ${res.detail}`;
    git(["reset", "--hard", "origin/main"]);
    ok = false;
  } else {
    for (const f of failureFiles(git)) git(["checkout", "--", f]);
  }

  const state = readQueue(queueFile);
  markFailed(state, slug, date, reason);
  writeQueue(state, queueFile);
  const res = commitAndPush({
    files: [QUEUE_REL],
    message: `chore(ressources): refresh failed for ${slug} ${SKIP_CI}`,
    git,
    log,
  });
  log(`Finalized ${slug}: failed (${reason})`);
  if (!res.pushed && res.reason === "push") return { status: "push-failed", slug, reason: res.detail };
  return { status: "failed", slug, reason };
}

function emitOutput(obj) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(obj).map(([k, v]) => `${k}=${v}`).join("\n") + "\n");
}

function main(argv) {
  if (argv.includes("--claim")) {
    const out = claimNext();
    const res = commitAndPush({
      files: [QUEUE_REL],
      message: `${out.slug ? `chore(ressources): claim refresh of ${out.slug}` : "chore(ressources): refresh queue update"} ${SKIP_CI}`,
    });
    if (!res.pushed && res.reason === "push") {
      console.error(`claim push failed: ${res.detail}`);
      process.exit(1);
    }
    emitOutput({ status: out.status, slug: out.slug || "" });
    return;
  }
  if (argv.includes("--refresh")) {
    const st = refreshClaimed();
    emitOutput({ slug: st.slug, status: st.ok ? "done" : "failed" });
    process.exit(st.ok ? 0 : 1);
  }
  if (argv.includes("--finalize")) {
    let steps = {};
    try {
      steps = JSON.parse(process.env.STEPS_JSON || "{}");
    } catch {}
    const out = finalize({ steps });
    emitOutput({ status: out.status, slug: out.slug || "" });
    process.exit(out.status === "push-failed" ? 1 : 0);
  }
  console.error("usage: refresh-next-article.js --claim | --refresh | --finalize");
  process.exit(2);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = {
  readQueue,
  writeQueue,
  normalizeQueue,
  pickStaleSlug,
  claimNext,
  refreshClaimed,
  finalize,
  commitAndPush,
  evaluateSteps,
  tailLog,
  MAX_ATTEMPTS,
};
