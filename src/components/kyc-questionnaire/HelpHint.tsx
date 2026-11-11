"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import type { KycLocale } from "@/src/lib/kyc-questionnaire/types";
import { UI } from "@/src/lib/kyc-questionnaire/ui";
import { cn } from "@/src/lib/utils";

/**
 * The small (i) button next to a question: opens the explanation in a popover. A popover, not a
 * tooltip, so it opens with a tap on a phone. Keep it outside any <label>, so tapping it never
 * toggles the checkbox or radio the label belongs to.
 */
export function HelpHint({ text, locale, className }: { text: string; locale: KycLocale; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={UI.helpButton[locale]}
          className={cn(
            "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            className,
          )}
        >
          <Info className="size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-80 max-w-[calc(100vw-2rem)] max-h-[min(24rem,var(--radix-popover-content-available-height))] overflow-y-auto text-sm leading-relaxed">
        {text}
      </PopoverContent>
    </Popover>
  );
}
