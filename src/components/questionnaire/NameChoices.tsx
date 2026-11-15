"use client";

import { Button } from "@/src/components/ui/button";

/**
 * One-tap choices of the people or companies already named above (« C'est Acme SA (employeur,
 * indiqué plus haut) »), then a line saying someone else is typed below. Shared form control: the
 * labels come from the form, in the page's language.
 */
export function NameChoices({ choices, other, onPick }: { choices: { key: string; label: string }[]; other: string; onPick: (key: string) => void }) {
  if (!choices.length) return null;
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:col-span-2">
      {choices.map((choice) => (
        <Button
          key={choice.key}
          type="button"
          variant="outline"
          className="h-auto min-h-11 w-full max-w-full justify-start py-2 text-left whitespace-normal"
          onClick={() => onPick(choice.key)}
        >
          <span className="min-w-0 whitespace-normal [overflow-wrap:anywhere]">{choice.label}</span>
        </Button>
      ))}
      <p className="text-sm text-muted-foreground">{other}</p>
    </div>
  );
}
