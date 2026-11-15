"use client";

import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/src/components/ui/button";
import { Checkbox } from "@/src/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import { FormField, FormItem, FormMessage } from "@/src/components/ui/form";
import { Label } from "@/src/components/ui/label";
import { FieldControl } from "@/src/components/questionnaire/FieldControl";
import { StepView as SharedStepView, type GroupContext, type GroupExtras } from "@/src/components/questionnaire/StepView";
import type { KitGroup } from "@/src/components/questionnaire/kit";
import { isBlockVisible, isStepVisible, label as interpolate } from "@/src/lib/tax-questionnaire/logic";
import { ROUTER_GROUPS, ROUTER_OPTIONS, renewalYear, rowsOf, STEPS } from "@/src/lib/tax-questionnaire/schema";
import { UI2 } from "@/src/lib/tax-questionnaire/ui";
import type { Answers, GroupDef, QfLocale, StepDef } from "@/src/lib/tax-questionnaire/types";
import { cn } from "@/src/lib/utils";
import { toName } from "./form-model";
import { taxRowTitle } from "@/src/lib/tax-questionnaire/kit";

interface StepProps {
  step: StepDef;
  locale: QfLocale;
  answers: Answers;
  /** Names known from last year (renewal / extraction), shown next to "unchanged". */
  knownItems?: Record<string, string[]>;
  aiSuggestions?: Record<string, string>;
}

/** A tax screen in the shared step view, with what only this form has: the router cards, the items carried over from last year. */
export function StepView({ step, locale, answers, knownItems, aiSuggestions }: StepProps) {
  const { setValue } = useFormContext();
  const blocks = step.blocks.filter((b) => isBlockVisible(b, answers) && !((b.kind === "field" || b.kind === "group") && b.hidden));
  const ark = arkPrefilledSet(answers);
  return (
    <div className="flex flex-col gap-6">
      <SharedStepView
        blocks={blocks}
        answers={answers}
        prefilled={ark}
        renderBlock={(block) => {
          if (block.id === "router.items") return <RouterCards locale={locale} answers={answers} aiSuggestions={aiSuggestions} knownItems={knownItems || {}} />;
          if (block.id === "router.unchanged") return null;
          return undefined;
        }}
        groupExtras={(group, context) => renewalExtras(group, context, locale, answers, setValue)}
      />
    </div>
  );
}

/** Ids of the questions pre-filled by Ark (prepared case). */
export const arkPrefilledSet = (answers: Answers) =>
  new Set(String(answers["start.arkPrefilled"] || "").split(/[\s,]+/).filter(Boolean));


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
  carried: { fr: "Repris de {prev}", en: "From {prev}", de: "Aus {prev}" },
};

/**
 * A group holding items carried over from last year: each is confirmed (still there, ended — with
 * its date —, or changed: then its fields open), « Tout est identique » confirms them all at once.
 */
function renewalExtras(group: KitGroup, { name, rows, rowErrors }: GroupContext, locale: QfLocale, answers: Answers, setValue: GroupContext["setValue"]): GroupExtras | undefined {
  const carriedRows = rows.filter((r) => r.carried);
  const sameAs = String(answers["router.sameAs"] || "").split(/[\s,]+/).filter(Boolean);
  const isSame = sameAs.includes(group.id);
  if (!carriedRows.length && !isSame) return undefined;
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  const year = L({ fr: "{year}", en: "{year}", de: "{year}" });
  const prev = String(carriedRows[0]?.carried || "");
  const setSameAs = (on: boolean) => {
    const next = on ? [...new Set([...sameAs, group.id])] : sameAs.filter((g) => g !== group.id);
    setValue(toName("router.sameAs"), next.join(", ") || undefined, { shouldDirty: true });
  };
  const allIdentical = () => {
    rows.forEach((row, index) => {
      if (row.carried) setValue(`${name}.${index}.renewal`, "kept", { shouldDirty: true, shouldValidate: Object.keys(rowErrors(index)).length > 0 });
    });
    setSameAs(true);
  };
  const fr = locale === "fr";
  const keptLabel = (fr && KEPT[group.id]) || R.kept[locale];
  const endedLabel = (fr && ENDED[group.id]) || R.ended[locale];
  const endedField = group.fields.find((f) => f.id === "endedOn");
  return {
    addLabel: carriedRows.length && fr && ADD[group.id] ? ADD[group.id] : undefined,
    onAdd: () => {
      if (isSame) setSameAs(false);
    },
    row: (row, index) => {
      if (!row.carried) return undefined;
      const title = taxRowTitle(group as unknown as GroupDef, row);
      // A carried item stays compact unless changed, or something carried over needs fixing.
      const detailErrors = Object.keys(rowErrors(index)).some((k) => k !== "renewal" && k !== "endedOn");
      return {
        title: (
          <>
            {title || `${L(group.itemLabel as Parameters<typeof interpolate>[0])} ${index + 1}`}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{R.carried[locale].replace("{prev}", String(row.carried))}</span>
          </>
        ),
        removable: false,
        expanded: row.renewal === "changed" || detailErrors,
        top: (
          <>
            <RenewalChoice
              name={`${name}.${index}.renewal`}
              label={`${title || L(group.itemLabel as Parameters<typeof interpolate>[0])} – ${year}`}
              kept={keptLabel.replace("{year}", year)}
              ended={endedLabel.replace("{year}", year)}
              changed={R.changed[locale]}
              onPick={(next) => {
                if (next && next !== "kept" && isSame) setSameAs(false);
              }}
            />
            {row.renewal === "ended" && endedField ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <FieldControl field={{ ...endedField, width: "half", label: { fr: R.endedOn.fr, en: R.endedOn.en, de: R.endedOn.de } }} name={`${name}.${index}.endedOn`} answers={answers} row={row} />
              </div>
            ) : null}
          </>
        ),
      };
    },
    actions: carriedRows.length ? (
      <Button type="button" variant={isSame ? "secondary" : "outline"} className="h-auto min-h-9 max-w-full py-2 text-left whitespace-normal" onClick={allIdentical}>
        <span className="min-w-0 whitespace-normal">{R.same[locale].replace("{prev}", prev)}</span>
      </Button>
    ) : null,
    after: isSame && !rows.some((r) => !r.carried) ? <p className="text-sm text-muted-foreground">{R.sameDone[locale].replace("{prev}", prev)}</p> : null,
  };
}

/** Still there / ended / changed, for one carried item. */
function RenewalChoice({ name, label, kept, ended, changed, onPick }: { name: string; label: string; kept: string; ended: string; changed: string; onPick: (next: string) => void }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: f, fieldState }) => (
        <FormItem data-field={name} className="!flex flex-col items-start">
          <ToggleGroup
            type="single"
            variant="outline"
            className={cn("flex-wrap !justify-start", fieldState.error && "rounded-md ring-2 ring-destructive/60")}
            value={typeof f.value === "string" ? f.value : ""}
            onValueChange={(next) => {
              f.onChange(next || undefined);
              onPick(next);
            }}
            aria-label={label}
          >
            <ToggleGroupItem value="kept" className="px-3">{kept}</ToggleGroupItem>
            <ToggleGroupItem value="ended" className="px-3">{ended}</ToggleGroupItem>
            <ToggleGroupItem value="changed" className="px-3">{changed}</ToggleGroupItem>
          </ToggleGroup>
          <FormMessage />
        </FormItem>
      )}
    />
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
