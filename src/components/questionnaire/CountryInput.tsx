"use client";

import { forwardRef, useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { chooseCountry, suggestCountries, type CountryLocale } from "@/src/lib/questionnaire/countries";

type Props = Omit<React.ComponentPropsWithoutRef<"input">, "value" | "onChange"> & {
  value: string;
  onValue: (value: string) => void;
  locale: CountryLocale;
  /** Takes several countries, separated by commas (nationalities, tax countries). */
  several: boolean;
};

/**
 * A text field that offers countries: the common ones as soon as the empty field is touched, then
 * the matches of what is typed (« sui » → Suisse). The list opens under the field, inline (no
 * popover: nothing for a dialog to block), each a 44 px row, five rows visible then it scrolls, and
 * it is scrolled into the part of the screen the iPhone keyboard leaves. The answer is the text in
 * the field; any name typed by hand stays.
 */
export const CountryInput = forwardRef<HTMLInputElement, Props>(function CountryInput({ value, onValue, locale, several, onBlur, onFocus, ...input }, ref) {
  const [open, setOpen] = useState(false);
  // Entered but nothing typed yet: a name already there (prefilled) offers the others.
  const [browse, setBrowse] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  const matches = open ? suggestCountries(value, several, locale, browse) : [];
  const shown = matches.length > 0;

  // Once the list shows, and again when the keyboard has finished opening, bring it into view.
  useEffect(() => {
    if (!shown) return;
    const reveal = () => listRef.current?.scrollIntoView({ block: "nearest" });
    const frame = requestAnimationFrame(reveal);
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", reveal);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", reveal);
    };
  }, [shown]);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Input
        {...input}
        ref={setRefs}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        onChange={(e) => {
          onValue(e.target.value);
          setOpen(true);
          setBrowse(false);
        }}
        onFocus={(e) => {
          setOpen(true);
          setBrowse(true);
          onFocus?.(e);
        }}
        onClick={() => setOpen(true)}
        onBlur={(e) => {
          setOpen(false);
          onBlur?.(e);
        }}
      />
      {shown ? (
        <div id={listId} ref={listRef} role="listbox" className="flex max-h-[220px] scroll-mb-4 flex-col overflow-y-auto overscroll-contain rounded-md border bg-background shadow-sm">
          {matches.map((country) => (
            <Button
              key={country.code}
              type="button"
              role="option"
              aria-selected={false}
              variant="ghost"
              className="h-11 shrink-0 justify-start rounded-none px-3 text-left font-normal"
              // Keeps the field focused (and the keyboard up) while the choice is tapped. Not on
              // pointerdown: iOS Safari then drops the tap's click, and the choice does nothing.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onValue(chooseCountry(value, country.name, several, locale, browse));
                setBrowse(false);
                setOpen(several);
                if (several) inputRef.current?.focus();
              }}
            >
              <span className="w-full text-left">{country.name}</span>
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
