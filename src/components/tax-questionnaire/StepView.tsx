"use client";

import { Info, Plus, Trash, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Checkbox } from "@/src/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import { FormField, FormItem, FormMessage } from "@/src/components/ui/form";
import { Label } from "@/src/components/ui/label";
import { isBlockVisible, isRowFieldVisible, isStepVisible, label as interpolate, newRowId } from "@/src/lib/tax-questionnaire/logic";
import { ROUTER_GROUPS, ROUTER_OPTIONS, renewalYear, rowsOf, STEPS } from "@/src/lib/tax-questionnaire/schema";
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

/** Renewal wording per group (fr), with generic fallbacks; en/de stay generic. */
const KEPT: Record<string, string> = {
  "assets.banks": "Toujours ouvert en {year}",
  "property.items": "Toujours propriétaire en {year}",
  "family.children": "Toujours à charge en {year}",
  "family.dependants": "Toujours à charge en {year}",
  "assets.debts": "Toujours en cours en {year}",
  "assets.loans": "Toujours en cours en {year}",
  "work.companies": "Toujours détenue en {year}",
  "assets.vehicles": "Toujours détenu en {year}",
  "assets.valuables": "Toujours détenu en {year}",
  "assets.crypto": "Toujours détenu en {year}",
};
const ENDED: Record<string, string> = {
  "assets.banks": "Clôturé en {year}",
  "property.items": "Vendu en {year}",
  "family.children": "Plus à charge en {year}",
  "family.dependants": "Plus à charge en {year}",
  "assets.debts": "Remboursé en {year}",
  "assets.loans": "Remboursé en {year}",
  "work.companies": "Vendue ou liquidée en {year}",
  "assets.insurances": "Résiliée ou échue en {year}",
  "assets.vehicles": "Vendu en {year}",
  "assets.valuables": "Vendu en {year}",
  "assets.crypto": "Clôturé ou vendu en {year}",
};
const ADD: Record<string, string> = {
  "assets.banks": "Ajouter un nouveau compte ou établissement",
  "work.employers": "Ajouter un nouvel employeur",
  "property.items": "Ajouter un bien (achat, héritage…)",
  "family.children": "Ajouter un enfant",
  "family.dependants": "Ajouter une personne à charge",
  "assets.debts": "Ajouter un nouveau prêt ou crédit",
  "assets.loans": "Ajouter un nouveau prêt accordé",
  "assets.insurances": "Ajouter une assurance",
  "work.pensions": "Ajouter une rente",
  "work.companies": "Ajouter une société",
};
const R = {
  kept: { fr: "Toujours là en {year}", en: "Still there in {year}", de: "Weiterhin im Jahr {year}" },
  ended: { fr: "Terminé en {year}", en: "Ended in {year}", de: "Beendet im Jahr {year}" },
  changed: { fr: "Modifié", en: "Changed", de: "Geändert" },
  endedOn: { fr: "Date", en: "Date", de: "Datum" },
  same: { fr: "Tout est identique à {prev}", en: "Everything is as in {prev}", de: "Alles wie {prev}" },
  sameDone: { fr: "Tout est identique à {prev}, aucun nouvel élément.", en: "Everything is as in {prev}, nothing new.", de: "Alles wie {prev}, nichts Neues." },
  addOther: { fr: "Ajouter un autre élément : {item}", en: "Add another: {item}", de: "Weiteres hinzufügen: {item}" },
  add: { fr: "Ajouter : {item}", en: "Add: {item}", de: "Hinzufügen: {item}" },
  carried: { fr: "Repris de {prev}", en: "From {prev}", de: "Aus {prev}" },
};

function GroupControl({ group, locale, answers, arkPrefilled }: { group: GroupDef; locale: QfLocale; answers: Answers; arkPrefilled?: boolean }) {
  const { control, formState, setValue } = useFormContext();
  const name = toName(group.id);
  const { fields, append, remove } = useFieldArray({ control, name, keyName: "_key" });
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  const year = L({ fr: "{year}", en: "{year}", de: "{year}" });
  const rows = rowsOf(answers, group.id);
  const errors = (formState.errors as Record<string, unknown>)[name] as ({ message?: string; root?: { message?: string } } & Record<number, Record<string, unknown> | undefined>) | undefined;
  const groupMessage = errors?.message || errors?.root?.message;
  const carriedRows = rows.filter((r) => r.carried);
  const prev = String(carriedRows[0]?.carried || "");
  const sameAs = String(answers["router.sameAs"] || "").split(/[\s,]+/).filter(Boolean);
  const isSame = sameAs.includes(group.id);
  const setSameAs = (on: boolean) => {
    const next = on ? [...new Set([...sameAs, group.id])] : sameAs.filter((g) => g !== group.id);
    setValue(toName("router.sameAs"), next.join(", ") || undefined, { shouldDirty: true });
  };
  const allIdentical = () => {
    rows.forEach((row, index) => {
      if (row.carried) setValue(`${name}.${index}.renewal`, "kept", { shouldDirty: true, shouldValidate: !!errors?.[index] });
    });
    setSameAs(true);
  };
  const addRow = () => {
    append({ _id: newRowId() });
    if (isSame) setSameAs(false);
  };
  const fieldOf = (id: string) => group.fields.find((f) => f.id === id);
  const fr = locale === "fr";
  const keptLabel = (fr && KEPT[group.id]) || R.kept[locale];
  const endedLabel = (fr && ENDED[group.id]) || R.ended[locale];
  const addLabel = carriedRows.length && fr && ADD[group.id] ? ADD[group.id] : (rows.length ? R.addOther : R.add)[locale].replace("{item}", L(group.itemLabel));
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
        const carried = !!row.carried;
        const rowErrors = errors?.[index] || {};
        // A carried item stays compact unless changed, or something carried over needs fixing.
        const detailErrors = Object.keys(rowErrors).some((k) => k !== "renewal" && k !== "endedOn");
        const expanded = !carried || row.renewal === "changed" || detailErrors;
        const endedField = fieldOf("endedOn");
        return (
          <Card key={item._key as string} className={cn("gap-4", carried && !expanded ? "py-4" : "py-5")}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 px-5">
              <CardTitle className="text-base">
                {carried ? title || `${L(group.itemLabel)} ${index + 1}` : `${L(group.itemLabel)} ${index + 1}`}
                {!carried && title ? <span className="font-normal text-muted-foreground"> · {title}</span> : null}
                {carried ? <span className="ml-2 text-xs font-normal text-muted-foreground">{R.carried[locale].replace("{prev}", String(row.carried))}</span> : null}
              </CardTitle>
              {!carried ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} aria-label={`${UI.remove[locale]} ${L(group.itemLabel)} ${index + 1}`}>
                  <Trash className="size-4" />
                  <span className="hidden sm:inline">{UI.remove[locale]}</span>
                </Button>
              ) : null}
            </CardHeader>
            {carried ? (
              <CardContent className="flex flex-col gap-3 px-5">
                <FormField
                  control={control}
                  name={`${name}.${index}.renewal`}
                  render={({ field: f, fieldState }) => (
                    <FormItem data-field={`${name}.${index}.renewal`} className="!flex flex-col items-start">
                      <ToggleGroup
                        type="single"
                        variant="outline"
                        className={cn("flex-wrap !justify-start", fieldState.error && "rounded-md ring-2 ring-destructive/60")}
                        value={typeof f.value === "string" ? f.value : ""}
                        onValueChange={(next) => {
                          f.onChange(next || undefined);
                          if (next && next !== "kept" && isSame) setSameAs(false);
                        }}
                        aria-label={`${title || L(group.itemLabel)} – ${year}`}
                      >
                        <ToggleGroupItem value="kept" className="px-3">{keptLabel.replace("{year}", year)}</ToggleGroupItem>
                        <ToggleGroupItem value="ended" className="px-3">{endedLabel.replace("{year}", year)}</ToggleGroupItem>
                        <ToggleGroupItem value="changed" className="px-3">{R.changed[locale]}</ToggleGroupItem>
                      </ToggleGroup>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {row.renewal === "ended" && endedField ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FieldControl field={{ ...endedField, hidden: false, width: "half", label: { fr: R.endedOn.fr, en: R.endedOn.en, de: R.endedOn.de } }} name={`${name}.${index}.endedOn`} locale={locale} answers={answers} row={row} />
                  </div>
                ) : null}
              </CardContent>
            ) : null}
            {expanded ? (
              <CardContent className="grid gap-5 px-5 sm:grid-cols-2">
                {group.fields
                  .filter((f) => !f.hidden && isRowFieldVisible(f, answers, row))
                  .map((f) => (
                    <FieldControl key={f.id} field={f} name={`${name}.${index}.${f.id}`} locale={locale} answers={answers} row={row} />
                  ))}
              </CardContent>
            ) : null}
          </Card>
        );
      })}
      {fields.length === 0 ? <p className="text-sm text-muted-foreground">{UI.noRows[locale]}</p> : null}
      {groupMessage ? <p className="text-sm text-destructive">{groupMessage}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {carriedRows.length ? (
          <Button type="button" variant={isSame ? "secondary" : "outline"} onClick={allIdentical}>
            {R.same[locale].replace("{prev}", prev)}
          </Button>
        ) : null}
        {fields.length < group.maxRows ? (
          <Button type="button" variant="outline" onClick={addRow}>
            <Plus className="size-4" />
            {addLabel}
          </Button>
        ) : null}
      </div>
      {isSame && !rows.some((r) => !r.carried) ? <p className="text-sm text-muted-foreground">{R.sameDone[locale].replace("{prev}", prev)}</p> : null}
    </section>
  );
}

/** The router: cards grouped by area (checkbox cards composed from shadcn Card/Checkbox/Label). */
const KEEP_AREA = {
  fr: "Des éléments repris de {prev} en dépendent : indiquez plutôt « terminé » pour chacun à l'écran suivant.",
  en: "Items carried over from {prev} depend on it: mark each of them as “ended” on the next screens instead.",
  de: "Davon hängen Elemente aus {prev} ab: Markieren Sie sie stattdessen auf den nächsten Seiten als „beendet“.",
};

/** Would these router items hide a group holding rows carried over from last year? */
function hidesCarried(answers: Answers, items: string[]): boolean {
  const next = { ...answers, "router.items": items };
  return STEPS.some((step) =>
    step.blocks.some((b) => b.kind === "group" && rowsOf(answers, b.id).some((r) => r.carried) && !(isStepVisible(step, next) && isBlockVisible(b, next))),
  );
}

const CARRIED_FROM = { fr: "Repris de {prev} :", en: "Carried over from {prev}:", de: "Übernommen aus {prev}:" };
const RENEWAL_INTRO = {
  fr: "Nous avons repris votre situation {prev}. Cochez aussi ce qui est nouveau en {year}. Aux écrans suivants, vous confirmerez chaque élément : toujours là, terminé ou modifié.",
  en: "We carried over your {prev} situation. Also tick what is new in {year}. On the next screens you will confirm each item: still there, ended or changed.",
  de: "Wir haben Ihre Situation {prev} übernommen. Kreuzen Sie auch an, was {year} neu ist. Auf den nächsten Seiten bestätigen Sie jedes Element: weiterhin, beendet oder geändert.",
};

function RouterCards({ locale, answers, aiSuggestions, knownItems }: { locale: QfLocale; answers: Answers; aiSuggestions?: Record<string, string>; knownItems: Record<string, string[]> }) {
  const { control } = useFormContext();
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  const prev = renewalYear(answers);
  const anyKnown = !!prev && ROUTER_GROUPS.some((g) => (knownItems[g.id] || []).length > 0);
  const [blocked, setBlocked] = useState("");
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
                {RENEWAL_INTRO[locale].replace("{prev}", prev || "").replace("{year}", L({ fr: "{year}", en: "{year}", de: "{year}" }))}
              </p>
            ) : null}
            <div className="flex flex-col gap-6">
              {ROUTER_GROUPS.map((group) => {
                const options = ROUTER_OPTIONS.filter((o) => o.group === group.id && (!o.showIf || o.showIf(answers)));
                const known = prev ? knownItems[group.id] || [] : [];
                return (
                  <fieldset key={group.id} className="flex flex-col gap-2">
                    <legend className="mb-2 text-base font-semibold tracking-tight">{L(group.label)}</legend>
                    {known.length ? (
                      <p className="text-sm text-muted-foreground">
                        {CARRIED_FROM[locale].replace("{prev}", prev)} {known.join(" · ")}
                      </p>
                    ) : null}
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
                              className="shadow-[inset_0_0_0_1px_rgba(20,16,14,0.28)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)] mt-0.5"
                              onCheckedChange={(next) => {
                                const list = next === true ? [...current, option.value] : current.filter((v) => v !== option.value);
                                // An item carried over from last year is ended on its own screen, not by unticking its area.
                                if (next !== true && hidesCarried(answers, list)) {
                                  setBlocked(option.value);
                                  return;
                                }
                                setBlocked("");
                                field.onChange(list);
                              }}
                            />
                            <span className="flex flex-col gap-0.5">
                              <span className="font-medium">{L(option.label)}</span>
                              {option.hint ? <span className="text-xs text-muted-foreground">{L(option.hint)}</span> : null}
                              {blocked === option.value ? <span className="text-xs text-destructive">{KEEP_AREA[locale].replace("{prev}", prev)}</span> : null}
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
