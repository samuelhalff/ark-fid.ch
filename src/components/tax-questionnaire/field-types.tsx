"use client";

import { useFormContext } from "react-hook-form";
import { FormControl, FormItem, FormMessage } from "@/src/components/ui/form";
import type { FieldTypeContext } from "@/src/components/questionnaire/kit";
import { taxYearChoices } from "@/src/lib/tax-questionnaire/logic";
import type { QfLocale } from "@/src/lib/tax-questionnaire/types";
import { CommuneField } from "./CommuneField";

/** A Swiss commune (official BFS list, or free text): its BFS number goes in the "<id>Bfs" sibling; a row's canton filters the list. */
function Commune({ field, name, answers, row, f, invalid, labelNode, help, span, locale }: FieldTypeContext & { locale: QfLocale }) {
  const { getValues, setValue } = useFormContext();
  const cantonField = (field as { cantonField?: string }).cantonField;
  const cantonValue = cantonField ? (row ? row[cantonField] : answers[cantonField]) : undefined;
  const bfsName = `${name}Bfs`;
  const value = f.value;
  return (
    <FormItem data-field={name} className={span}>
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

/** The tax years to declare, latest first; the current year only when leaving Switzerland (shown last). */
function taxYearOptions() {
  const current = new Date().getFullYear();
  return taxYearChoices()
    .sort((a, b) => b - a)
    .map((y) =>
      y === current
        ? { value: String(y), label: { fr: `${y} (départ de Suisse)`, en: `${y} (leaving Switzerland)`, de: `${y} (Wegzug aus der Schweiz)` } }
        : { value: String(y), label: { fr: String(y), en: String(y), de: String(y) } },
    )
    .sort((a, b) => (a.label.fr.includes("(") ? 1 : 0) - (b.label.fr.includes("(") ? 1 : 0));
}

/** The tax form's own field types, plugged into the shared field renderer. */
export const taxFieldTypes = (locale: QfLocale): Record<string, (ctx: FieldTypeContext) => React.ReactNode> => ({
  commune: (ctx) => <Commune {...ctx} locale={locale} />,
  taxyears: (ctx) => ctx.checkboxes(taxYearOptions(), "grid-cols-3 sm:grid-cols-6"),
});
