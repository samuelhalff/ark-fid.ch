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
import { ROUTER_GROUPS, ROUTER_OPTIONS, renewalYear, rowsOf } from "@/src/lib/tax-questionnaire/schema";
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
  const blocks = step.blocks.filter((b) => isBlockVisible(b, answers) && !((b.kind === "field" || b.kind === "group") && b.hidden));
  const ark = arkPrefilledSet(answers);
  const anyArk = blocks.some((b) => (b.kind === "field" || b.kind === "group") && ark.has(b.id));
  const chunks: { kind: "fields" | "other"; items: typeof blocks }[] = [];
  for (const block of blocks) {
    const kind = block.kind === "field" ? "fields" : "other";
    const last = chunks[chunks.length - 1];
    if (kind === "fields" && last?.kind === "fields") last.items.push(block);
    else chunks.push({ kind, items: [block] });
  }
  return (
    <div className="flex flex-col gap-6">
      {anyArk ? (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>{ARK_STEP_NOTE[locale]}</AlertDescription>
        </Alert>
      ) : null}
      {chunks.map((chunk, index) =>
        chunk.kind === "fields" ? (
          <div key={index} className="grid gap-5 sm:grid-cols-2">
            {chunk.items.map((block) =>
              block.kind === "field" ? (
                block.id === "router.items" ? (
                  <RouterCards key={block.id} locale={locale} answers={answers} aiSuggestions={aiSuggestions} knownItems={knownItems || {}} />
                ) : block.id === "router.unchanged" ? null : (
                  <FieldControl key={block.id} field={block} name={toName(block.id)} locale={locale} answers={answers} arkPrefilled={ark.has(block.id)} />
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
            if (block.kind === "group") return <GroupControl key={block.id} group={block} locale={locale} answers={answers} arkPrefilled={ark.has(block.id)} />;
            return null;
          })
        ),
      )}
    </div>
  );
}

/** Ids of the questions pre-filled by Ark (prepared case). */
export const arkPrefilledSet = (answers: Answers) =>
  new Set(String(answers["start.arkPrefilled"] || "").split(/[\s,]+/).filter(Boolean));

export const ARK_PREFILLED = { fr: "Pré-rempli par Ark — à vérifier", en: "Pre-filled by Ark — please check", de: "Von Ark vorausgefüllt — bitte prüfen" };
const ARK_STEP_NOTE = {
  fr: "Ark a pré-rempli certaines réponses de cet écran à partir de vos échanges. Vérifiez chacune d'elles et corrigez ou complétez si nécessaire.",
  en: "Ark pre-filled some answers on this screen from your exchanges. Please check each of them and correct or complete them if needed.",
  de: "Ark hat einige Antworten auf dieser Seite aus Ihren Angaben vorausgefüllt. Bitte prüfen Sie jede davon und korrigieren oder ergänzen Sie sie bei Bedarf.",
};

function GroupControl({ group, locale, answers, arkPrefilled }: { group: GroupDef; locale: QfLocale; answers: Answers; arkPrefilled?: boolean }) {
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
          {arkPrefilled ? <span className="ml-2 align-middle text-xs font-medium text-brand-hover">{ARK_PREFILLED[locale]}</span> : null}
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
                .filter((f) => !f.hidden && isRowFieldVisible(f, answers, row))
                .map((f) => (
                  <FieldControl key={f.id} field={f} name={`${name}.${index}.${f.id}`} locale={locale} answers={answers} row={row} />
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
const UNCHANGED_SINCE = { fr: "Inchangé depuis {year}", en: "Unchanged since {year}", de: "Unverändert seit {year}" };
const UNCHANGED_LAST = { fr: "Inchangé depuis ma dernière déclaration", en: "Unchanged since my last return", de: "Unverändert seit meiner letzten Steuererklärung" };
const UNCHANGED_INTRO = {
  fr: "Nous avons repris votre situation {prev}. Laissez « inchangé » coché là où rien n'a changé ; décochez une rubrique pour la modifier (nouvel employeur, nouvelle banque, vente…). Les documents {year} vous seront demandés dans tous les cas.",
  en: "We carried over your {prev} situation. Leave “unchanged” ticked where nothing changed; untick an area to update it (new employer, new bank, sale…). The {year} documents will be requested in any case.",
  de: "Wir haben Ihre Situation {prev} übernommen. Lassen Sie „unverändert“ angekreuzt, wo sich nichts geändert hat; entfernen Sie das Häkchen, um einen Bereich anzupassen (neuer Arbeitgeber, neue Bank, Verkauf…). Die Dokumente {year} werden in jedem Fall angefordert.",
};

function RouterCards({ locale, answers, aiSuggestions, knownItems }: { locale: QfLocale; answers: Answers; aiSuggestions?: Record<string, string>; knownItems: Record<string, string[]> }) {
  const { control, setValue } = useFormContext();
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  const prev = renewalYear(answers);
  const unchangedNow = Array.isArray(answers["router.unchanged"]) ? (answers["router.unchanged"] as string[]) : [];
  const anyKnown = ROUTER_GROUPS.some((g) => (knownItems[g.id] || []).length > 0);
  const setUnchanged = (groupId: string, on: boolean) =>
    setValue(toName("router.unchanged"), on ? [...unchangedNow.filter((g) => g !== groupId), groupId] : unchangedNow.filter((g) => g !== groupId), { shouldDirty: true });
  return (
    <FormField
      control={control}
      name={toName("router.items")}
      render={({ field }) => {
        const current = Array.isArray(field.value) ? (field.value as string[]) : [];
        return (
          <FormItem className="sm:col-span-2">
            {anyKnown ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {UNCHANGED_INTRO[locale].replace("{prev}", prev || "").replace("{year}", L({ fr: "{year}", en: "{year}", de: "{year}" }))}
              </p>
            ) : null}
            <div className="flex flex-col gap-6">
              {ROUTER_GROUPS.map((group) => {
                const options = ROUTER_OPTIONS.filter((o) => o.group === group.id && (!o.showIf || o.showIf(answers)));
                const known = knownItems[group.id] || [];
                const isUnchanged = known.length > 0 && unchangedNow.includes(group.id);
                const unchangedId = `unchanged-${group.id}`;
                return (
                  <fieldset key={group.id} className="flex flex-col gap-2">
                    <legend className="mb-2 text-base font-semibold tracking-tight">{L(group.label)}</legend>
                    {known.length ? (
                      <Label
                        htmlFor={unchangedId}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-xl bg-surface-warm px-4 py-3 font-normal leading-snug shadow-[inset_0_0_0_1px_rgba(20,16,14,0.08)] dark:bg-card dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
                          isUnchanged && "ring-2 ring-ring/60",
                        )}
                      >
                        <Checkbox
                          id={unchangedId}
                          checked={isUnchanged}
                          className="mt-0.5 shadow-[inset_0_0_0_1px_rgba(20,16,14,0.28)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)]"
                          onCheckedChange={(next) => setUnchanged(group.id, next === true)}
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="font-medium">{prev ? UNCHANGED_SINCE[locale].replace("{year}", prev) : UNCHANGED_LAST[locale]}</span>
                          <span className="text-sm text-muted-foreground">{known.join(" · ")}</span>
                        </span>
                      </Label>
                    ) : null}
                    <div className={cn("grid gap-2 sm:grid-cols-2", isUnchanged && "hidden")}>
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
                              className="shadow-[inset_0_0_0_1px_rgba(20,16,14,0.28)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)] mt-0.5"
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
