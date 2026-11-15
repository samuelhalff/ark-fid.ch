"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { uploadReducer, type UploadEvent, type UploadRow } from "@/src/lib/doc-actions";

/** What both questionnaires' upload helpers return. */
export interface UploadHandleLike {
  promise: Promise<{ name: string; size: number }>;
  cancel: () => void;
}

type Keyed = Record<string, UploadRow[]>;
const keyed = (state: Keyed, action: { key: string; event: UploadEvent }): Keyed => ({ ...state, [action.key]: uploadReducer(state[action.key] || [], action.event) });

const errorCode = (error: unknown) => (error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "generic");

/**
 * Per-file uploads keyed by document (or "signed"): each chosen file becomes a row at once
 * (uploading → received / error), with cancel, retry and remove, and a leave-page guard while
 * something is sending. `validate` is the client check (same rules as the server); `beforeUpload`
 * runs before each batch (the KYC server checks the key against the saved draft).
 */
export function useFileUploads(opts: {
  upload: (file: File, key: string, onProgress: (fraction: number) => void) => UploadHandleLike;
  validate: (file: File, key: string) => string | null;
  beforeUpload?: () => Promise<void>;
  onUploaded: (key: string, ok: boolean) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [rows, dispatch] = useReducer(keyed, {});
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const files = useRef(new Map<string, File>());
  const handles = useRef(new Map<string, UploadHandleLike>());
  const busy = Object.values(rows).some((list) => list.some((row) => row.state === "uploading"));
  const { onBusy } = opts;

  useEffect(() => onBusy?.(busy), [busy, onBusy]);
  useEffect(() => () => onBusy?.(false), [onBusy]);
  useEffect(() => {
    if (!busy) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [busy]);

  const run = useCallback(async (key: string, id: string, file: File) => {
    const handle = optsRef.current.upload(file, key, (progress) => dispatch({ key, event: { type: "progress", id, progress } }));
    handles.current.set(id, handle);
    try {
      const result = await handle.promise;
      dispatch({ key, event: { type: "done", id, storedName: result.name } });
      files.current.delete(id);
      optsRef.current.onUploaded(key, true);
    } catch (error) {
      const code = errorCode(error);
      if (code === "cancelled") {
        dispatch({ key, event: { type: "remove", id } });
        files.current.delete(id);
      } else {
        dispatch({ key, event: { type: "fail", id, error: code } });
        optsRef.current.onUploaded(key, false);
      }
    } finally {
      handles.current.delete(id);
    }
  }, []);

  const start = useCallback(
    async (key: string, list: File[]) => {
      const batch = list.map((file) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file, error: optsRef.current.validate(file, key) }));
      for (const { id, file, error } of batch) {
        if (!error) files.current.set(id, file);
        dispatch({ key, event: { type: "start", id, name: file.name, size: file.size, error: error || undefined } });
      }
      const valid = batch.filter((b) => !b.error);
      if (!valid.length) return;
      try {
        await optsRef.current.beforeUpload?.();
      } catch {
        /* the upload call reports its own error */
      }
      for (const { id, file } of valid) await run(key, id, file);
    },
    [run],
  );

  const retry = useCallback(
    (key: string, id: string) => {
      const file = files.current.get(id);
      if (!file) return;
      dispatch({ key, event: { type: "retry", id } });
      void run(key, id, file);
    },
    [run],
  );

  /** Cancels a running upload, or drops a failed / received row. */
  const dismiss = useCallback((key: string, id: string) => {
    handles.current.get(id)?.cancel();
    dispatch({ key, event: { type: "remove", id } });
    files.current.delete(id);
  }, []);

  return { rows, busy, start, retry, dismiss };
}
