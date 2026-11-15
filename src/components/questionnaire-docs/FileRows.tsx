"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { FilledCheck } from "@/src/components/kyc-questionnaire/FilledCheck";
import { Button } from "@/src/components/ui/button";
import { formatSize, isRetryable, pendingRows, shownName, type UploadRow } from "@/src/lib/doc-actions";
import { cn } from "@/src/lib/utils";

export interface FileRowsStrings {
  remove: string;
  retry: string;
  cancel: string;
  /** "Envoi… {pct} %" (progress bar label). */
  uploading: string;
  /** Shown instead of "remove" on a file kept from an earlier revision. */
  carried?: string;
}

export interface StoredFile {
  id: string;
  name: string;
  size: number;
  carried?: boolean;
}

const rowClass = "relative flex min-h-11 min-w-0 items-center gap-2 overflow-hidden rounded-md bg-surface-warm pl-3 pr-1 text-sm dark:bg-card";

/**
 * The files of one document as rows of the same height: stored files (green check, size,
 * « Retirer »), then files being sent (slim progress bar along the bottom edge, « Annuler »),
 * received ones awaiting the list, and failed ones (short reason inline, « Réessayer »).
 */
export function FileRows({
  files,
  rows,
  locale,
  strings,
  errorText,
  onRemove,
  onRetry,
  onDismiss,
}: {
  files: StoredFile[];
  rows: UploadRow[];
  locale: string;
  strings: FileRowsStrings;
  errorText: (code: string) => string;
  /** Absent when files cannot be removed (submitted case). Rejects with an error code. */
  onRemove?: (file: StoredFile) => Promise<void>;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [removing, setRemoving] = useState("");
  const [removeError, setRemoveError] = useState("");
  const pending = pendingRows(rows, files);
  if (!files.length && !pending.length) return null;

  const remove = async (file: StoredFile) => {
    if (!onRemove) return;
    setRemoveError("");
    setRemoving(file.id);
    try {
      await onRemove(file);
    } catch (error) {
      setRemoveError(errorText(error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "generic"));
    } finally {
      setRemoving("");
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-1" aria-live="polite">
        {files.map((file) => {
          const name = shownName(file.name);
          return (
            <li key={file.id} className={cn(rowClass, removing === file.id && "opacity-60")}>
              <FilledCheck filled />
              <span className="flex min-w-0 flex-1 flex-col py-1">
                <span className="truncate">{name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{formatSize(file.size, locale)}</span>
              </span>
              {file.carried ? (
                <span className="shrink-0 px-2 text-xs text-muted-foreground">{strings.carried}</span>
              ) : onRemove ? (
                <Button type="button" variant="ghost" className="h-11 shrink-0 px-3 text-muted-foreground hover:text-foreground" disabled={removing === file.id} aria-label={`${strings.remove} ${name}`} onClick={() => void remove(file)}>
                  {strings.remove}
                </Button>
              ) : null}
            </li>
          );
        })}
        {pending.map((row) => {
          const pct = Math.round(row.progress * 100);
          return (
            <li key={row.id} className={cn(rowClass, row.state === "error" && "bg-destructive/5 dark:bg-destructive/10")}>
              {row.state === "received" ? <FilledCheck filled /> : row.state === "error" ? <WarningCircle aria-hidden="true" weight="bold" className="size-3.5 shrink-0 text-destructive" /> : <span aria-hidden="true" className="size-3.5 shrink-0" />}
              <span className="flex min-w-0 flex-1 flex-col py-1">
                <span className={cn("truncate", row.state === "uploading" && "text-muted-foreground")}>{row.name}</span>
                {row.state === "error" ? (
                  <span className="text-xs font-medium text-destructive" role="alert">
                    {errorText(row.error || "generic")}
                  </span>
                ) : (
                  <span className="text-xs tabular-nums text-muted-foreground">{formatSize(row.size, locale)}</span>
                )}
              </span>
              {row.state === "uploading" ? (
                <Button type="button" variant="ghost" className="h-11 shrink-0 px-3 text-muted-foreground hover:text-foreground" aria-label={`${strings.cancel} ${row.name}`} onClick={() => onDismiss(row.id)}>
                  {strings.cancel}
                </Button>
              ) : row.state === "error" ? (
                <span className="flex shrink-0">
                  {isRetryable(row.error) ? (
                    <Button type="button" variant="ghost" className="h-11 px-2.5" onClick={() => onRetry(row.id)}>
                      {strings.retry}
                    </Button>
                  ) : null}
                  <Button type="button" variant="ghost" className="h-11 px-2.5 text-muted-foreground hover:text-foreground" aria-label={`${strings.remove} ${row.name}`} onClick={() => onDismiss(row.id)}>
                    {strings.remove}
                  </Button>
                </span>
              ) : (
                <span aria-hidden="true" className="h-11 w-2 shrink-0" />
              )}
              {row.state === "uploading" ? (
                <span
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={strings.uploading.replace("{pct}", String(pct))}
                  className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/15"
                >
                  <span className="block h-full bg-primary transition-[width] duration-200 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {removeError ? (
        <p className="text-sm text-destructive" role="alert">
          {removeError}
        </p>
      ) : null}
    </div>
  );
}
