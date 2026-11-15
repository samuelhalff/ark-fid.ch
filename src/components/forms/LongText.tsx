"use client";

import { useState } from "react";
import { cn } from "@/src/lib/utils";

/** Over this length (or three lines), a read-only text shows three lines and « Voir tout ». */
export const isLongText = (text: string) => text.length > 160 || text.split("\n").length > 3;

/**
 * A read-only value (a prefilled purpose, a long remark on the review screen): a long one is
 * clamped to three lines with a « Voir tout » / « Réduire » toggle, labels in the page's language.
 */
export function LongText({ text, showAll, showLess, className }: { text: string; showAll: string; showLess: string; className?: string }) {
  const [all, setAll] = useState(false);
  const long = isLongText(text);
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <p className={cn("whitespace-pre-line [overflow-wrap:anywhere]", long && !all && "line-clamp-3")}>{text}</p>
      {long ? (
        <button type="button" className="self-start py-1 text-sm text-brand-hover underline-offset-2 hover:underline" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? showLess : showAll}
        </button>
      ) : null}
    </div>
  );
}
