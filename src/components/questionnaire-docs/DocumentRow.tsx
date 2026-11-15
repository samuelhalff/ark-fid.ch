"use client";

import { Paperclip, Plus } from "@phosphor-icons/react";
import { useRef, useState, type ReactNode } from "react";
import { LongText } from "@/src/components/forms/LongText";
import { FilledCheck } from "@/src/components/kyc-questionnaire/FilledCheck";
import { Button } from "@/src/components/ui/button";
import { docRowView, type DocAction, type DocDeclared } from "@/src/lib/doc-actions";
import { cn } from "@/src/lib/utils";

/** Texts of a document row, in the page language. */
export interface DocRowStrings {
  optional: string;
  received: string;
  choose: string;
  addFile: string;
  addMore: string;
  later: string;
  na: string;
  laterDone: string;
  naDone: string;
  change: string;
  showAll: string;
  showLess: string;
}

/** A real button opening the file picker (keyboard and screen-reader friendly, several files). */
export function PickFiles({
  accept,
  label: text,
  onFiles,
  describedBy,
  disabled,
  variant = "outline",
  icon = "clip",
}: {
  accept: string;
  label: string;
  onFiles: (files: File[]) => void;
  describedBy?: string;
  disabled?: boolean;
  variant?: "default" | "outline";
  icon?: "clip" | "plus";
}) {
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
      <Button type="button" variant={variant} className="h-11 px-4" disabled={disabled} aria-describedby={describedBy} onClick={() => input.current?.click()}>
        {icon === "plus" ? <Plus className="size-4" /> : <Paperclip className="size-4" />}
        {text}
      </Button>
    </>
  );
}

export interface DocumentRowProps {
  /** Unique id base (title id = `${id}-title`). */
  id: string;
  /** `data-field` used to scroll to the row when it is missing. */
  dataField: string;
  title: string;
  /** Where to find it / what is expected: two lines, then « Voir tout ». */
  hint?: string;
  required: boolean;
  /** "Not applicable" is offered (required items that can genuinely not apply). */
  canNotApply?: boolean;
  received: boolean;
  status?: DocDeclared | null;
  /** Absent on read-only pages: no "later" / "not applicable", no "change". */
  onStatus?: (status: DocDeclared | null) => void;
  accept: string;
  onFiles: (files: File[]) => void;
  strings: DocRowStrings;
  missing?: boolean;
  missingText?: string;
  /** File list and uploads in progress. */
  children?: ReactNode;
  /** Extra content under the actions (e.g. a request template). */
  footer?: ReactNode;
}

/** One requested document: title once (green check when a file is in), hint, files, then left-aligned actions that wrap. */
export function DocumentRow({ id, dataField, title, hint, required, canNotApply = false, received, status, onStatus, accept, onFiles, strings, missing, missingText, children, footer }: DocumentRowProps) {
  const titleId = `${id}-title`;
  const [dragging, setDragging] = useState(false);
  const view = docRowView({ required, canNotApply, received, status, canDeclare: !!onStatus });
  const button = (action: DocAction) => {
    switch (action) {
      case "choose":
        return <PickFiles key={action} accept={accept} label={strings.choose} describedBy={titleId} variant="default" onFiles={onFiles} />;
      case "addFile":
        return <PickFiles key={action} accept={accept} label={strings.addFile} describedBy={titleId} icon="plus" onFiles={onFiles} />;
      case "addMore":
        return <PickFiles key={action} accept={accept} label={strings.addMore} describedBy={titleId} icon="plus" onFiles={onFiles} />;
      case "later":
      case "na":
        return (
          <Button key={action} type="button" variant="ghost" className="h-11 px-3 text-muted-foreground hover:text-foreground" aria-describedby={titleId} onClick={() => onStatus?.(action)}>
            {action === "later" ? strings.later : strings.na}
          </Button>
        );
    }
  };
  return (
    <li
      data-field={dataField}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn("flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 outline-none transition-colors", missing && "ring-2 ring-destructive/60", dragging && "border-primary bg-primary/5")}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h4 id={titleId} className="flex items-start gap-2 text-base font-medium leading-snug">
          <span className="min-w-0 break-words">
            {title}
            {!required ? <span className="ml-1.5 text-sm font-normal text-muted-foreground">{strings.optional}</span> : null}
            {received ? <span className="sr-only"> – {strings.received}</span> : null}
          </span>
          <FilledCheck filled={received} className="mt-1" />
        </h4>
        {hint ? <LongText text={hint} lines={2} showAll={strings.showAll} showLess={strings.showLess} className="text-sm text-muted-foreground" /> : null}
      </div>
      {children}
      {missing && missingText ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {missingText}
        </p>
      ) : null}
      {view.mode === "declared" ? (
        <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
          <span>{view.status === "later" ? strings.laterDone : strings.naDone}</span>
          {view.canChange ? (
            <Button type="button" variant="link" className="h-11 px-0" aria-describedby={titleId} onClick={() => onStatus?.(null)}>
              {strings.change}
            </Button>
          ) : null}
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-start gap-2">{view.actions.map(button)}</div>
      )}
      {footer}
    </li>
  );
}
