import assert from "node:assert/strict";
import test from "node:test";
import { docRowView, formatSize, isRetryable, pendingRows, shownName, uploadReducer, type UploadRow } from "../doc-actions";

const base = { required: true, canNotApply: false, received: false, status: null, canDeclare: true };

test("required document: choose files + send separately, no 'not applicable' unless it can not apply", () => {
  assert.deepEqual(docRowView(base), { mode: "actions", actions: ["choose", "later"] });
  assert.deepEqual(docRowView({ ...base, canNotApply: true }), { mode: "actions", actions: ["choose", "later", "na"] });
});

test("optional document: only add a file (no 'separately', no 'not applicable')", () => {
  assert.deepEqual(docRowView({ ...base, required: false }), { mode: "actions", actions: ["addFile"] });
  assert.deepEqual(docRowView({ ...base, required: false, canNotApply: true }), { mode: "actions", actions: ["addFile"] });
});

test("files received: add more, no declaration buttons", () => {
  assert.deepEqual(docRowView({ ...base, received: true }), { mode: "actions", actions: ["addMore"] });
  assert.deepEqual(docRowView({ ...base, received: true, status: "later" }), { mode: "actions", actions: ["addMore"] });
});

test("declared without a file: quiet line, change only where declaring is allowed", () => {
  assert.deepEqual(docRowView({ ...base, status: "later" }), { mode: "declared", status: "later", canChange: true });
  assert.deepEqual(docRowView({ ...base, status: "na", canDeclare: false }), { mode: "declared", status: "na", canChange: false });
});

test("read-only page: a required document offers only the file picker", () => {
  assert.deepEqual(docRowView({ ...base, canNotApply: true, canDeclare: false }), { mode: "actions", actions: ["choose"] });
});

const started = (error?: string) => uploadReducer([], { type: "start", id: "a", name: "id.pdf", size: 2048, error });

test("upload: idle → uploading → received", () => {
  let rows = started();
  assert.equal(rows[0].state, "uploading");
  rows = uploadReducer(rows, { type: "progress", id: "a", progress: 0.4 });
  assert.equal(rows[0].progress, 0.4);
  rows = uploadReducer(rows, { type: "progress", id: "a", progress: 0.2 });
  assert.equal(rows[0].progress, 0.4, "progress never goes back");
  rows = uploadReducer(rows, { type: "done", id: "a", storedName: "[abc123] ID - id.pdf" });
  assert.deepEqual([rows[0].state, rows[0].progress], ["received", 1]);
});

test("upload: error, retry (server errors only), remove", () => {
  let rows = uploadReducer(started(), { type: "fail", id: "a", error: "network" });
  assert.deepEqual([rows[0].state, rows[0].error], ["error", "network"]);
  rows = uploadReducer(rows, { type: "retry", id: "a" });
  assert.deepEqual([rows[0].state, rows[0].progress, rows[0].error], ["uploading", 0, undefined]);
  rows = uploadReducer(rows, { type: "remove", id: "a" });
  assert.deepEqual(rows, []);
});

test("upload: a file refused by the client check is shown in error and cannot be retried", () => {
  let rows = started("file_size");
  assert.deepEqual([rows[0].state, rows[0].error], ["error", "file_size"]);
  assert.equal(isRetryable("file_size"), false);
  assert.equal(isRetryable("network"), true);
  rows = uploadReducer(rows, { type: "retry", id: "a" });
  assert.equal(rows[0].state, "error");
});

test("received rows give way to the stored file once the list holds it", () => {
  const rows: UploadRow[] = [
    { id: "a", name: "id.pdf", size: 1, state: "received", progress: 1, storedName: "[abc123] ID - id.pdf" },
    { id: "b", name: "b.pdf", size: 1, state: "uploading", progress: 0.5 },
  ];
  assert.deepEqual(pendingRows(rows, []).map((r) => r.id), ["a", "b"]);
  assert.deepEqual(pendingRows(rows, [{ name: "[abc123] ID - id.pdf" }]).map((r) => r.id), ["b"]);
});

test("shown names and sizes", () => {
  assert.equal(shownName("[abc123] ID - id.pdf"), "ID - id.pdf");
  assert.equal(shownName("[0123456789ab] x.pdf"), "x.pdf");
  assert.equal(formatSize(2048, "fr"), "2 Ko");
  assert.equal(formatSize(1.25 * 1024 * 1024, "fr"), "1,3 Mo");
  assert.equal(formatSize(1.25 * 1024 * 1024, "en"), "1.3 MB");
});
