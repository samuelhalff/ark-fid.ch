"use client";

import { useCallback } from "react";
import { DocumentRow, type DocRowStrings } from "@/src/components/questionnaire-docs/DocumentRow";
import { FileRows, type FileRowsStrings, type StoredFile } from "@/src/components/questionnaire-docs/FileRows";
import { useFileUploads } from "@/src/components/questionnaire-docs/useFileUploads";
import { Progress } from "@/src/components/ui/progress";
import { label } from "@/src/lib/kyc-questionnaire/engine";
import { SERVER_ERRORS, UI } from "@/src/lib/kyc-questionnaire/ui";
import type { DocDeclared, DocItem, KycLocale } from "@/src/lib/kyc-questionnaire/types";
import { KYC_ACCEPT_ATTRIBUTE as ACCEPT_ATTRIBUTE } from "@/src/lib/kyc-questionnaire/documents";
import { extensionOf } from "@/src/lib/tax-questionnaire/files";
import type { UploadRow } from "@/src/lib/doc-actions";
import { api, uploadFile, type CaseFile } from "./api";

export { PickFiles } from "@/src/components/questionnaire-docs/DocumentRow";

/** Accepted extensions of the signed form (scan or photo). */
export const SIGNED_ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif";

const mbOf = (maxFileBytes?: number) => String(Math.round((maxFileBytes || 50 * 1024 * 1024) / (1024 * 1024)));

export const errorText = (code: string, locale: KycLocale, maxFileBytes?: number) => (SERVER_ERRORS[code] || SERVER_ERRORS.generic)[locale].replace("{mb}", mbOf(maxFileBytes));

/** The short reason shown inline on a file row. */
const fileError = (code: string, locale: KycLocale, maxFileBytes: number) => {
  if (code === "file_size") return UI.fileTooBig[locale].replace("{mb}", mbOf(maxFileBytes));
  if (code === "file_type") return UI.fileBadType[locale];
  if (code === "network" || code === "upload_failed" || code === "generic" || !SERVER_ERRORS[code]) return UI.fileFailed[locale];
  return SERVER_ERRORS[code][locale];
};

const acceptFor = (key: string) => (key === "signed" ? SIGNED_ACCEPT : ACCEPT_ATTRIBUTE);

/** KYC uploads per key (a document key, or "signed"), checked like the server before sending. */
export function useKycUploads(opts: { maxFileBytes: number; beforeUpload?: () => Promise<void>; onUploaded: (key: string) => void; onBusy?: (busy: boolean) => void }) {
  const { maxFileBytes } = opts;
  return useFileUploads({
    upload: (file, key, onProgress) => uploadFile(file, key === "signed" ? { kind: "signed" } : { kind: "doc", docKey: key }, onProgress),
    validate: (file, key) => {
      const allowed = acceptFor(key).split(",").map((ext) => ext.slice(1));
      return !allowed.includes(extensionOf(file.name)) ? "file_type" : file.size <= 0 ? "file_empty" : file.size > maxFileBytes ? "file_size" : null;
    },
    beforeUpload: opts.beforeUpload,
    onUploaded: (key) => opts.onUploaded(key),
    onBusy: opts.onBusy,
  });
}

const fileStrings = (locale: KycLocale): FileRowsStrings => ({ remove: UI.removeFile[locale], retry: UI.retry[locale], cancel: UI.cancel[locale], uploading: UI.uploading[locale], carried: UI.carried[locale] });

/** One key's stored files and uploads (documents step and the signed form). */
export function KycFileRows({ files, rows, locale, maxFileBytes, onChanged, onRetry, onDismiss }: { files: CaseFile[]; rows: UploadRow[]; locale: KycLocale; maxFileBytes: number; onChanged: () => void; onRetry: (id: string) => void; onDismiss: (id: string) => void }) {
  const remove = async (file: StoredFile) => {
    try {
      await api.caseAction("delete", { fileId: file.id });
    } finally {
      onChanged();
    }
  };
  return <FileRows files={files} rows={rows} locale={locale} strings={fileStrings(locale)} errorText={(code) => fileError(code, locale, maxFileBytes)} onRemove={remove} onRetry={onRetry} onDismiss={onDismiss} />;
}

const rowStrings = (locale: KycLocale): DocRowStrings => ({
  optional: UI.optional[locale],
  received: UI.received[locale],
  choose: UI.chooseFiles[locale],
  addFile: UI.addFile[locale],
  addMore: UI.addFiles[locale],
  later: UI.later[locale],
  na: UI.na[locale],
  laterDone: UI.laterDone[locale],
  naDone: UI.docNa[locale],
  change: UI.edit[locale],
  showAll: UI.showAll[locale],
  showLess: UI.showLess[locale],
});

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

/** Section H: one row per requested document (files, upload, "sent separately"). */
export function DocumentsStep({ items, files, docDeclared, onDeclared, locale, maxFileBytes, beforeUpload, onChanged, onBusy, missing }: DocumentsStepProps) {
  const onUploaded = useCallback(
    (key: string) => {
      onDeclared(key, null);
      onChanged();
    },
    [onDeclared, onChanged],
  );
  const uploads = useKycUploads({ maxFileBytes, beforeUpload, onUploaded, onBusy });
  const filesFor = (item: DocItem) => files.filter((f) => f.code === item.code);
  const handled = items.filter((item) => filesFor(item).length > 0 || docDeclared[item.key] || !item.required).length;
  const strings = rowStrings(locale);

  return (
    <div className="flex flex-col gap-4">
      {items.length > 1 ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-sm text-muted-foreground">{UI.docsDone[locale].replace("{done}", String(handled)).replace("{total}", String(items.length))}</p>
          <Progress value={items.length ? (handled / items.length) * 100 : 0} aria-hidden="true" />
        </div>
      ) : null}
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const mine = filesFor(item);
          const received = mine.length > 0;
          const status = docDeclared[item.key];
          return (
            <DocumentRow
              key={item.key}
              id={`doc-${item.code}`}
              dataField={`doc:${item.key}`}
              title={label(item.label, locale)}
              hint={item.hint ? label(item.hint, locale) : undefined}
              required={item.required}
              received={received}
              status={status}
              onStatus={(value) => onDeclared(item.key, value)}
              accept={ACCEPT_ATTRIBUTE}
              onFiles={(list) => void uploads.start(item.key, list)}
              strings={strings}
              missing={!!missing?.has(item.key) && !received && !status}
              missingText={UI.docsMissing[locale]}
            >
              <KycFileRows
                files={mine}
                rows={uploads.rows[item.key] || []}
                locale={locale}
                maxFileBytes={maxFileBytes}
                onChanged={onChanged}
                onRetry={(id) => uploads.retry(item.key, id)}
                onDismiss={(id) => uploads.dismiss(item.key, id)}
              />
            </DocumentRow>
          );
        })}
      </ul>
    </div>
  );
}
