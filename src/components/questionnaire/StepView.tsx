"use client";

import { Check, Info, PencilSimple, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { useFieldArray, useFormContext, type UseFormSetValue, type FieldValues } from "react-hook-form";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { rowsIn, toName, type AnyAnswers, type AnyRow } from "@/src/lib/questionnaire/form-values";
import { segmentBlocks, type FieldBlock } from "@/src/lib/questionnaire/segments";
import { cn } from "@/src/lib/utils";
import { FieldControl } from "./FieldControl";
import { FilledCheck } from "./FilledCheck";
import { HelpHint } from "./HelpHint";
import { useKit, fill, type KitBlock, type KitField, type KitGroup, type KitHeading, type KitNote } from "./kit";
import { LongText } from "./LongText";
import { NameChoices } from "./NameChoices";


/** What a form adds to one of its groups (tax: the items carried over from last year). */
export interface GroupExtras {
  /** A row shown its own way: its title, whether it can be removed, controls above its fields, its fields shown or not. */
  row?: (row: AnyRow, index: number) => { title: ReactNode; removable: boolean; top?: ReactNode; expanded: boolean } | undefined;
  /** The add button's words, instead of « Ajouter : {item} ». */
  addLabel?: string;
  /** After a row was added. */
  onAdd?: () => void;
  /** Buttons before the add button. */
  actions?: ReactNode;
  /** A line under the buttons. */
  after?: ReactNode;
}

/** What a form's GroupExtras may read and do. */
export interface GroupContext {
  name: string;
  rows: AnyRow[];
  /** react-hook-form errors of each row. */
  rowErrors: (index: number) => Record<string, unknown>;
  setValue: UseFormSetValue<FieldValues>;
}

export interface StepViewProps {
  /** The screen's blocks asked for these answers, in order (the form filters them). */
  blocks: KitBlock[];
  answers: AnyAnswers;
  /** Ids (top-level fields and groups) pre-filled by Ark: shown as « déjà rempli, à vérifier » rows. */
  prefilled?: Set<string>;
  /** A block the form renders itself (KYC holders, tax router cards…); undefined for the shared rendering. */
  renderBlock?: (block: KitBlock) => ReactNode | undefined;
  /** Something under a heading (KYC: the contact person picked among the people above). */
  headingExtra?: (heading: KitHeading) => ReactNode;
  /** A top-level field by id (a prefilled answer may sit on a block not shown yet). */
  fieldOf?: (id: string) => KitField | undefined;
  /** What the form adds to a group. */
  groupExtras?: (group: KitGroup, context: GroupContext) => GroupExtras | undefined;
}

const hasValue = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : v !== undefined && v !== null);
const sep = (locale: string) => (locale === "fr" ? " : " : ": ");
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

/** Renders the blocks of a screen (KYC or tax); consecutive fields share a responsive two-column grid. */
export function StepView({ blocks, answers, prefilled = new Set(), renderBlock, headingExtra, fieldOf, groupExtras }: StepViewProps) {
  const kit = useKit();
  const L = (text: Parameters<typeof kit.t>[0]) => kit.t(text, answers);
  const { formState, getFieldState, trigger } = useFormContext();
  // Rows shown when the screen opened stay rows while the client edits them, even emptied.
  const [initial] = useState(() => new Set([...prefilled].filter((id) => hasValue(answers[id]))));
  // A prefilled answer the form would refuse (e.g. a phone in the wrong format) opens at once.
  const [invalid] = useState(
    () =>
      new Set(
        [...prefilled].filter((id) => {
          const f = fieldOf?.(id) ?? blocks.find((b): b is FieldBlock => b.kind === "field" && b.id === id);
          return !!f && hasValue(answers[id]) && !!kit.validate(f, answers[id]);
        }),
      ),
  );
  const [editing, setEditing] = useState<Set<string>>(() => new Set());
  const focusRow = useRowFocus();

  const isRow = (b: KitBlock) => b.kind === "field" && b.type !== "boolean" && prefilled.has(b.id) && (hasValue(answers[b.id]) || initial.has(b.id));
  const segments = segmentBlocks(blocks, isRow);

  const row = (field: FieldBlock, solo: boolean) => {
    const name = toName(field.id);
    const open = editing.has(name) || invalid.has(field.id) || !hasValue(answers[field.id]) || !!getFieldState(name, formState).error;
    return (
      <PrefilledRow
        key={field.id}
        field={field}
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
              {segment.items.map((field) => {
                const own = renderBlock?.(field);
                if (own !== undefined) return <Fragment key={field.id}>{own}</Fragment>;
                return <FieldControl key={field.id} field={field} name={toName(field.id)} answers={answers} askable />;
              })}
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
          const note = heading.prefill?.note ? L(heading.prefill.note) : heading.help ? L(heading.help) : null;
          return (
            <PrefilledBox key={index} id={`${heading.id}-title`} title={L(heading.label)} note={note}>
              <div className={PF_LINES}>{segment.items.map((field) => row(field, false))}</div>
            </PrefilledBox>
          );
        }
        const block = segment.kind === "heading" ? segment.heading : segment.kind === "note" ? segment.note : segment.group;
        const own = renderBlock?.(block);
        if (own !== undefined) return <Fragment key={block.id}>{own}</Fragment>;
        if (segment.kind === "heading") {
          const { heading } = segment;
          return heading.section ? (
            <h2 key={heading.id} className="pt-2 text-xl font-semibold tracking-tight">
              {L(heading.label)}
            </h2>
          ) : (
            <div key={heading.id} className="flex flex-col gap-1 pt-2">
              <h3 className="text-lg font-semibold tracking-tight">{L(heading.label)}</h3>
              {heading.help ? <p className="text-sm text-muted-foreground">{L(heading.help)}</p> : null}
              {headingExtra?.(heading)}
            </div>
          );
        }
        if (segment.kind === "note") return <Note key={segment.note.id} note={segment.note} answers={answers} />;
        const group = segment.group;
        return (
          <GroupControl
            key={group.id}
            group={group}
            answers={answers}
            prefilled={prefilled.has(group.id) && (rowsIn(answers, group.id).length > 0 || initial.has(group.id))}
            extras={groupExtras}
          />
        );
      })}
    </div>
  );
}

/** « Déjà rempli, à vérifier »: the marker of a block of prefilled rows. */
function PrefilledBadge() {
  const { strings } = useKit();
  return (
    <Badge variant="outline" className="gap-1.5 px-0 text-brand-hover shadow-none">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
      {strings.prefilled}
    </Badge>
  );
}

/** A card of prefilled rows: its title, the badge, an optional note, then the rows. */
function PrefilledBox({ id, title, help, note, children, ...rest }: { id: string; title: string; help?: ReactNode; note?: string | null; children: ReactNode } & React.ComponentProps<"section">) {
  return (
    <section aria-labelledby={id} {...rest} className={cn(PF_BOX, "min-w-0 overflow-hidden outline-none", rest.className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 px-3 pt-3 pb-1">
        <div className="flex min-w-0 items-start gap-1">
          <h3 id={id} className="text-base leading-6 font-semibold [overflow-wrap:anywhere]">
            {title}
          </h3>
          {help}
        </div>
        <PrefilledBadge />
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
function PrefilledRow({ field, answers, solo, open, onOpen, onClose }: { field: KitField; answers: AnyAnswers; solo: boolean; open: boolean; onOpen: () => void; onClose: () => void }) {
  const kit = useKit();
  const L = (text: Parameters<typeof kit.t>[0]) => kit.t(text, answers);
  const name = toName(field.id);
  const text = kit.fieldText(field, answers);
  const fieldLabel = L(text.label);
  const raw = answers[field.id];
  const value =
    field.type === "checkboxes" && Array.isArray(raw)
      ? raw.map((v) => field.options?.find((o) => o.value === v)).filter(Boolean).map((o) => L(o!.label)).join(" · ")
      : kit.displayValue(field, raw, answers);
  return (
    <div data-row={name} className={cn("flex min-w-0 gap-1.5 py-2 pr-1.5 pl-3", open && ["checkboxes", "textarea"].includes(field.type) ? "items-start" : "items-center")}>
      <div className="min-w-0 flex-1">
        {open ? (
          <FieldControl field={field} name={name} answers={answers} askable layout={solo ? "solo" : "block"} />
        ) : (
          <div data-field={name} className="flex flex-col gap-1">
            <div className="flex min-w-0 items-start gap-1">
              <span className={solo ? "min-w-0 text-sm leading-5 font-medium [overflow-wrap:anywhere]" : "min-w-0 text-xs leading-4 text-muted-foreground [overflow-wrap:anywhere]"}>{fieldLabel}</span>
              {text.help ? (
                <div className={cn("flex items-center", solo ? "h-5" : "h-4")}>
                  <HelpHint text={L(text.help)} title={fieldLabel} />
                </div>
              ) : null}
              <div className={cn("flex items-center", solo ? "h-5" : "h-4")}>
                <FilledCheck filled={kit.isFilled(field, raw)} />
              </div>
            </div>
            <LongText text={value} showAll={kit.strings.showAll} showLess={kit.strings.showLess} className="min-h-10 justify-center" />
          </div>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        data-row-toggle
        className="size-10 text-brand-hover hover:text-brand-hover"
        aria-label={`${open ? kit.strings.rowDone : kit.strings.edit}${sep(kit.locale)}${fieldLabel}`}
        onClick={open ? onClose : onOpen}
      >
        {open ? <Check className="size-[18px]" /> : <PencilSimple className="size-[18px]" />}
      </Button>
    </div>
  );
}

/** Info / warning note, with an optional link after its text. */
function Note({ note, answers }: { note: KitNote; answers: AnyAnswers }) {
  const kit = useKit();
  const L = (text: Parameters<typeof kit.t>[0]) => kit.t(text, answers);
  const warning = note.tone === "warning";
  return (
    <Alert variant={warning ? "destructive" : "default"}>
      {warning ? <WarningCircle className="size-4" /> : <Info className="size-4" />}
      <AlertDescription className="whitespace-pre-line">
        {L(note.text)}
        {note.link ? (
          <>
            {" "}
            <a href={L(note.link.href)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {L(note.link.label)}
            </a>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

/**
 * A repeating group: numbered cards titled from the row, within minRows / maxRows (a required group
 * starts with its first card(s) open). Prefilled by Ark: one card of one-line rows (name, then the
 * other answers), each opened by « Modifier ». A form may show some rows its own way (GroupExtras).
 */
function GroupControl({ group, answers, prefilled, extras: extrasOf }: { group: KitGroup; answers: AnyAnswers; prefilled?: boolean; extras?: StepViewProps["groupExtras"] }) {
  const kit = useKit();
  const S = kit.strings;
  const L = (text: Parameters<typeof kit.t>[0]) => kit.t(text, answers);
  const { control, formState, trigger, setValue } = useFormContext();
  const name = toName(group.id);
  const { fields, append, remove, update } = useFieldArray({ control, name, keyName: "_key" });
  const rows = rowsIn(answers, group.id);
  // A prefilled person with an answer missing or refused (e.g. no nationality yet) opens at once.
  const [incomplete] = useState(() => new Set(rows.filter((r) => group.fields.some((f) => kit.rowFieldVisible(f, answers, r) && !!kit.validate(f, r[f.id]))).map((r) => r._id)));
  const min = group.minRows || 0;
  const errors = (formState.errors as Record<string, unknown>)[name] as ({ message?: string; root?: { message?: string } } & Record<number, Record<string, unknown> | undefined>) | undefined;
  const groupMessage = errors?.message || errors?.root?.message;
  const item = L(group.itemLabel);
  const [editing, setEditing] = useState<Set<string>>(() => new Set());
  const focusRow = useRowFocus();
  const extras = extrasOf?.(group, { name, rows, rowErrors: (index) => errors?.[index] || {}, setValue });

  // A required group starts with its first card(s) open, so the client sees what to fill in.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    for (let i = fields.length; i < min; i++) append({ _id: kit.newRowId() }, { shouldFocus: false });
  }, [append, fields.length, min, kit]);

  const helpHint = group.help ? <HelpHint text={L(group.help)} title={L(group.label)} className="mt-0.5" /> : null;
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
      <Button
        type="button"
        variant={variant}
        size={variant === "ghost" ? "sm" : "default"}
        className={variant === "ghost" ? "-ml-2 text-brand-hover hover:text-brand-hover" : "h-auto min-h-9 max-w-full py-2 text-left whitespace-normal [overflow-wrap:anywhere]"}
        onClick={() => {
          append({ _id: kit.newRowId() });
          extras?.onAdd?.();
        }}
      >
        <Plus className="size-4" />
        <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{extras?.addLabel || fill(fields.length ? S.addAnother : S.addRow, { item })}</span>
      </Button>
    ) : null;

  /** The fields of one row: first the names given above (one tap), then its questions. */
  const rowFields = (index: number, row: AnyRow) => {
    const reuse = kit.reuse?.(group, row, answers);
    return [
      reuse?.choices.length ? (
        <NameChoices
          key="choices"
          choices={reuse.choices}
          other={S.otherPerson}
          onPick={(key) => {
            const next = reuse.pick(key);
            if (next) update(index, next);
          }}
        />
      ) : null,
      ...group.fields.filter((f) => kit.rowFieldVisible(f, answers, row)).map((f) => <FieldControl key={f.id} field={f} name={`${name}.${index}.${f.id}`} answers={answers} row={row} />),
    ];
  };
  const removeButton = (index: number) =>
    fields.length > min ? (
      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label={`${S.remove} ${item} ${index + 1}`}>
        <Trash className="size-4" />
        <span className="hidden sm:inline">{S.remove}</span>
      </Button>
    ) : null;

  if (prefilled) {
    return (
      <PrefilledBox id={`${name}-title`} title={L(group.label)} help={helpHint} data-field={name} tabIndex={-1} aria-describedby={group.help ? `${name}-help` : undefined}>
        {helpText}
        <div className={PF_LINES}>
          {fields.map((field, index) => {
            const key = field._key as string;
            const rowKey = `${name}.${key}`;
            const row = (rows[index] || { _id: "" }) as AnyRow;
            const title = kit.rowTitle(group, row);
            const open = editing.has(key) || incomplete.has(row._id) || !title || !!errors?.[index];
            if (!open) {
              const titleFields = new Set((group as { titleFields?: string[] }).titleFields || []);
              const summary = group.fields
                .filter((f) => !titleFields.has(f.id) && kit.rowFieldVisible(f, answers, row))
                .map((f) => kit.displayValue(f, row[f.id], answers))
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
                    aria-label={`${S.edit}${sep(kit.locale)}${title}`}
                    onClick={() => {
                      setEditing((s) => new Set(s).add(key));
                      focusRow(rowKey, true);
                    }}
                  >
                    {S.edit}
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
                      aria-label={`${S.rowDone}${sep(kit.locale)}${title || `${item} ${index + 1}`}`}
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
          <div>{addButton("ghost")}</div>
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
        const row = (rows[index] || { _id: "" }) as AnyRow;
        const title = kit.rowTitle(group, row);
        const own = extras?.row?.(row, index);
        const expanded = own ? own.expanded : true;
        return (
          <Card key={field._key as string} className={cn("gap-4", own && !expanded ? "py-4" : "py-5")}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 px-5">
              <CardTitle className="text-base">
                {own ? (
                  own.title
                ) : (
                  <>
                    {`${item} ${index + 1}`}
                    {title ? <span className="font-normal text-muted-foreground"> · {title}</span> : null}
                  </>
                )}
              </CardTitle>
              {own && !own.removable ? null : removeButton(index)}
            </CardHeader>
            {own?.top ? <CardContent className="flex flex-col gap-3 px-5">{own.top}</CardContent> : null}
            {expanded ? <CardContent className="grid gap-5 px-5 sm:grid-cols-2">{rowFields(index, row)}</CardContent> : null}
          </Card>
        );
      })}
      {fields.length === 0 ? <p className="text-sm text-muted-foreground">{S.noRows}</p> : null}
      {message}
      <div className="flex flex-wrap items-center gap-2">
        {extras?.actions}
        {addButton("outline")}
      </div>
      {extras?.after}
    </section>
  );
}
