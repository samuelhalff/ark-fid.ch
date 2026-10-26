"use client";

import { useFormContext } from "react-hook-form";
import { Checkbox } from "@/src/components/ui/checkbox";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/src/components/ui/form";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/src/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/src/components/ui/toggle-group";
import { normaliseAmount, normaliseDate } from "@/src/lib/tax-questionnaire/format";
import { label as interpolate, taxYearChoices } from "@/src/lib/tax-questionnaire/logic";
import { UI } from "@/src/lib/tax-questionnaire/ui";
import type { Answers, FieldDef, QfLocale, Row } from "@/src/lib/tax-questionnaire/types";
import { CommuneField } from "./CommuneField";

const ARK_PREFILLED_LABEL = { fr: "Pré-rempli par Ark — à vérifier", en: "Pre-filled by Ark — please check", de: "Von Ark vorausgefüllt — bitte prüfen" };
import { cn } from "@/src/lib/utils";

interface Props {
  field: FieldDef;
  /** react-hook-form name (dots replaced, or "group.index.field"). */
  name: string;
  locale: QfLocale;
  answers: Answers;
  /** Row of a repeating group (commune fields read their canton from it). */
  row?: Row;
  /** Pre-filled by Ark (prepared case): marked "to check". */
  arkPrefilled?: boolean;
}

/** One question, rendered with the site's shadcn components only. */
export function FieldControl({ field, name, locale, answers, row, arkPrefilled }: Props) {
  const { control, setValue, getValues } = useFormContext();
  const L = (text: Parameters<typeof interpolate>[0]) => interpolate(text, locale, answers);
  const optional = !field.required && !["checkboxes", "boolean", "taxyears"].includes(field.type);
  const options = (field.options || []).filter((o) => !o.showIf || o.showIf(answers));

  return (
    <FormField
      control={control}
      name={name}
      render={({ field: f, fieldState }) => {
        const value = f.value;
        // Invalid controls get the site's destructive ring; the message is shown right under them.
        const invalid = !!fieldState.error;
        const errorRing = invalid ? "ring-2 ring-destructive/60" : "";
        const labelNode = (
          <FormLabel className="form-label">
            {L(field.label)}
            {optional ? <span className="ml-1 font-normal text-muted-foreground">({UI.optional[locale]})</span> : null}
            {arkPrefilled ? <span className="ml-2 text-xs font-medium text-brand-hover">{ARK_PREFILLED_LABEL[locale]}</span> : null}
          </FormLabel>
        );
        const help = field.help ? <FormDescription>{L(field.help)}</FormDescription> : null;

        if (field.type === "boolean") {
          return (
            <FormItem data-field={name} className={cn("flex flex-col gap-1", field.width === "half" ? "sm:col-span-1" : "sm:col-span-2")}>
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox aria-invalid={invalid || undefined} className={cn("shadow-[inset_0_0_0_1px_rgba(20,16,14,0.28)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)]", invalid && "ring-2 ring-destructive/60")} checked={value === "yes"} onCheckedChange={(checked) => f.onChange(checked === true ? "yes" : undefined)} />
                </FormControl>
                <FormLabel className="mt-0 font-normal leading-snug hover:cursor-pointer">{L(field.label)}</FormLabel>
              </div>
              {help}
              <FormMessage />
            </FormItem>
          );
        }

        if (field.type === "checkboxes" || field.type === "taxyears") {
          const list = field.type === "taxyears" ? taxYearChoices()
                  .sort((a, b) => b - a)
                  .map((y) =>
                    y === new Date().getFullYear()
                      ? { value: String(y), label: { fr: `${y} (départ de Suisse)`, en: `${y} (leaving Switzerland)`, de: `${y} (Wegzug aus der Schweiz)` } }
                      : { value: String(y), label: { fr: String(y), en: String(y), de: String(y) } },
                  )
                  .sort((a, b) => (a.label.fr.includes("(") ? 1 : 0) - (b.label.fr.includes("(") ? 1 : 0)) : options;
          const current = Array.isArray(value) ? (value as string[]) : [];
          return (
            <FormItem data-field={name} className="sm:col-span-2">
              {labelNode}
              {help}
              <div className={cn("grid gap-2", field.type === "taxyears" ? "grid-cols-3 sm:grid-cols-6" : "sm:grid-cols-2")}>
                {list.map((option) => {
                  const id = `${name}-${option.value}`;
                  const checked = current.includes(option.value);
                  return (
                    <Label
                      key={option.value}
                      htmlFor={id}
                      className={cn("flex cursor-pointer items-start gap-3 rounded-md bg-surface-warm px-3 py-2.5 font-normal leading-snug shadow-[inset_0_0_0_1px_rgba(20,16,14,0.08)] dark:bg-background dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]", checked && "ring-2 ring-ring/50", errorRing)}
                    >
                      <Checkbox className={cn("shadow-[inset_0_0_0_1px_rgba(20,16,14,0.28)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)]", invalid && "ring-2 ring-destructive/60")}
                        aria-invalid={invalid || undefined}
                        id={id}
                        checked={checked}
                        onCheckedChange={(next) => f.onChange(next === true ? [...current, option.value] : current.filter((v) => v !== option.value))}
                      />
                      <span>{L(option.label)}</span>
                    </Label>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          );
        }

        if (field.type === "yesno") {
          return (
            <FormItem data-field={name} className={cn(field.width === "half" ? "sm:col-span-1" : "sm:col-span-2")}>
              {labelNode}
              {help}
              <div className={cn("flex justify-start rounded-md", errorRing && "w-fit", errorRing)}>
                <FormControl>
                  <ToggleGroup type="single" variant="outline" value={typeof value === "string" ? value : ""} onValueChange={(next) => f.onChange(next || undefined)}>
                    <ToggleGroupItem value="yes" className="min-w-20">
                      {UI.yes[locale]}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="no" className="min-w-20">
                      {UI.no[locale]}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          );
        }

        if (field.type === "radio") {
          return (
            <FormItem data-field={name} className="sm:col-span-2">
              {labelNode}
              {help}
              <FormControl>
                <RadioGroup value={typeof value === "string" ? value : ""} onValueChange={f.onChange} className="grid gap-2">
                  {options.map((option) => {
                    const id = `${name}-${option.value}`;
                    return (
                      <Label
                        key={option.value}
                        htmlFor={id}
                        className={cn("flex cursor-pointer items-start gap-3 rounded-md bg-surface-warm px-3 py-2.5 font-normal leading-snug shadow-[inset_0_0_0_1px_rgba(20,16,14,0.08)] dark:bg-background dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]", value === option.value && "ring-2 ring-ring/50", errorRing)}
                      >
                        <RadioGroupItem id={id} value={option.value} className="mt-0.5" />
                        <span className="flex flex-col">
                          <span>{L(option.label)}</span>
                          {option.hint ? <span className="text-xs text-muted-foreground">{L(option.hint)}</span> : null}
                        </span>
                      </Label>
                    );
                  })}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }

        if (field.type === "select") {
          return (
            <FormItem data-field={name} className={cn(field.width === "half" ? "sm:col-span-1" : "sm:col-span-2")}>
              {labelNode}
              <Select value={typeof value === "string" ? value : ""} onValueChange={f.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={UI.choose[locale]} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {L(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {help}
              <FormMessage />
            </FormItem>
          );
        }

        if (field.type === "commune") {
          const cantonValue = field.cantonField ? (row ? row[field.cantonField] : answers[field.cantonField]) : undefined;
          const bfsName = `${name}Bfs`;
          return (
            <FormItem data-field={name} className={cn(field.width === "half" ? "sm:col-span-1" : "sm:col-span-2")}>
              {labelNode}
              <FormControl>
                <CommuneField
                  value={typeof value === "string" ? value : ""}
                  bfs={String(getValues(bfsName) || "")}
                  canton={typeof cantonValue === "string" ? cantonValue : undefined}
                  locale={locale}
                  invalid={invalid}
                  onChange={({ name: communeName, bfs }) => {
                    setValue(bfsName, bfs || undefined, { shouldDirty: true });
                    f.onChange(communeName);
                  }}
                  onBlur={f.onBlur}
                />
              </FormControl>
              {help}
              <FormMessage />
            </FormItem>
          );
        }

        if (field.type === "textarea") {
          return (
            <FormItem data-field={name} className="sm:col-span-2">
              {labelNode}
              <FormControl>
                <Textarea rows={4} maxLength={field.maxLength || 4000} {...f} value={typeof value === "string" ? value : ""} />
              </FormControl>
              {help}
              <FormMessage />
            </FormItem>
          );
        }

        const inputProps: React.ComponentProps<"input"> = {};
        if (field.type === "email") Object.assign(inputProps, { type: "email", autoComplete: name.endsWith("email") ? "email" : undefined, inputMode: "email" });
        if (field.type === "tel") Object.assign(inputProps, { type: "tel", autoComplete: "tel", inputMode: "tel" });
        if (field.type === "money") Object.assign(inputProps, { inputMode: "decimal", placeholder: "0.00" });
        if (field.type === "integer") Object.assign(inputProps, { inputMode: "numeric" });
        if (field.type === "percent") Object.assign(inputProps, { inputMode: "decimal", placeholder: "%" });
        if (field.type === "date") Object.assign(inputProps, { inputMode: "numeric", placeholder: UI.datePlaceholder[locale], autoComplete: "off" });
        if (name.endsWith("firstName")) inputProps.autoComplete = "given-name";
        if (name.endsWith("lastName")) inputProps.autoComplete = "family-name";
        return (
          <FormItem data-field={name} className={cn(field.width === "half" ? "sm:col-span-1" : "sm:col-span-2")}>
            {labelNode}
            <FormControl>
              <Input
                {...inputProps}
                name={f.name}
                ref={f.ref}
                value={typeof value === "string" ? value : ""}
                maxLength={field.maxLength || 200}
                onChange={(e) => f.onChange(e.target.value)}
                onBlur={(e) => {
                  const raw = e.target.value;
                  if (field.type === "money" && raw) f.onChange(normaliseAmount(raw));
                  if (field.type === "date" && raw) f.onChange(normaliseDate(raw));
                  f.onBlur();
                }}
              />
            </FormControl>
            {help}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
