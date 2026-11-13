"use client";

import { Check, Info, PencilSimple, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { displayValue, fieldText, getField, isBlockAsked, validateField, isRowFieldVisible, label, newRowId, rowsOf, rowTitle } from "@/src/lib/kyc-questionnaire/engine";
import { declarations } from "@/src/lib/kyc-questionnaire/schema";
import { UI } from "@/src/lib/kyc-questionnaire/ui";
import type { Answers, Block, FieldDef, GroupDef, HeadingDef, KycLocale, NoteDef, Row, StepDef } from "@/src/lib/kyc-questionnaire/types";
import { cn } from "@/src/lib/utils";
import { FieldControl } from "./FieldControl";
import { HelpHint } from "./HelpHint";
import { toName } from "./form-model";

interface StepProps {
  step: StepDef;
  locale: KycLocale;
  answers: Answers;
  /** Ids (top-level fields and groups) pre-filled by Ark: shown as « déjà rempli, à vérifier » rows. */
  prefilled: Set<string>;
}

type Segment =
  | { kind: "fields"; items: FieldDef[] }
  /** Prefilled rows: in one card under their heading, or a single bordered row (heading null). */
  | { kind: "prefilled"; heading: HeadingDef | null; items: FieldDef[] }
  | { kind: "heading"; heading: HeadingDef }
  | { kind: "note"; note: NoteDef }
  | { kind: "group"; group: GroupDef };

const hasValue = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : v !== undefined && v !== null);
const sep = (locale: KycLocale) => (locale === "fr" ? " : " : ": ");
const PF_BOX = "rounded-lg border border-brand/30 bg-brand-soft/40 dark:bg-brand-soft/50";
const PF_LINES = "divide-y divide-brand/20";

/** Moves focus into a row once it is open, or back to its toggle once it is closed (after the render). */
function useRowFocus() {
  const pending = useRef<{ row: string; into: boolean } | null>(null);
  useEffect(() => {
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    const box = document.querySelector<HTMLElement>(`[data-row="${CSS.escape(next.row)}"]`);
    const target = next.into
      ? box?.querySelector<HTMLElement>("input:not([type=hidden]), textarea, [role=combobox], [role=checkbox]")
      : box?.querySelector<HTMLElement>("[data-row-toggle]");
    target?.focus();
  });
  return (row: string, into: boolean) => {
    pending.current = { row, into };
  };
}

/** Renders the blocks of a screen; consecutive fields share a responsive two-column grid. */
export function StepView({ step, locale, answers, prefilled }: StepProps) {
  const L = (text: Parameters<typeof label>[0]) => label(text, locale);
  const { formState, getFieldState, trigger } = useFormContext();
  // Rows shown when the screen opened stay rows while the client edits them, even emptied.
  const [initial] = useState(() => new Set([...prefilled].filter((id) => hasValue(answers[id]))));
  // A prefilled answer the form would refuse (e.g. a phone in the wrong format) opens at once.
  const [invalid] = useState(() => new Set([...prefilled].filter((id) => { const f = getField(id); return !!f && hasValue(answers[id]) && !!validateField(f, answers[id]); })));
  const [editing, setEditing] = useState<Set<string>>(() => new Set());
  const focusRow = useRowFocus();

  const isRow = (b: Block): b is FieldDef => b.kind === "field" && b.type !== "boolean" && prefilled.has(b.id) && (hasValue(answers[b.id]) || initial.has(b.id));
  const blocks = step.blocks.filter((b) => isBlockAsked(b, answers));
  const segments: Segment[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.kind === "heading") {
      const rows: FieldDef[] = [];
      const own = block.prefill?.ids ? new Set(block.prefill.ids) : null;
      while (i + 1 < blocks.length && isRow(blocks[i + 1]) && (!own || own.has(blocks[i + 1].id))) rows.push(blocks[++i] as FieldDef);
      if (rows.length) segments.push({ kind: "prefilled", heading: block, items: rows });
      else if (!block.prefill?.onlyWhenPrefilled) segments.push({ kind: "heading", heading: block });
    } else if (block.kind === "field") {
      const last = segments[segments.length - 1];
      if (isRow(block)) segments.push({ kind: "prefilled", heading: null, items: [block] });
      else if (last?.kind === "fields") last.items.push(block);
      else segments.push({ kind: "fields", items: [block] });
    } else if (block.kind === "note") segments.push({ kind: "note", note: block });
    else segments.push({ kind: "group", group: block });
  }

  const row = (field: FieldDef, solo: boolean) => {
    const name = toName(field.id);
    const open = editing.has(name) || invalid.has(field.id) || !hasValue(answers[field.id]) || !!getFieldState(name, formState).error;
    return (
      <PrefilledRow
        key={field.id}
        field={field}
        locale={locale}
        answers={answers}
        solo={solo}
        open={open}
        onOpen={() => {
          setEditing((s) => new Set(s).add(name));
          focusRow(name, true);
        }}
        onClose={async () => {
          if (!(await trigger(name))) return;
          setEditing((s) => {
            const next = new Set(s);
            next.delete(name);
            return next;
          });
          focusRow(name, false);
        }}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {segments.map((segment, index) => {
        if (segment.kind === "fields") {
          return (
            <div key={index} className="grid gap-5 sm:grid-cols-2">
              {segment.items.map((field) => (
                <FieldControl key={field.id} field={field} name={toName(field.id)} locale={locale} answers={answers} askable />
              ))}
            </div>
          );
        }
        if (segment.kind === "prefilled") {
          const { heading } = segment;
          if (!heading) {
            return (
              <div key={index} className={PF_BOX}>
                {row(segment.items[0], true)}
              </div>
            );
          }
          const note = heading.prefill?.note ? L(heading.prefill.note) : null;
          return (
            <PrefilledBox key={index} id={`${heading.id}-title`} title={L(heading.label)} locale={locale} note={note}>
              <div className={PF_LINES}>{segment.items.map((field) => row(field, false))}</div>
            </PrefilledBox>
          );
        }
        if (segment.kind === "heading") {
          const { heading } = segment;
          return heading.section ? (
            <h2 key={heading.id} className="pt-2 text-xl font-semibold tracking-tight">
              {L(heading.label)}
            </h2>
          ) : (
            <h3 key={heading.id} className="pt-2 text-lg font-semibold tracking-tight">
              {L(heading.label)}
            </h3>
          );
        }
        if (segment.kind === "note") return <Note key={segment.note.id} note={segment.note} locale={locale} answers={answers} />;
        const group = segment.group;
        return <GroupControl key={group.id} group={group} locale={locale} answers={answers} arkPrefilled={prefilled.has(group.id) && (rowsOf(answers, group.id).length > 0 || initial.has(group.id))} />;
      })}
    </div>
  );
}

/** « Déjà rempli, à vérifier »: the marker of a block of prefilled rows. */
function PrefilledBadge({ locale }: { locale: KycLocale }) {
  return (
    <Badge variant="outline" className="gap-1.5 px-0 text-brand-hover shadow-none">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
      {UI.prefilled[locale]}
    </Badge>
  );
}

/** A card of prefilled rows: its title, the badge, an optional note, then the rows. */
function PrefilledBox({ id, title, help, locale, note, children, ...rest }: { id: string; title: string; help?: ReactNode; locale: KycLocale; note?: string | null; children: ReactNode } & React.ComponentProps<"section">) {
  return (
    <section aria-labelledby={id} {...rest} className={cn(PF_BOX, "min-w-0 overflow-hidden outline-none", rest.className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 px-3 pt-3 pb-1">
        <div className="flex min-w-0 items-start gap-1">
          <h3 id={id} className="text-base leading-6 font-semibold [overflow-wrap:anywhere]">
            {title}
          </h3>
          {help}
        </div>
        <PrefilledBadge locale={locale} />
      </div>
      {note ? <p className="px-3 pb-1.5 text-sm text-muted-foreground">{note}</p> : null}
      {children}
    </section>
  );
}

/**
 * One prefilled answer, read-only (label, value, pencil) or, once the pencil is pressed, the field
 * itself at the same height (a choice becomes a Select). The value stays in the form either way.
 */
function PrefilledRow({
  field,
  locale,
  answers,
  solo,
  open,
  onOpen,
  onClose,
}: {
  field: FieldDef;
  locale: KycLocale;
  answers: Answers;
  solo: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const L = (text: Parameters<typeof label>[0]) => label(text, locale);
  const name = toName(field.id);
  const text = fieldText(field, answers);
  const fieldLabel = L(text.label);
  const raw = answers[field.id];
  const value =
    field.type === "checkboxes" && Array.isArray(raw)
      ? raw.map((v) => field.options?.find((o) => o.value === v)).filter(Boolean).map((o) => L(o!.label)).join(" · ")
      : displayValue(field, raw, locale);
  return (
    <div data-row={name} className={cn("flex min-w-0 gap-1.5 py-2 pr-1.5 pl-3", open && ["checkboxes", "textarea"].includes(field.type) ? "items-start" : "items-center")}>
      <div className="min-w-0 flex-1">
        {open ? (
          <FieldControl field={field} name={name} locale={locale} answers={answers} askable row={solo ? "solo" : "block"} />
        ) : (
          <div data-field={name} className="flex flex-col gap-1">
            <div className="flex min-w-0 items-start gap-1">
              <span className={solo ? "min-w-0 text-sm leading-5 font-medium [overflow-wrap:anywhere]" : "min-w-0 text-xs leading-4 text-muted-foreground [overflow-wrap:anywhere]"}>{fieldLabel}</span>
              {text.help ? (
                <div className={cn("flex items-center", solo ? "h-5" : "h-4")}>
                  <HelpHint text={L(text.help)} title={fieldLabel} locale={locale} />
                </div>
              ) : null}
            </div>
            <p className="flex min-h-10 items-center whitespace-pre-line [overflow-wrap:anywhere]">{value}</p>
          </div>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        data-row-toggle
        className="size-10 text-brand-hover hover:text-brand-hover"
        aria-label={`${(open ? UI.rowDone : UI.edit)[locale]}${sep(locale)}${fieldLabel}`}
        onClick={open ? onClose : onOpen}
      >
        {open ? <Check className="size-[18px]" /> : <PencilSimple className="size-[18px]" />}
      </Button>
    </div>
  );
}

/** Info / warning note; "i.declarations" shows the declarations of the client's form instead of its text. */
function Note({ note, locale, answers }: { note: NoteDef; locale: KycLocale; answers: Answers }) {
  const warning = note.tone === "warning";
  if (note.id === "i.declarations") {
    const d = declarations(answers);
    return (
      <div className="flex flex-col gap-3 rounded-md bg-surface-warm p-4 text-sm leading-6 dark:bg-card">
        <p className="font-medium">{d.intro[locale]}</p>
        <ul className="list-disc space-y-1 pl-5">
          {d.items.map((item, i) => (
            <li key={i}>{item[locale]}</li>
          ))}
        </ul>
        <p className="text-muted-foreground">{d.closing[locale]}</p>
      </div>
    );
  }
  return (
    <Alert variant={warning ? "destructive" : "default"}>
      {warning ? <WarningCircle className="size-4" /> : <Info className="size-4" />}
      <AlertDescription className="whitespace-pre-line">
        {label(note.text, locale)}
        {note.link ? (
          <>
            {" "}
            <a href={label(note.link.href, locale)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {label(note.link.label, locale)}
            </a>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/**
 * A repeating group: numbered cards titled from the row (rowTitle), within minRows / maxRows.
 * Prefilled by Ark: one card of one-line rows (name, then the other answers), each opened by « Modifier ».
 */
function GroupControl({ group, locale, answers, arkPrefilled }: { group: GroupDef; locale: KycLocale; answers: Answers; arkPrefilled?: boolean }) {
  const { control, formState, trigger } = useFormContext();
  const name = toName(group.id);
  const { fields, append, remove } = useFieldArray({ control, name, keyName: "_key" });
  const L = (text: Parameters<typeof label>[0]) => label(text, locale);
  const rows = rowsOf(answers, group.id);
  // A prefilled person with an answer missing or refused (e.g. no nationality yet) opens at once.
  const [incomplete] = useState(() => new Set(rows.filter((r) => group.fields.some((f) => isRowFieldVisible(f, answers, r) && !!validateField(f, r[f.id]))).map((r) => r._id)));
  const min = group.minRows || 0;
  const errors = (formState.errors as Record<string, unknown>)[name] as ({ message?: string; root?: { message?: string } } & Record<number, unknown>) | undefined;
  const groupMessage = errors?.message || errors?.root?.message;
  const item = L(group.itemLabel);
  const [editing, setEditing] = useState<Set<string>>(() => new Set());
  const focusRow = useRowFocus();

  // A required group starts with its first card(s) open, so the client sees what to fill in.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    for (let i = fields.length; i < min; i++) append({ _id: newRowId() }, { shouldFocus: false });
  }, [append, fields.length, min]);

  const helpHint = group.help ? <HelpHint text={L(group.help)} title={L(group.label)} locale={locale} className="mt-0.5" /> : null;
  const helpText = group.help ? (
    <p id={`${name}-help`} className="sr-only">
      {L(group.help)}
    </p>
  ) : null;
  const message = groupMessage ? (
    <p className="text-sm font-medium text-destructive" role="alert">
      {groupMessage}
    </p>
  ) : null;
  const addButton = (variant: "outline" | "ghost") =>
    fields.length < group.maxRows ? (
      <div>
        <Button type="button" variant={variant} size={variant === "ghost" ? "sm" : "default"} className={variant === "ghost" ? "-ml-2 text-brand-hover hover:text-brand-hover" : undefined} onClick={() => append({ _id: newRowId() })}>
          <Plus className="size-4" />
          {(fields.length ? UI.addAnother : UI.addRow)[locale].replace("{item}", item)}
        </Button>
      </div>
    ) : null;

  /** The fields of one row, and its remove button (a card of its own, or a part of the prefilled card). */
  const rowFields = (index: number, row: Row) =>
    group.fields
      .filter((f) => isRowFieldVisible(f, answers, row))
      .map((f) => <FieldControl key={f.id} field={f} name={`${name}.${index}.${f.id}`} locale={locale} answers={answers} />);
  const removeButton = (index: number) =>
    fields.length > min ? (
      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label={`${UI.remove[locale]} ${item} ${index + 1}`}>
        <Trash className="size-4" />
        <span className="hidden sm:inline">{UI.remove[locale]}</span>
      </Button>
    ) : null;

  if (arkPrefilled) {
    return (
      <PrefilledBox id={`${name}-title`} title={L(group.label)} help={helpHint} locale={locale} data-field={name} tabIndex={-1} aria-describedby={group.help ? `${name}-help` : undefined}>
        {helpText}
        <div className={PF_LINES}>
          {fields.map((field, index) => {
            const key = field._key as string;
            const rowKey = `${name}.${key}`;
            const row = (rows[index] || { _id: "" }) as Row;
            const title = rowTitle(group, row);
            const open = editing.has(key) || incomplete.has(row._id) || !title || !!errors?.[index];
            if (!open) {
              const summary = group.fields
                .filter((f) => !(group.titleFields || []).includes(f.id) && isRowFieldVisible(f, answers, row))
                .map((f) => displayValue(f, row[f.id], locale))
                .filter(Boolean)
                .join(" · ");
              return (
                <div key={key} data-row={rowKey} className="flex min-h-14 min-w-0 items-center gap-2 py-2 pr-1.5 pl-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium [overflow-wrap:anywhere]">{title}</p>
                    {summary ? <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{summary}</p> : null}
                  </div>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    data-row-toggle
                    className="text-brand-hover"
                    aria-label={`${UI.edit[locale]}${sep(locale)}${title}`}
                    onClick={() => {
                      setEditing((s) => new Set(s).add(key));
                      focusRow(rowKey, true);
                    }}
                  >
                    {UI.edit[locale]}
                  </Button>
                </div>
              );
            }
            return (
              <div key={key} data-row={rowKey} className="flex min-w-0 flex-col gap-4 px-3 py-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 font-medium [overflow-wrap:anywhere]">
                    {`${item} ${index + 1}`}
                    {title ? <span className="font-normal text-muted-foreground"> · {title}</span> : null}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    {removeButton(index)}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      data-row-toggle
                      className="size-10 text-brand-hover hover:text-brand-hover"
                      aria-label={`${UI.rowDone[locale]}${sep(locale)}${title || `${item} ${index + 1}`}`}
                      onClick={async () => {
                        if (!(await trigger(`${name}.${index}`))) return;
                        setEditing((s) => {
                          const next = new Set(s);
                          next.delete(key);
                          return next;
                        });
                        focusRow(rowKey, false);
                      }}
                    >
                      <Check className="size-[18px]" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">{rowFields(index, row)}</div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-col gap-2 px-3 pt-1 pb-3">
          {message}
          {addButton("ghost")}
        </div>
      </PrefilledBox>
    );
  }

  return (
    <section data-field={name} tabIndex={-1} className="flex flex-col gap-3 outline-none" aria-labelledby={`${name}-title`} aria-describedby={group.help ? `${name}-help` : undefined}>
      <div className="flex items-start gap-1">
        <h3 id={`${name}-title`} className="text-lg font-semibold tracking-tight">
          {L(group.label)}
        </h3>
        {helpHint}
        {helpText}
      </div>
      {fields.map((field, index) => {
        const row = (rows[index] || { _id: "" }) as Row;
        const title = rowTitle(group, row);
        return (
          <Card key={field._key as string} className="gap-4 py-5">
            <CardHeader className="flex flex-row items-center justify-between gap-2 px-5">
              <CardTitle className="text-base">
                {`${item} ${index + 1}`}
                {title ? <span className="font-normal text-muted-foreground"> · {title}</span> : null}
              </CardTitle>
              {removeButton(index)}
            </CardHeader>
            <CardContent className="grid gap-5 px-5 sm:grid-cols-2">{rowFields(index, row)}</CardContent>
          </Card>
        );
      })}
      {fields.length === 0 ? <p className="text-sm text-muted-foreground">{UI.noRows[locale]}</p> : null}
      {message}
      {addButton("outline")}
    </section>
  );
}
