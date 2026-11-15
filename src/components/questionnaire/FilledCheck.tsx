import { Check } from "@phosphor-icons/react";
import { cn } from "@/src/lib/utils";

/**
 * The quiet mark at the end of a label line once the field holds a valid answer (Sam 2026-11-15:
 * « un petit vu vert sur les champs remplis »): 14 px, muted green, no text; decorative only,
 * the control keeps its own state for assistive technology. The caller decides `filled`.
 */
export function FilledCheck({ filled, className }: { filled: boolean; className?: string }) {
  if (!filled) return null;
  return <Check aria-hidden="true" weight="bold" className={cn("size-3.5 shrink-0 text-[#2f6f4f] dark:text-[#8cc5a4]", className)} />;
}
