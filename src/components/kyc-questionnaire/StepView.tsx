"use client";

import { Info, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { isBlockVisible, isRowFieldVisible, label, newRowId, rowsOf, rowTitle } from "@/src/lib/kyc-questionnaire/engine";
import { declarations } from "@/src/lib/kyc-questionnaire/schema";
import { UI } from "@/src/lib/kyc-questionnaire/ui";
import type { Answers, GroupDef, KycLocale, NoteDef, Row, StepDef } from "@/src/lib/kyc-questionnaire/types";
import { FieldControl } from "./FieldControl";
import { toName } from "./form-model";

interface StepProps {
  step: StepDef;
  locale: KycLocale;
  answers: Answers;
  /** Ids (top-level fields and groups) pre-filled by Ark: marked "to check". */
  prefilled: Set<string>;
}

/** Renders the blocks of a screen; consecutive fields share a responsive two-column grid. */
export function StepView({ step, locale, answers, prefilled }: StepProps) {
  const L = (text: Parameters<typeof label>[0]) => label(text, locale);
  const blocks = step.blocks.filter((b) => isBlockVisible(b, answers));
  const anyPrefilled = blocks.some((b) => (b.kind === "field" || b.kind === "group") && prefilled.has(b.id));
  const chunks: { kind: "fields" | "other"; items: typeof blocks }[] = [];
  for (const block of blocks) {
    const kind = block.kind === "field" ? "fields" : "other";
    const last = chunks[chunks.length - 1];
    if (kind === "fields" && last?.kind === "fields") last.items.push(block);
    else chunks.push({ kind, items: [block] });
  }
  return (
    <div className="flex flex-col gap-6">
      {anyPrefilled ? (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>{UI.prefilledStep[locale]}</AlertDescription>
        </Alert>
      ) : null}
      {chunks.map((chunk, index) =>
        chunk.kind === "fields" ? (
          <div key={index} className="grid gap-5 sm:grid-cols-2">
            {chunk.items.map((block) =>
              block.kind === "field" ? <FieldControl key={block.id} field={block} name={toName(block.id)} locale={locale} answers={answers} arkPrefilled={prefilled.has(block.id)} /> : null,
            )}
          </div>
        ) : (
          chunk.items.map((block) => {
            if (block.kind === "heading") return <h3 key={block.id} className="pt-2 text-lg font-semibold tracking-tight">{L(block.label)}</h3>;
            if (block.kind === "note") return <Note key={block.id} note={block} locale={locale} answers={answers} />;
            if (block.kind === "group") return <GroupControl key={block.id} group={block} locale={locale} answers={answers} arkPrefilled={prefilled.has(block.id)} />;
            return null;
          })
        ),
      )}
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
      <AlertDescription className="whitespace-pre-line">{label(note.text, locale)}</AlertDescription>
    </Alert>
  );
}

/** A repeating group: numbered cards titled from the row (rowTitle), within minRows / maxRows. */
function GroupControl({ group, locale, answers, arkPrefilled }: { group: GroupDef; locale: KycLocale; answers: Answers; arkPrefilled?: boolean }) {
  const { control, formState } = useFormContext();
  const name = toName(group.id);
  const { fields, append, remove } = useFieldArray({ control, name, keyName: "_key" });
  const L = (text: Parameters<typeof label>[0]) => label(text, locale);
  const rows = rowsOf(answers, group.id);
  const min = group.minRows || 0;
  const errors = (formState.errors as Record<string, unknown>)[name] as ({ message?: string; root?: { message?: string } } & Record<number, unknown>) | undefined;
  const groupMessage = errors?.message || errors?.root?.message;
  const item = L(group.itemLabel);

  // A required group starts with its first card(s) open, so the client sees what to fill in.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    for (let i = fields.length; i < min; i++) append({ _id: newRowId() }, { shouldFocus: false });
  }, [append, fields.length, min]);

  return (
    <section data-field={name} tabIndex={-1} className="flex flex-col gap-3 outline-none" aria-labelledby={`${name}-title`}>
      <div>
        <h3 id={`${name}-title`} className="text-lg font-semibold tracking-tight">
          {L(group.label)}
          {arkPrefilled ? <span className="ml-2 align-middle text-xs font-medium text-brand-hover">{UI.prefilled[locale]}</span> : null}
        </h3>
        {group.help ? <p className="text-sm text-muted-foreground">{L(group.help)}</p> : null}
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
              {fields.length > min ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label={`${UI.remove[locale]} ${item} ${index + 1}`}>
                  <Trash className="size-4" />
                  <span className="hidden sm:inline">{UI.remove[locale]}</span>
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="grid gap-5 px-5 sm:grid-cols-2">
              {group.fields
                .filter((f) => isRowFieldVisible(f, answers, row))
                .map((f) => (
                  <FieldControl key={f.id} field={f} name={`${name}.${index}.${f.id}`} locale={locale} answers={answers} />
                ))}
            </CardContent>
          </Card>
        );
      })}
      {fields.length === 0 ? <p className="text-sm text-muted-foreground">{UI.noRows[locale]}</p> : null}
      {groupMessage ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {groupMessage}
        </p>
      ) : null}
      {fields.length < group.maxRows ? (
        <div>
          <Button type="button" variant="outline" onClick={() => append({ _id: newRowId() })}>
            <Plus className="size-4" />
            {(fields.length ? UI.addAnother : UI.addRow)[locale].replace("{item}", item)}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
