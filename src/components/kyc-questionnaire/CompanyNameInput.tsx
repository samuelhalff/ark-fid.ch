"use client";

import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { UI } from "@/src/lib/kyc-questionnaire/ui";
import type { KycLocale } from "@/src/lib/kyc-questionnaire/types";
import { cn } from "@/src/lib/utils";
import { api } from "./api";

export type RegisterCompany = { name: string; seat: string; uid: string };

type Props = Omit<React.ComponentPropsWithoutRef<"input">, "value" | "onChange"> & {
  value: string;
  onValue: (value: string) => void;
  /** A company of the register was chosen: its name is already set, the caller takes its UID. */
  onPick: (company: RegisterCompany) => void;
  locale: KycLocale;
  /** Search the register only while true (a Swiss company, or no country yet). */
  search: boolean;
};

/**
 * A company name that offers the Swiss register's companies as typed (300 ms after the last key,
 * from Cadence's register search), inline under the field like the countries (44 px rows, nothing
 * for the iPhone keyboard to cover). Any name typed stays the answer; if the search is down the
 * field is a plain text field.
 */
export const CompanyNameInput = forwardRef<HTMLInputElement, Props>(function CompanyNameInput({ value, onValue, onPick, locale, search, onBlur, onFocus, className, ...input }, ref) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RegisterCompany[]>([]);
  const listId = useId();
  const asked = useRef("");
  const typed = value.trim();

  useEffect(() => {
    if (!open || !search || typed.length < 2) {
      setItems([]);
      return;
    }
    const timer = setTimeout(() => {
      asked.current = typed;
      api
        .caseAction<{ items?: RegisterCompany[] }>("companies", { q: typed })
        .then((data) => {
          if (asked.current === typed) setItems(Array.isArray(data.items) ? data.items.slice(0, 8) : []);
        })
        .catch(() => setItems([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [typed, open, search]);

  const matches = open && items.some((i) => i.name !== typed) ? items : [];
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
        className={className}
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
        <div id={listId} role="listbox" aria-label={UI.holdersRegisterHint[locale]} className="flex flex-col overflow-hidden rounded-md border bg-background shadow-sm">
          {matches.map((company) => (
            <Button
              key={`${company.uid}|${company.name}`}
              type="button"
              role="option"
              aria-selected={false}
              variant="ghost"
              className={cn("h-auto min-h-11 flex-col items-start justify-center gap-0 rounded-none px-3 py-1.5 text-left font-normal whitespace-normal")}
              // Keeps the field focused (and the keyboard up) while the choice is tapped. Not on pointerdown:
              // iOS Safari then drops the tap's click, and the choice does nothing.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onValue(company.name);
                onPick(company);
                setOpen(false);
              }}
            >
              <span className="[overflow-wrap:anywhere]">{company.name}</span>
              {company.seat || company.uid ? <span className="text-xs text-muted-foreground">{[company.seat, company.uid].filter(Boolean).join(" · ")}</span> : null}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
});
