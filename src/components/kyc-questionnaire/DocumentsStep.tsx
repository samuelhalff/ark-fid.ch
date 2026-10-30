"use client";

import { CheckCircle, Paperclip, Trash, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Progress } from "@/src/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import { label } from "@/src/lib/kyc-questionnaire/engine";
import { SERVER_ERRORS, UI } from "@/src/lib/kyc-questionnaire/ui";
import type { DocDeclared, DocItem, KycLocale } from "@/src/lib/kyc-questionnaire/types";
import { KYC_ACCEPT_ATTRIBUTE as ACCEPT_ATTRIBUTE } from "@/src/lib/kyc-questionnaire/documents";
import { extensionOf } from "@/src/lib/tax-questionnaire/files";
import { cn } from "@/src/lib/utils";
import { ApiError, api, uploadFile, type CaseFile, type UploadHandle, type UploadTarget } from "./api";

/** Accepted extensions of the signed form (scan or photo). */
export const SIGNED_ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif";

export const errorText = (code: string, locale: KycLocale, maxFileBytes?: number) =>
  (SERVER_ERRORS[code] || SERVER_ERRORS.generic)[locale].replace("{mb}", String(Math.round((maxFileBytes || 50 * 1024 * 1024) / (1024 * 1024))));

interface Active {
  id: string;
  name: string;
  progress: number;
  handle?: UploadHandle;
  error?: string;
}

/**
 * Uploads per key (a document, or "signed"): progress, cancel, errors, and a leave-page guard
 * while one is running. `beforeUpload` runs first (the server checks the key against the saved
 * draft, so the current answers are saved before each batch).
 */
export function useUploads(opts: { locale: KycLocale; maxFileBytes: number; beforeUpload?: () => Promise<void>; onUploaded: (key: string) => void; onBusy?: (busy: boolean) => void }) {
  const { locale, maxFileBytes, beforeUpload, onUploaded, onBusy } = opts;
  const [active, setActive] = useState<Record<string, Active[]>>({});
  const busy = Object.values(active).some((list) => list.some((a) => !a.error));
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

  const update = (key: string, id: string, patch: Partial<Active> | null) =>
    setActive((prev) => ({ ...prev, [key]: (prev[key] || []).flatMap((a) => (a.id !== id ? [a] : patch ? [{ ...a, ...patch }] : [])) }));

  const start = async (key: string, target: UploadTarget, list: File[], accept: string) => {
    const allowed = accept.split(",").map((ext) => ext.slice(1));
    const batch = list.map((file) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Same checks as the server, before anything is sent.
      const error = !allowed.includes(extensionOf(file.name)) ? "file_type" : file.size <= 0 ? "file_empty" : file.size > maxFileBytes ? "file_size" : "";
      return { id, file, error };
    });
    setActive((prev) => ({ ...prev, [key]: [...(prev[key] || []), ...batch.map(({ id, file, error }) => ({ id, name: file.name, progress: 0, error: error ? errorText(error, locale, maxFileBytes) : undefined }))] }));
    const valid = batch.filter((b) => !b.error);
    if (!valid.length) return;
    try {
      await beforeUpload?.();
    } catch {
      /* the upload call reports its own error */
    }
    for (const { id, file } of valid) {
      const handle = uploadFile(file, target, (progress) => update(key, id, { progress }));
      update(key, id, { handle });
      try {
        await handle.promise;
        update(key, id, null);
        onUploaded(key);
      } catch (error) {
        const code = error instanceof ApiError ? error.code : "generic";
        update(key, id, code === "cancelled" ? null : { error: errorText(code, locale, maxFileBytes) });
        onUploaded(key);
      }
    }
  };

  const dismiss = (key: string, id: string) => update(key, id, null);
  return { active, busy, start, dismiss };
}

export interface DocumentsStepProps {
  items: DocItem[];
  files: CaseFile[];
  docDeclared: Record<string, DocDeclared>;
  onDeclared: (key: string, value: DocDeclared | null) => void;
  locale: KycLocale;
  maxFileBytes: number;
  /** Saves the draft (the server checks each document key against the saved answers). */
  beforeUpload: () => Promise<void>;
  /** Called after uploads / removals so the parent refreshes the file list. */
  onChanged: () => void;
  /** Reports whether uploads are running (leave-page guard, submit lock). */
  onBusy?: (busy: boolean) => void;
  /** Keys of items still without a file or a status after "Continue" (shown in error). */
  missing?: Set<string>;
}

/** Section H: one card per requested document (files, upload, "sent separately" / "not applicable"). */
export function DocumentsStep({ items, files, docDeclared, onDeclared, locale, maxFileBytes, beforeUpload, onChanged, onBusy, missing }: DocumentsStepProps) {
  const onUploaded = useCallback(
    (key: string) => {
      onDeclared(key, null);
      onChanged();
    },
    [onDeclared, onChanged],
  );
  const uploads = useUploads({ locale, maxFileBytes, beforeUpload, onUploaded, onBusy });
  const filesFor = (item: DocItem) => files.filter((f) => f.code === item.code);
  const handled = items.filter((item) => filesFor(item).length > 0 || docDeclared[item.key] || !item.required).length;

  return (
    <div className="flex flex-col gap-4">
      {items.length > 1 ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-sm text-muted-foreground">{UI.docsDone[locale].replace("{done}", String(handled)).replace("{total}", String(items.length))}</p>
          <Progress value={items.length ? (handled / items.length) * 100 : 0} aria-hidden="true" />
        </div>
      ) : null}
      {items.map((item) => {
        const mine = filesFor(item);
        const received = mine.length > 0;
        const status = docDeclared[item.key];
        const isMissing = !!missing?.has(item.key) && !received && !status;
        const titleId = `doc-${item.code}-title`;
        return (
          <Card key={item.key} data-field={`doc:${item.key}`} tabIndex={-1} aria-labelledby={titleId} className={cn("gap-3 py-4 outline-none", isMissing && "ring-2 ring-destructive/60")}>
            <CardHeader className="flex flex-row items-start justify-between gap-3 px-4">
              <CardTitle id={titleId} className="text-base font-medium leading-snug">
                {label(item.label, locale)}
                {!item.required ? <span className="ml-1 font-normal text-muted-foreground">({UI.optional[locale]})</span> : null}
              </CardTitle>
              {received ? (
                <Badge className="shrink-0 gap-1">
                  <CheckCircle className="size-3.5" />
                  {UI.received[locale]}
                </Badge>
              ) : status ? (
                <Badge variant="secondary" className="shrink-0">
                  {status === "later" ? UI.docLater[locale] : UI.docNa[locale]}
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-3 px-4">
              {item.hint ? <p className="text-sm text-muted-foreground">{label(item.hint, locale)}</p> : null}
              <FileList files={mine} locale={locale} onChanged={onChanged} />
              <ActiveList list={uploads.active[item.key] || []} locale={locale} onDismiss={(id) => uploads.dismiss(item.key, id)} />
              {isMissing ? (
                <p className="text-sm font-medium text-destructive" role="alert">
                  {UI.docsMissing[locale]}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <PickFiles
                  accept={ACCEPT_ATTRIBUTE}
                  label={received ? UI.addFiles[locale] : UI.chooseFiles[locale]}
                  describedBy={titleId}
                  onFiles={(list) => void uploads.start(item.key, { kind: "doc", docKey: item.key }, list, ACCEPT_ATTRIBUTE)}
                />
                {!received ? (
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    size="sm"
                    className="flex-wrap"
                    value={status || ""}
                    onValueChange={(v) => onDeclared(item.key, v === "later" || v === "na" ? v : null)}
                    aria-label={label(item.label, locale)}
                  >
                    <ToggleGroupItem value="later" className="px-3">
                      {UI.later[locale]}
                    </ToggleGroupItem>
                    {!item.required ? (
                      <ToggleGroupItem value="na" className="px-3">
                        {UI.na[locale]}
                      </ToggleGroupItem>
                    ) : null}
                  </ToggleGroup>
                ) : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/** A real button opening the file picker (keyboard and screen-reader friendly, several files). */
export function PickFiles({ accept, label: text, onFiles, describedBy, disabled }: { accept: string; label: string; onFiles: (files: File[]) => void; describedBy?: string; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept={accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const list = Array.from(e.target.files || []);
          e.target.value = "";
          if (list.length) onFiles(list);
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled} aria-describedby={describedBy} onClick={() => input.current?.click()}>
        <Paperclip className="size-4" />
        {text}
      </Button>
    </>
  );
}

/** Uploaded files, each with a delete button. */
export function FileList({ files, locale, onChanged }: { files: CaseFile[]; locale: KycLocale; onChanged: () => void }) {
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState("");
  if (!files.length) return null;
  const remove = async (file: CaseFile) => {
    setError("");
    setRemoving(file.id);
    try {
      await api.caseAction("delete", { fileId: file.id });
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "generic", locale));
    } finally {
      setRemoving("");
      onChanged();
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-1 text-sm">
        {files.map((file) => {
          const shown = file.name.replace(/^\[[0-9a-f]{12}\] /, "");
          return (
            <li key={file.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-warm px-3 py-1.5 dark:bg-card">
              <span className="min-w-0 truncate">{shown}</span>
              {file.carried ? (
                <span className="shrink-0 text-xs text-muted-foreground">{UI.carried[locale]}</span>
              ) : (
                <Button type="button" variant="ghost" size="icon" disabled={removing === file.id} aria-label={`${UI.remove[locale]} ${shown}`} onClick={() => void remove(file)}>
                  <Trash className="size-4" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Uploads in progress (with cancel) and failed ones (with their reason). */
export function ActiveList({ list, locale, onDismiss }: { list: Active[]; locale: KycLocale; onDismiss: (id: string) => void }) {
  if (!list.length) return null;
  return (
    <ul className="flex flex-col gap-2 text-sm" aria-live="polite">
      {list.map((a) => (
        <li key={a.id} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">{a.name}</span>
            {a.error ? (
              <span className="flex items-center gap-1 text-destructive">
                <span role="alert">{a.error}</span>
                <Button type="button" variant="ghost" size="icon" aria-label={`${UI.cancel[locale]} ${a.name}`} onClick={() => onDismiss(a.id)}>
                  <X className="size-4" />
                </Button>
              </span>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => a.handle?.cancel()} disabled={!a.handle}>
                <X className="size-4" />
                {UI.cancel[locale]}
              </Button>
            )}
          </div>
          {!a.error ? <Progress value={Math.round(a.progress * 100)} aria-label={UI.uploading[locale].replace("{pct}", String(Math.round(a.progress * 100)))} /> : null}
        </li>
      ))}
    </ul>
  );
}
