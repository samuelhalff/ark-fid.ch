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
import { tidyCountries } from "@/src/lib/questionnaire/countries";
import type { AnyAnswers, AnyRow } from "@/src/lib/questionnaire/form-values";
import { maskDate, normaliseAmount, normaliseDate } from "@/src/lib/tax-questionnaire/format";
import { cn } from "@/src/lib/utils";
import { CountryInput } from "./CountryInput";
import { FilledCheck } from "./FilledCheck";
import { HelpHint } from "./HelpHint";
import { useKit, type KitField, type KitOption } from "./kit";

interface Props {
  field: KitField;
  /** react-hook-form name (dots replaced, or "group.index.field"). */
  name: string;
  /** Current answers (options with a showIf, wording per answers). */
  answers: AnyAnswers;
  /** The row of a repeating group this field belongs to (a form-specific type may read it, e.g. the canton of a commune). */
  row?: AnyRow;
  /** A top-level question: its (i) also takes a question about the field (forms with an assistant). */
  askable?: boolean;
  /**
   * Edited inside a « déjà rempli » row (StepView): small label ("block") or question label ("solo")
   * over a control at row height; a choice is a Select so the row keeps its height.
   */
  layout?: "block" | "solo";
  /** A short marker after the label (« Pré-rempli par Ark — à vérifier »). */
  marker?: string;
}

/** The label with the part equal to `link.label` as a link (new tab). */
function withLink(text: string, link: { href: string; label: string } | null) {
  const at = link ? text.indexOf(link.label) : -1;
  if (!link || at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <a href={link.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
        {link.label}
      </a>
      {text.slice(at + link.label.length)}
    </>
  );
}

const CHECKBOX_RING = "shadow-[inset_0_0_0_1px_rgba(20,16,14,0.28)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.32)]";
const OPTION_CARD = "flex cursor-pointer items-start gap-3 rounded-md bg-surface-warm px-3 py-2.5 font-normal leading-snug shadow-[inset_0_0_0_1px_rgba(20,16,14,0.08)] dark:bg-background dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]";
const INVALID_RING = "ring-2 ring-destructive/60";

/** Types that never say « (facultatif) »: a choice among boxes is optional by nature. */
const NEVER_OPTIONAL = new Set(["checkboxes", "boolean", "taxyears"]);

/** One question of a questionnaire (KYC or tax), rendered with the site's shadcn components only. */
export function FieldControl({ field, name, answers, row, askable, layout, marker }: Props) {
  const { control } = useFormContext();
  const kit = useKit();
  const S = kit.strings;
  const L = (text: Parameters<typeof kit.t>[0]) => kit.t(text, answers);
  const optional = !field.required && !NEVER_OPTIONAL.has(field.type);
  const options = (field.options || []).filter((o) => !o.showIf || (o.showIf as (a: AnyAnswers) => boolean)(answers));
  const span = layout ? "" : field.width === "half" ? "sm:col-span-1" : "sm:col-span-2";
  const text = kit.fieldText(field, answers);
  const fieldLabel = L(text.label);
  const max = kit.maxLength(field);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field: f, fieldState }) => {
        const value = f.value;
        // Invalid controls get the site's destructive ring; the message is shown right under them.
        const invalid = !!fieldState.error;
        const errorRing = invalid ? INVALID_RING : "";
        const filled = !invalid && kit.isFilled(field, value);
        // The explanation: behind a small (i) next to the label (the same text stays the field's description
        // for screen readers), or a visible line under the label, as the form chooses.
        const helpText = text.help ? L(text.help) : null;
        const hinted = kit.helpStyle === "hint";
        const hint =
          helpText && hinted ? (
            <HelpHint text={helpText} title={fieldLabel} ask={askable ? { field, answers: () => answers, onUse: (next) => f.onChange(next) } : undefined} />
          ) : null;
        const help = helpText ? <FormDescription className={hinted ? "sr-only" : undefined}>{helpText}</FormDescription> : null;
        const optionalTag = optional ? <span className="ml-1 font-normal text-muted-foreground">({S.optional})</span> : null;
        const markerTag = marker ? <span className="ml-2 text-xs font-medium text-brand-hover">{marker}</span> : null;
        // In a row the (i) sits in a box of the label's line height, so the row never grows when editing.
        const labelNode = layout ? (
          <div className="flex min-w-0 items-start gap-1">
            <FormLabel className={layout === "solo" ? "min-w-0 leading-5 font-medium [overflow-wrap:anywhere]" : "min-w-0 text-xs leading-4 font-normal text-muted-foreground [overflow-wrap:anywhere]"}>
              {fieldLabel}
              {optionalTag}
              {markerTag}
            </FormLabel>
            {hint ? <div className={cn("flex items-center", layout === "solo" ? "h-5" : "h-4")}>{hint}</div> : null}
            <div className={cn("flex items-center", layout === "solo" ? "h-5" : "h-4")}>
              <FilledCheck filled={filled} />
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-1">
            <FormLabel className="form-label min-w-0 leading-snug">
              {fieldLabel}
              {optionalTag}
              {markerTag}
            </FormLabel>
            {hint}
            <FilledCheck filled={filled} className="mt-[0.2em]" />
          </div>
        );
        const rowItem = layout ? "gap-1" : "";

        const checkboxes = (list: KitOption[], className = "sm:grid-cols-2") => {
          const current = Array.isArray(value) ? (value as string[]) : [];
          return (
            <FormItem data-field={name} className={cn(!layout && "sm:col-span-2", rowItem)}>
              {labelNode}
              {help}
              <div className={cn("grid gap-2", className)} role="group" aria-label={fieldLabel}>
                {list.map((option) => {
                  const id = `${name}-${option.value}`;
                  const checked = current.includes(option.value);
                  return (
                    <Label key={option.value} htmlFor={id} className={cn(OPTION_CARD, checked && "ring-2 ring-ring/50", errorRing)}>
                      <Checkbox
                        className={cn(CHECKBOX_RING, invalid && INVALID_RING)}
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
        };

        // A type of this form only (tax: commune, tax years), inside the same frame.
        const own = kit.fieldTypes?.[field.type];
        if (own) return <>{own({ field, name, answers, row, f, fieldState, invalid, labelNode, help, span, checkboxes })}</>;

        // A choice edited in a row: a Select at field height, same height as the value it replaces.
        if (layout && (field.type === "radio" || field.type === "yesno" || field.type === "select")) {
          const choices = field.type === "yesno" ? [{ value: "yes", text: S.yes }, { value: "no", text: S.no }] : options.map((o) => ({ value: o.value, text: L(o.label) }));
          return (
            <FormItem data-field={name} className={rowItem}>
              {labelNode}
              <Select value={typeof value === "string" ? value : ""} onValueChange={(next) => f.onChange(next || undefined)}>
                <FormControl>
                  <SelectTrigger ref={f.ref} aria-invalid={invalid || undefined} className="h-10 min-w-0">
                    <SelectValue placeholder={S.choose} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {choices.map((choice) => (
                    <SelectItem key={choice.value} value={choice.value}>
                      {choice.text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {help}
              <FormMessage />
            </FormItem>
          );
        }

        if (field.type === "boolean") {
          return (
            <FormItem data-field={name} className={cn("flex flex-col gap-1", span)}>
              <div className="flex items-start gap-3">
                <FormControl>
                  <Checkbox aria-invalid={invalid || undefined} className={cn(CHECKBOX_RING, invalid && INVALID_RING)} checked={value === "yes"} onCheckedChange={(checked) => f.onChange(checked === true ? "yes" : undefined)} />
                </FormControl>
                <FormLabel className="mt-0 block font-normal leading-snug hover:cursor-pointer">
                  <span>{withLink(fieldLabel, field.link ? { href: L(field.link.href), label: L(field.link.label) } : null)}</span>
                </FormLabel>
                {hint}
              </div>
              {help}
              <FormMessage />
            </FormItem>
          );
        }

        if (field.type === "checkboxes") return checkboxes(options);

        if (field.type === "yesno") {
          return (
            <FormItem data-field={name} className={span}>
              {labelNode}
              {help}
              <div className={cn("flex justify-start rounded-md", errorRing && "w-fit", errorRing)}>
                <FormControl>
                  <ToggleGroup type="single" variant="outline" value={typeof value === "string" ? value : ""} onValueChange={(next) => f.onChange(next || undefined)}>
                    <ToggleGroupItem value="yes" className="min-w-20">
                      {S.yes}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="no" className="min-w-20">
                      {S.no}
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
                  <SelectTrigger aria-invalid={invalid || undefined} className="h-10 min-w-0">
                    <SelectValue placeholder={S.choose} />
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
            <FormItem data-field={name} className={cn(!layout && "sm:col-span-2", rowItem)}>
              {labelNode}
              <FormControl>
                <Textarea rows={layout ? 3 : 4} maxLength={max} {...f} value={typeof value === "string" ? value : ""} />
              </FormControl>
              {help}
              <FormMessage />
            </FormItem>
          );
        }

        const inputProps: React.ComponentProps<"input"> = {};
        if (field.type === "email") Object.assign(inputProps, { type: "email", inputMode: "email" });
        if (field.type === "tel") Object.assign(inputProps, { type: "tel", autoComplete: "tel", inputMode: "tel" });
        if (field.type === "money") Object.assign(inputProps, { inputMode: "decimal", placeholder: "0.00" });
        if (field.type === "integer") Object.assign(inputProps, { inputMode: "numeric" });
        if (field.type === "percent") Object.assign(inputProps, { inputMode: "decimal", placeholder: "%" });
        if (field.type === "date") Object.assign(inputProps, { inputMode: "numeric", placeholder: S.datePlaceholder, autoComplete: "off" });
        // Browser autofill only for the client's own name and e-mail, not for third parties' rows.
        if (kit.autofill[name]) inputProps.autoComplete = kit.autofill[name];
        if (field.suggest) {
          // Countries offered as typed (« sui » → Suisse).
          return (
            <FormItem data-field={name} className={cn(span, rowItem)}>
              {labelNode}
              <FormControl>
                <CountryInput
                  {...inputProps}
                  name={f.name}
                  ref={f.ref}
                  value={typeof value === "string" ? value : ""}
                  maxLength={max}
                  locale={kit.locale as Parameters<typeof CountryInput>[0]["locale"]}
                  several={field.suggest === "countries"}
                  onValue={(next) => f.onChange(next)}
                  onBlur={(e) => {
                    // A trailing comma left by the last pick is not part of the answer.
                    const raw = e.target.value;
                    const trimmed = tidyCountries(raw);
                    if (trimmed !== raw) f.onChange(trimmed);
                    f.onBlur();
                  }}
                />
              </FormControl>
              {help}
              <FormMessage />
            </FormItem>
          );
        }
        return (
          <FormItem data-field={name} className={cn(span, rowItem)}>
            {labelNode}
            <FormControl>
              <Input
                {...inputProps}
                name={f.name}
                ref={f.ref}
                value={typeof value === "string" ? value : ""}
                maxLength={max}
                onChange={(e) => f.onChange(field.type === "date" ? maskDate(e.target.value, typeof value === "string" ? value : "") : e.target.value)}
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
