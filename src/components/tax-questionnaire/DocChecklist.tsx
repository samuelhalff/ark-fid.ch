"use client";

import { CheckCircle, Copy, FileText, Trash, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/src/components/kibo-ui/dropzone";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/src/components/ui/collapsible";
import { Progress } from "@/src/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import { trackEvent } from "@/src/lib/analytics";
import { DOC_CATEGORIES } from "@/src/lib/tax-questionnaire/documents";
import { ALLOWED_TYPES, UPLOAD_LIMITS } from "@/src/lib/tax-questionnaire/files";
import { requestTemplate, whereToFind } from "@/src/lib/tax-questionnaire/hints";
import { SERVER_ERRORS, UI, UI2 } from "@/src/lib/tax-questionnaire/ui";
import type { DocItem, QfLocale } from "@/src/lib/tax-questionnaire/types";
import { ApiError, api, uploadFile, type CaseFile, type UploadHandle } from "./api";

const ACCEPT: Record<string, string[]> = Object.fromEntries(
  Object.entries(ALLOWED_TYPES).flatMap(([ext, mimes]) => mimes.map((mime) => [mime, [`.${ext}`]] as const)).reduce<[string, string[]][]>((acc, [mime, exts]) => {
    const found = acc.find(([m]) => m === mime);
    if (found) found[1].push(...exts);
    else acc.push([mime, [...exts]]);
    return acc;
  }, []),
);

interface Active {
  id: string;
  name: string;
  progress: number;
  handle: UploadHandle;
  error?: string;
}

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
}

export function DocChecklist({ items, files, docStatus, onStatus, locale, clientName, canRemove, onChanged, onBusy, showExtra = true }: DocChecklistProps) {
  const [active, setActive] = useState<Record<string, Active[]>>({});
  const busy = Object.values(active).some((list) => list.some((a) => !a.error && a.progress < 1));
  useEffect(() => onBusy?.(busy), [busy, onBusy]);
  useEffect(() => {
    if (!busy) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [busy]);

  const filesFor = (item: DocItem) => files.filter((f) => f.code === item.code);
  const handled = items.filter((item) => filesFor(item).length > 0 || docStatus[item.key]).length;

  const start = (key: string, label: string, list: File[]) => {
    for (const file of list) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const handle = uploadFile(file, { docKey: key, label }, (progress) =>
        setActive((prev) => ({ ...prev, [key]: (prev[key] || []).map((a) => (a.id === id ? { ...a, progress } : a)) })),
      );
      setActive((prev) => ({ ...prev, [key]: [...(prev[key] || []), { id, name: file.name, progress: 0, handle }] }));
      handle.promise
        .then(() => {
          setActive((prev) => ({ ...prev, [key]: (prev[key] || []).filter((a) => a.id !== id) }));
          trackEvent("tax_qf_upload", { result: "ok" });
          onStatus?.(key, null);
          onChanged();
        })
        .catch((error: unknown) => {
          const code = error instanceof ApiError ? error.code : "generic";
          trackEvent("tax_qf_upload", { result: code === "cancelled" ? "cancelled" : "error" });
          if (code === "cancelled") setActive((prev) => ({ ...prev, [key]: (prev[key] || []).filter((a) => a.id !== id) }));
          else setActive((prev) => ({ ...prev, [key]: (prev[key] || []).map((a) => (a.id === id ? { ...a, error: (SERVER_ERRORS[code] || SERVER_ERRORS.generic)[locale] } : a)) }));
          onChanged();
        });
    }
  };

  const remove = async (file: CaseFile) => {
    try {
      await api.caseAction("remove", { itemId: file.id });
    } finally {
      onChanged();
    }
  };

  const grouped = Object.keys(DOC_CATEGORIES)
    .map((category) => ({ category, list: items.filter((i) => i.category === category) }))
    .filter((g) => g.list.length);

  return (
    <div className="flex flex-col gap-6">
      {items.length > 1 ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-sm text-muted-foreground">{UI2.docsProgress[locale].replace("{done}", String(handled)).replace("{total}", String(items.length))}</p>
          <Progress value={items.length ? (handled / items.length) * 100 : 0} />
        </div>
      ) : null}
      {grouped.map(({ category, list }) => (
        <section key={category} className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold tracking-tight">{DOC_CATEGORIES[category as keyof typeof DOC_CATEGORIES].label[locale]}</h3>
          {list.map((item) => (
            <DocCard
              key={item.key}
              item={item}
              files={filesFor(item)}
              active={active[item.key] || []}
              status={docStatus[item.key]}
              onStatus={onStatus}
              onFiles={(selected) => start(item.key, item.label.fr.split(" – ")[0].slice(0, 50), selected)}
              onRemove={canRemove ? remove : undefined}
              locale={locale}
              clientName={clientName}
            />
          ))}
        </section>
      ))}
      {showExtra ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold tracking-tight">{UI.extraTitle[locale]}</h3>
          <p className="text-sm text-muted-foreground">{UI.extraIntro[locale]}</p>
          <FileList files={files.filter((f) => f.extra)} onRemove={canRemove ? remove : undefined} locale={locale} />
          <ActiveList list={active.extra || []} locale={locale} />
          <UploadZone locale={locale} onFiles={(selected) => start("extra", "", selected)} />
        </section>
      ) : null}
    </div>
  );
}

function DocCard({
  item,
  files,
  active,
  status,
  onStatus,
  onFiles,
  onRemove,
  locale,
  clientName,
}: {
  item: DocItem;
  files: CaseFile[];
  active: Active[];
  status?: "later" | "na";
  onStatus?: (key: string, status: "later" | "na" | null) => void;
  onFiles: (files: File[]) => void;
  onRemove?: (file: CaseFile) => void;
  locale: QfLocale;
  clientName: string;
}) {
  const [copied, setCopied] = useState(false);
  const template = requestTemplate(item, locale, clientName);
  const received = files.length > 0;
  return (
    <Card className="gap-3 py-4">
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-4">
        <CardTitle className="text-base font-medium leading-snug">{item.label[locale]}</CardTitle>
        {received ? (
          <Badge className="shrink-0 gap-1">
            <CheckCircle className="size-3.5" />
            {UI.received[locale]}
          </Badge>
        ) : status ? (
          <Badge variant="secondary" className="shrink-0">
            {status === "later" ? UI.later[locale] : UI.na[locale]}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4">
        <p className="text-sm text-muted-foreground">{whereToFind(item, locale)}</p>
        <FileList files={files} onRemove={onRemove} locale={locale} />
        <ActiveList list={active} locale={locale} />
        <UploadZone locale={locale} onFiles={onFiles} compact={received} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {!received && onStatus ? (
            <ToggleGroup type="single" variant="outline" size="sm" value={status || ""} onValueChange={(v) => onStatus(item.key, v === "later" || v === "na" ? v : null)}>
              <ToggleGroupItem value="later">{UI.later[locale]}</ToggleGroupItem>
              <ToggleGroupItem value="na">{UI.na[locale]}</ToggleGroupItem>
            </ToggleGroup>
          ) : (
            <span />
          )}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="link" size="sm" className="px-0">
                {UI2.requestTemplate[locale]}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 flex flex-col gap-2 rounded-md bg-surface-warm p-3 text-sm dark:bg-card">
              <p className="font-medium">{template.subject}</p>
              <p className="whitespace-pre-line text-muted-foreground">{template.body}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => {
                  void navigator.clipboard?.writeText(`${template.subject}\n\n${template.body}`).then(() => setCopied(true));
                }}
              >
                <Copy className="size-4" />
                {copied ? UI2.copied[locale] : UI2.copy[locale]}
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
}

function UploadZone({ locale, onFiles, compact }: { locale: QfLocale; onFiles: (files: File[]) => void; compact?: boolean }) {
  const [error, setError] = useState("");
  const zoneRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={zoneRef} className="flex flex-col gap-1">
      <Dropzone
        accept={ACCEPT}
        maxFiles={20}
        maxSize={UPLOAD_LIMITS.maxFileBytes}
        minSize={1}
        className={compact ? "p-3" : "p-5"}
        onDrop={(accepted) => {
          setError("");
          onFiles(accepted);
        }}
        onError={() => setError(`${SERVER_ERRORS.file_type[locale]} ${SERVER_ERRORS.file_size[locale]}`)}
      >
        <DropzoneEmptyState>
          <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
            <FileText className="size-4" />
            {UI2.dropHere[locale]}
          </span>
        </DropzoneEmptyState>
        <DropzoneContent />
      </Dropzone>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function FileList({ files, onRemove, locale }: { files: CaseFile[]; onRemove?: (file: CaseFile) => void; locale: QfLocale }) {
  if (!files.length) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {files.map((file) => (
        <li key={file.id} className="flex items-center justify-between gap-2 rounded-md bg-surface-warm px-3 py-1.5 dark:bg-card">
          <span className="truncate">{file.name.replace(/^\[[0-9a-f]{6}\] /, "")}</span>
          {onRemove ? (
            <Button type="button" variant="ghost" size="icon" aria-label={`${UI.remove[locale]} ${file.name}`} onClick={() => onRemove(file)}>
              <Trash className="size-4" />
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ActiveList({ list, locale }: { list: Active[]; locale: QfLocale }) {
  if (!list.length) return null;
  return (
    <ul className="flex flex-col gap-2 text-sm" aria-live="polite">
      {list.map((a) => (
        <li key={a.id} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">{a.name}</span>
            {a.error ? (
              <span className="text-destructive">{a.error}</span>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => a.handle.cancel()}>
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
