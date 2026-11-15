import { Check } from "@phosphor-icons/react";
import { isFilled } from "@/src/lib/kyc-questionnaire/engine";
import type { FieldDef } from "@/src/lib/kyc-questionnaire/types";
import { cn } from "@/src/lib/utils";

/**
 * The quiet mark at the end of a label line once the field holds a valid answer (Sam 2026-11-15:
 * « un petit vu vert sur les champs remplis »): 14 px, muted green, no text; decorative only,
 * the control keeps its own state for assistive technology. The tax questionnaire passes `filled`
 * (its own validator decides), the KYC form its field and value.
 */
export function FilledCheck({ field, value, filled, className }: { field?: FieldDef; value?: unknown; filled?: boolean; className?: string }) {
  if (!(filled ?? (field ? isFilled(field, value) : false))) return null;
  return <Check aria-hidden="true" weight="bold" className={cn("size-3.5 shrink-0 text-[#2f6f4f] dark:text-[#8cc5a4]", className)} />;
}
