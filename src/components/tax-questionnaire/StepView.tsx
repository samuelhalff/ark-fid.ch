"use client";

import { Info, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Checkbox } from "@/src/components/ui/checkbox";
import { FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/src/components/ui/form";
import { Label } from "@/src/components/ui/label";
import { isBlockVisible, isRowFieldVisible, label as interpolate, newRowId } from "@/src/lib/tax-questionnaire/logic";
import { ROUTER_GROUPS, ROUTER_OPTIONS, rowsOf } from "@/src/lib/tax-questionnaire/schema";
import { UI, UI2 } from "@/src/lib/tax-questionnaire/ui";
import type { Answers, GroupDef, QfLocale, Row, StepDef } from "@/src/lib/tax-questionnaire/types";
import { cn } from "@/src/lib/utils";
import { FieldControl } from "./FieldControl";
import { toName } from "./form-model";

interface StepProps {
  step: StepDef;
  locale: QfLocale;
  answers: Answers;
  /** Names known from last year (renewal / extraction), shown next to "unchanged". */
  knownItems?: Record<string, string[]>;
  aiSuggestions?: Record<string, string>;
}

/** Renders the blocks of a screen; consecutive fields share a responsive two-column grid. */
export function StepView({ step, locale, answers, knownItems, aiSuggestions }: StepProps) {
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  const blocks = step.blocks.filter((b) => isBlockVisible(b, answers) && !(b.kind === "field" && b.hidden));
  const chunks: { kind: "fields" | "other"; items: typeof blocks }[] = [];
  for (const block of blocks) {
    const kind = block.kind === "field" ? "fields" : "other";
    const last = chunks[chunks.length - 1];
    if (kind === "fields" && last?.kind === "fields") last.items.push(block);
    else chunks.push({ kind, items: [block] });
  }
  return (
    <div className="flex flex-col gap-6">
      {chunks.map((chunk, index) =>
        chunk.kind === "fields" ? (
          <div key={index} className="grid gap-5 sm:grid-cols-2">
            {chunk.items.map((block) =>
              block.kind === "field" ? (
                block.id === "router.items" ? (
                  <RouterCards key={block.id} locale={locale} answers={answers} aiSuggestions={aiSuggestions} />
                ) : block.id === "router.unchanged" ? (
                  <UnchangedPicker key={block.id} locale={locale} answers={answers} knownItems={knownItems || {}} />
                ) : (
                  <FieldControl key={block.id} field={block} name={toName(block.id)} locale={locale} answers={answers} />
                )
              ) : null,
            )}
          </div>
        ) : (
          chunk.items.map((block) => {
            if (block.kind === "heading") return <h3 key={block.id} className="pt-2 text-lg font-semibold tracking-tight">{L(block.label)}</h3>;
            if (block.kind === "note")
              return (
                <Alert key={block.id} variant={block.tone === "warning" ? "destructive" : "default"}>
                  {block.tone === "warning" ? <WarningCircle className="size-4" /> : <Info className="size-4" />}
                  <AlertDescription>{L(block.text)}</AlertDescription>
                </Alert>
              );
            if (block.kind === "group") return <GroupControl key={block.id} group={block} locale={locale} answers={answers} />;
            return null;
          })
        ),
      )}
    </div>
  );
}

function GroupControl({ group, locale, answers }: { group: GroupDef; locale: QfLocale; answers: Answers }) {
  const { control, formState } = useFormContext();
  const name = toName(group.id);
  const { fields, append, remove } = useFieldArray({ control, name, keyName: "_key" });
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  const rows = rowsOf(answers, group.id);
  const error = (formState.errors as Record<string, { message?: string; root?: { message?: string } }>)[name];
  const groupMessage = error?.message || error?.root?.message;
  return (
    <section className="flex flex-col gap-3" aria-labelledby={`${name}-title`}>
      <div>
        <h3 id={`${name}-title`} className="text-lg font-semibold tracking-tight">
          {L(group.label)}
        </h3>
        {group.help ? <p className="text-sm text-muted-foreground">{L(group.help)}</p> : null}
      </div>
      {fields.map((item, index) => {
        const row = (rows[index] || { _id: "" }) as Row;
        const title = group.titleField
          ? group.titleField.split("|").map((f) => (typeof row[f] === "string" ? (row[f] as string) : "")).find(Boolean)
          : "";
        return (
          <Card key={item._key as string} className="gap-4 py-5">
            <CardHeader className="flex flex-row items-center justify-between gap-2 px-5">
              <CardTitle className="text-base">
                {L(group.itemLabel)} {index + 1}
                {title ? <span className="font-normal text-muted-foreground"> · {title}</span> : null}
              </CardTitle>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label={`${UI.remove[locale]} ${L(group.itemLabel)} ${index + 1}`}>
                <Trash className="size-4" />
                <span className="hidden sm:inline">{UI.remove[locale]}</span>
              </Button>
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
      {groupMessage ? <p className="text-sm text-destructive">{groupMessage}</p> : null}
      {fields.length < group.maxRows ? (
        <Button type="button" variant="outline" className="self-start" onClick={() => append({ _id: newRowId() })}>
          <Plus className="size-4" />
          {UI.add[locale]} · {L(group.itemLabel)}
        </Button>
      ) : null}
    </section>
  );
}

/** The router: cards grouped by area (checkbox cards composed from shadcn Card/Checkbox/Label). */
function RouterCards({ locale, answers, aiSuggestions }: { locale: QfLocale; answers: Answers; aiSuggestions?: Record<string, string> }) {
  const { control } = useFormContext();
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  return (
    <FormField
      control={control}
      name={toName("router.items")}
      render={({ field }) => {
        const current = Array.isArray(field.value) ? (field.value as string[]) : [];
        return (
          <FormItem className="sm:col-span-2">
            <div className="flex flex-col gap-6">
              {ROUTER_GROUPS.map((group) => {
                const options = ROUTER_OPTIONS.filter((o) => o.group === group.id && (!o.showIf || o.showIf(answers)));
                return (
                  <fieldset key={group.id} className="flex flex-col gap-2">
                    <legend className="mb-2 text-base font-semibold tracking-tight">{L(group.label)}</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {options.map((option) => {
                        const id = `router-${option.value}`;
                        const checked = current.includes(option.value);
                        return (
                          <Label
                            key={option.value}
                            htmlFor={id}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-xl bg-card px-4 py-3 font-normal leading-snug shadow-[inset_0_0_0_1px_rgba(20,16,14,0.08)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
                              checked && "ring-2 ring-ring/60",
                            )}
                          >
                            <Checkbox
                              id={id}
                              checked={checked}
                              className="mt-0.5"
                              onCheckedChange={(next) => field.onChange(next === true ? [...current, option.value] : current.filter((v) => v !== option.value))}
                            />
                            <span className="flex flex-col gap-0.5">
                              <span className="font-medium">{L(option.label)}</span>
                              {option.hint ? <span className="text-xs text-muted-foreground">{L(option.hint)}</span> : null}
                              {aiSuggestions?.[option.value] ? (
                                <span className="text-xs text-brand-hover">{UI2.aiSuggested[locale].replace("{reason}", aiSuggestions[option.value])}</span>
                              ) : null}
                            </span>
                          </Label>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

/** "Unchanged since last year", only next to concrete items carried over from last year. */
function UnchangedPicker({ locale, answers, knownItems }: { locale: QfLocale; answers: Answers; knownItems: Record<string, string[]> }) {
  const { control } = useFormContext();
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  const groups = ROUTER_GROUPS.filter((g) => (knownItems[g.id] || []).length > 0);
  if (!groups.length) return null;
  return (
    <FormField
      control={control}
      name={toName("router.unchanged")}
      render={({ field }) => {
        const current = Array.isArray(field.value) ? (field.value as string[]) : [];
        return (
          <FormItem className="sm:col-span-2">
            <FormLabel className="form-label">{UI2.unchangedItems[locale].replace("{items}", "")}</FormLabel>
            <FormDescription>{L({ fr: "Confirmez seulement si ces éléments sont toujours exacts ; les mêmes documents {year} vous seront demandés.", en: "Only confirm if these items are still correct; the same {year} documents will be requested.", de: "Nur bestätigen, wenn diese Angaben noch stimmen; dieselben Dokumente {year} werden angefordert." })}</FormDescription>
            <div className="grid gap-2">
              {groups.map((group) => {
                const id = `unchanged-${group.id}`;
                const checked = current.includes(group.id);
                return (
                  <Label key={group.id} htmlFor={id} className={cn("flex cursor-pointer items-start gap-3 rounded-md bg-surface-warm px-3 py-2.5 font-normal dark:bg-card", checked && "ring-2 ring-ring/50")}>
                    <Checkbox id={id} checked={checked} onCheckedChange={(next) => field.onChange(next === true ? [...current, group.id] : current.filter((v) => v !== group.id))} />
                    <span className="flex flex-col">
                      <span className="font-medium">{L(group.label)} — {UI.yes[locale]}, {locale === "fr" ? "inchangé" : locale === "de" ? "unverändert" : "unchanged"}</span>
                      <span className="text-xs text-muted-foreground">{knownItems[group.id].slice(0, 6).join(" · ")}</span>
                    </span>
                  </Label>
                );
              })}
            </div>
          </FormItem>
        );
      }}
    />
  );
}
