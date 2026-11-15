"use client";

import { forwardRef, useId, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { isCountryName, pickCountry, searchCountries, typedPart } from "@/src/lib/kyc-questionnaire/countries";
import type { KycLocale } from "@/src/lib/kyc-questionnaire/types";

type Props = Omit<React.ComponentPropsWithoutRef<"input">, "value" | "onChange"> & {
  value: string;
  onValue: (value: string) => void;
  locale: KycLocale;
  /** Takes several countries, separated by commas (nationalities, tax countries). */
  several: boolean;
};

/**
 * A text field that offers countries as the person types (« sui » → Suisse): the matches open
 * under the field, inline (no popover: nothing for the iPhone keyboard to cover or a dialog to
 * block), each a 44 px row. The answer is the text in the field; any name typed by hand stays.
 */
export const CountryInput = forwardRef<HTMLInputElement, Props>(function CountryInput({ value, onValue, locale, several, onBlur, onFocus, ...input }, ref) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const typed = typedPart(value, several);
  const matches = open && typed && !isCountryName(typed, locale) ? searchCountries(typed, locale) : [];
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Input
        {...input}
        ref={ref}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={matches.length > 0}
        aria-controls={listId}
        onChange={(e) => {
          onValue(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          setOpen(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setOpen(false);
          onBlur?.(e);
        }}
      />
      {matches.length ? (
        <div id={listId} role="listbox" className="flex flex-col overflow-hidden rounded-md border bg-background shadow-sm">
          {matches.map((country) => (
            <Button
              key={country.code}
              type="button"
              role="option"
              aria-selected={false}
              variant="ghost"
              className="h-11 justify-start rounded-none px-3 text-left font-normal"
              // Keeps the field focused (and the keyboard up) while the choice is tapped.
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onValue(pickCountry(value, country.name, several));
                setOpen(several);
              }}
            >
              {country.name}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
