"use client";

import { Copy, FileText } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/src/components/kibo-ui/dropzone";
import { DocumentRow, type DocRowStrings } from "@/src/components/questionnaire-docs/DocumentRow";
import { FileRows, type FileRowsStrings, type StoredFile } from "@/src/components/questionnaire-docs/FileRows";
import { useFileUploads } from "@/src/components/questionnaire-docs/useFileUploads";
import { Button } from "@/src/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/src/components/ui/collapsible";
import { Progress } from "@/src/components/ui/progress";
import { trackEvent } from "@/src/lib/analytics";
import { DOC_CATEGORIES } from "@/src/lib/tax-questionnaire/documents";
import { ACCEPT_ATTRIBUTE, ALLOWED_TYPES, UPLOAD_LIMITS, extensionOf } from "@/src/lib/tax-questionnaire/files";
import { requestTemplate, whereToFind } from "@/src/lib/tax-questionnaire/hints";
import { SERVER_ERRORS, UI, UI2 } from "@/src/lib/tax-questionnaire/ui";
import type { DocItem, QfLocale } from "@/src/lib/tax-questionnaire/types";
import type { UploadRow } from "@/src/lib/doc-actions";
import { api, uploadFile, type CaseFile } from "./api";

const MB = String(Math.round(UPLOAD_LIMITS.maxFileBytes / (1024 * 1024)));

/** The short reason shown inline on a file row. */
const fileError = (code: string, locale: QfLocale) => {
  if (code === "file_size") return UI.fileTooBig[locale].replace("{mb}", MB);
  if (code === "file_type") return UI.fileBadType[locale];
  if (code === "network" || code === "upload_failed" || code === "generic" || !SERVER_ERRORS[code]) return UI.fileFailed[locale];
  return SERVER_ERRORS[code][locale];
};

export interface DocChecklistProps {
  items: DocItem[];
  files: CaseFile[];
  docStatus: Record<string, "later" | "na">;
  onStatus?: (key: string, status: "later" | "na" | null) => void;
  locale: QfLocale;
  clientName: string;
  canRemove: boolean;
  /** Called after uploads/removals so the parent refreshes the file list. */
  onChanged: () => void;
  /** Reports whether uploads are running (leave-page guard, submit lock). */
  onBusy?: (busy: boolean) => void;
  showExtra?: boolean;
  /** "x of y handled" bar (not on the status page). */
  showProgress?: boolean;
  /** Keys of items still without a file or a status after "Continue" (shown in error). */
  missing?: Set<string>;
}

export function DocChecklist({ items, files, docStatus, onStatus, locale, clientName, canRemove, onChanged, onBusy, showExtra = true, showProgress = true, missing }: DocChecklistProps) {
  const labels = useRef(new Map<string, string>());
  const uploads = useFileUploads({
    upload: (file, key, onProgress) => uploadFile(file, { docKey: key, label: labels.current.get(key) || "" }, onProgress),
    validate: (file) => (!ALLOWED_TYPES[extensionOf(file.name)] ? "file_type" : file.size <= 0 ? "file_empty" : file.size > UPLOAD_LIMITS.maxFileBytes ? "file_size" : null),
    onUploaded: (key, ok) => {
      trackEvent("tax_qf_upload", { result: ok ? "ok" : "error" });
      if (ok) onStatus?.(key, null);
      onChanged();
    },
    onBusy,
  });

  const filesFor = (item: DocItem) => files.filter((f) => f.code === item.code);
  const handled = items.filter((item) => filesFor(item).length > 0 || docStatus[item.key]).length;

  const start = (key: string, label: string, list: File[]) => {
    labels.current.set(key, label);
    void uploads.start(key, list);
  };

  const remove = async (file: StoredFile) => {
    try {
      await api.caseAction("remove", { itemId: file.id });
    } finally {
      onChanged();
    }
  };

  const fileStrings: FileRowsStrings = { remove: UI.removeFile[locale], retry: UI2.retry[locale], cancel: UI.cancel[locale], uploading: UI.uploading[locale] };
  const fileRows = (key: string, list: CaseFile[]) => (
    <FileRows
      files={list}
      rows={uploads.rows[key] || []}
      locale={locale}
      strings={fileStrings}
      errorText={(code) => fileError(code, locale)}
      onRemove={canRemove ? remove : undefined}
      onRetry={(id) => uploads.retry(key, id)}
      onDismiss={(id) => uploads.dismiss(key, id)}
    />
  );

  const rowStrings: DocRowStrings = {
    optional: UI.optional[locale],
    received: UI.received[locale],
    choose: UI.chooseFiles[locale],
    addFile: UI.addFile[locale],
    addMore: UI.addFiles[locale],
    later: UI.later[locale],
    na: UI.na[locale],
    laterDone: UI.laterDone[locale],
    naDone: UI.naDone[locale],
    change: UI.edit[locale],
    showAll: UI.showAll[locale],
    showLess: UI.showLess[locale],
  };

  const grouped = Object.keys(DOC_CATEGORIES)
    .map((category) => ({ category, list: items.filter((i) => i.category === category) }))
    .filter((g) => g.list.length);

  return (
    <div className="flex flex-col gap-6">
      {showProgress && items.length > 1 ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-sm text-muted-foreground">{UI2.docsProgress[locale].replace("{done}", String(handled)).replace("{total}", String(items.length))}</p>
          <Progress value={items.length ? (handled / items.length) * 100 : 0} />
        </div>
      ) : null}
      {grouped.map(({ category, list }) => (
        <section key={category} className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold tracking-tight">{DOC_CATEGORIES[category as keyof typeof DOC_CATEGORIES].label[locale]}</h3>
          <ul className="flex flex-col gap-3">
            {list.map((item) => {
              const mine = filesFor(item);
              const status = docStatus[item.key];
              return (
                <DocumentRow
                  key={item.key}
                  id={`doc-${item.code}`}
                  dataField={`doc:${item.key}`}
                  title={item.label[locale]}
                  hint={whereToFind(item, locale)}
                  required
                  canNotApply
                  received={mine.length > 0}
                  status={status}
                  onStatus={onStatus ? (value) => onStatus(item.key, value) : undefined}
                  accept={ACCEPT_ATTRIBUTE}
                  onFiles={(selected) => start(item.key, item.label.fr.split(" – ")[0].slice(0, 50), selected)}
                  strings={rowStrings}
                  missing={!!missing?.has(item.key) && mine.length === 0 && !status}
                  missingText={UI.docsMissingStatus[locale]}
                  footer={<RequestTemplate item={item} locale={locale} clientName={clientName} />}
                >
                  {fileRows(item.key, mine)}
                </DocumentRow>
              );
            })}
          </ul>
        </section>
      ))}
      {showExtra ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold tracking-tight">{UI.extraTitle[locale]}</h3>
          <p className="text-sm text-muted-foreground">{UI.extraIntro[locale]}</p>
          {fileRows(
            "extra",
            files.filter((f) => f.extra),
          )}
          <UploadZone locale={locale} onFiles={(selected) => start("extra", "", selected)} />
        </section>
      ) : null}
    </div>
  );
}

/** « Modèle de demande »: a ready-made request to whoever holds the document. */
function RequestTemplate({ item, locale, clientName }: { item: DocItem; locale: QfLocale; clientName: string }) {
  const [copied, setCopied] = useState(false);
  const template = requestTemplate(item, locale, clientName);
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="link" className="h-11 px-0">
          {UI2.requestTemplate[locale]}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex-col gap-2 data-[state=open]:flex rounded-md bg-surface-warm p-3 text-sm dark:bg-card">
        <p className="font-medium">{template.subject}</p>
        <p className="whitespace-pre-line text-muted-foreground">{template.body}</p>
        <Button
          type="button"
          variant="outline"
          className="h-11 self-start"
          onClick={() => {
            void navigator.clipboard?.writeText(`${template.subject}\n\n${template.body}`).then(() => setCopied(true));
          }}
        >
          <Copy className="size-4" />
          {copied ? UI2.copied[locale] : UI2.copy[locale]}
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The drop zone of « Autres documents » (any number of files, no fixed item). */
function UploadZone({ locale, onFiles }: { locale: QfLocale; onFiles: (files: File[]) => void }) {
  return (
    // No type filter here: every dropped file reaches the rows, a refused one with its short reason.
    <Dropzone maxFiles={20} className="p-5" onDrop={(accepted) => onFiles(accepted)}>
      <DropzoneEmptyState>
        <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
          <FileText className="size-4" />
          {UI2.dropHere[locale]}
        </span>
      </DropzoneEmptyState>
      <DropzoneContent />
    </Dropzone>
  );
}
