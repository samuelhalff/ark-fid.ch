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
import { label, LIMITS } from "@/src/lib/kyc-questionnaire/engine";
import { UI } from "@/src/lib/kyc-questionnaire/ui";
import type { Answers, FieldDef, KycLocale } from "@/src/lib/kyc-questionnaire/types";
import { normaliseAmount, normaliseDate } from "@/src/lib/tax-questionnaire/format";
import { cn } from "@/src/lib/utils";

interface Props {
  field: FieldDef;
  /** react-hook-form name (dots replaced, or "group.index.field"). */
  name: string;
  locale: KycLocale;
  /** Current answers (options with a showIf). */
  answers: Answers;
  /** Pre-filled by Ark: marked "to check". */
  arkPrefilled?: boolean;
}

const CHECKBOX_RING = "shadow-[inset_0_0_0_1px_rgba(20,16,14,0.28)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)]";
const OPTION_CARD = "flex cursor-pointer items-start gap-3 rounded-md bg-surface-warm px-3 py-2.5 font-normal leading-snug shadow-[inset_0_0_0_1px_rgba(20,16,14,0.08)] dark:bg-background dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]";

/** One question, rendered with the site's shadcn components only. */
export function FieldControl({ field, name, locale, answers, arkPrefilled }: Props) {
  const { control } = useFormContext();
  const L = (text: Parameters<typeof label>[0]) => label(text, locale);
  const optional = !field.required && !["checkboxes", "boolean"].includes(field.type);
  const options = (field.options || []).filter((o) => !o.showIf || o.showIf(answers));
  const span = field.width === "half" ? "sm:col-span-1" : "sm:col-span-2";
  const max = field.maxLength || (field.type === "textarea" ? LIMITS.textarea : LIMITS.text);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field: f, fieldState }) => {
        const value = f.value;
        // Invalid controls get the site's destructive ring; the message is shown right under them.
        const invalid = !!fieldState.error;
        const errorRing = invalid ? "ring-2 ring-destructive/60" : "";
        const prefilledTag = arkPrefilled ? <span className="ml-2 text-xs font-medium text-brand-hover">{UI.prefilled[locale]}</span> : null;
        const labelNode = (
          <FormLabel className="form-label">
            {L(field.label)}
            {optional ? <span className="ml-1 font-normal text-muted-foreground">({UI.optional[locale]})</span> : null}
            {prefilledTag}
          </FormLabel>
        );
        const help = field.help ? <FormDescription>{L(field.help)}</FormDescription> : null;

        if (field.type === "boolean") {
          return (
            <FormItem data-field={name} className={cn("flex flex-col gap-1", span)}>
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox aria-invalid={invalid || undefined} className={cn(CHECKBOX_RING, invalid && "ring-2 ring-destructive/60")} checked={value === "yes"} onCheckedChange={(checked) => f.onChange(checked === true ? "yes" : undefined)} />
                </FormControl>
                <FormLabel className="mt-0 font-normal leading-snug hover:cursor-pointer">
                  {L(field.label)}
                  {prefilledTag}
                </FormLabel>
              </div>
              {help}
              <FormMessage />
            </FormItem>
          );
        }

        if (field.type === "checkboxes") {
          const current = Array.isArray(value) ? (value as string[]) : [];
          return (
            <FormItem data-field={name} className="sm:col-span-2">
              {labelNode}
              {help}
              <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={L(field.label)}>
                {options.map((option) => {
                  const id = `${name}-${option.value}`;
                  const checked = current.includes(option.value);
                  return (
                    <Label key={option.value} htmlFor={id} className={cn(OPTION_CARD, checked && "ring-2 ring-ring/50", errorRing)}>
                      <Checkbox
                        className={cn(CHECKBOX_RING, invalid && "ring-2 ring-destructive/60")}
                        aria-invalid={invalid || undefined}
                        id={id}
                        checked={checked}
                        onCheckedChange={(next) => f.onChange(next === true ? [...current, option.value] : current.filter((v) => v !== option.value))}
                      />
                      <span className="flex flex-col">
                        <span>{L(option.label)}</span>
                        {option.hint ? <span className="text-xs text-muted-foreground">{L(option.hint)}</span> : null}
                      </span>
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
            <FormItem data-field={name} className={span}>
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
                      <Label key={option.value} htmlFor={id} className={cn(OPTION_CARD, value === option.value && "ring-2 ring-ring/50", errorRing)}>
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
            <FormItem data-field={name} className={span}>
              {labelNode}
              <Select value={typeof value === "string" ? value : ""} onValueChange={f.onChange}>
                <FormControl>
                  <SelectTrigger aria-invalid={invalid || undefined}>
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

        if (field.type === "textarea") {
          return (
            <FormItem data-field={name} className="sm:col-span-2">
              {labelNode}
              <FormControl>
                <Textarea rows={4} maxLength={max} {...f} value={typeof value === "string" ? value : ""} />
              </FormControl>
              {help}
              <FormMessage />
            </FormItem>
          );
        }

        const inputProps: React.ComponentProps<"input"> = {};
        if (field.type === "email") Object.assign(inputProps, { type: "email", autoComplete: "email", inputMode: "email" });
        if (field.type === "tel") Object.assign(inputProps, { type: "tel", autoComplete: "tel", inputMode: "tel" });
        if (field.type === "money") Object.assign(inputProps, { inputMode: "decimal", placeholder: "0.00" });
        if (field.type === "integer") Object.assign(inputProps, { inputMode: "numeric" });
        if (field.type === "percent") Object.assign(inputProps, { inputMode: "decimal", placeholder: "%" });
        if (field.type === "date") Object.assign(inputProps, { inputMode: "numeric", placeholder: UI.datePlaceholder[locale], autoComplete: "off" });
        // Browser autofill only for the client's own name (a person's form), not for third parties' rows.
        if (name === "a__firstName") inputProps.autoComplete = "given-name";
        if (name === "a__lastName") inputProps.autoComplete = "family-name";
        return (
          <FormItem data-field={name} className={span}>
            {labelNode}
            <FormControl>
              <Input
                {...inputProps}
                name={f.name}
                ref={f.ref}
                value={typeof value === "string" ? value : ""}
                maxLength={max}
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
