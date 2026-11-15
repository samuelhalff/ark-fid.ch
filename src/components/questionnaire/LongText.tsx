"use client";

import { useState } from "react";
import { cn } from "@/src/lib/utils";

/** Over this length (or that many lines), a text shows its first lines and « Voir tout ». */
export const isLongText = (text: string, lines: 2 | 3 = 3) => text.length > (lines === 2 ? 110 : 160) || text.split("\n").length > lines;

/**
 * A read-only value (a prefilled purpose, a long remark on the review screen): a long one is
 * clamped to three lines with a « Voir tout » / « Réduire » toggle, labels in the page's language.
 */
export function LongText({ text, showAll, showLess, className, lines = 3 }: { text: string; showAll: string; showLess: string; className?: string; lines?: 2 | 3 }) {
  const [all, setAll] = useState(false);
  const long = isLongText(text, lines);
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <p className={cn("whitespace-pre-line [overflow-wrap:anywhere]", long && !all && (lines === 2 ? "line-clamp-2" : "line-clamp-3"))}>{text}</p>
      {long ? (
        <button type="button" className="min-h-11 self-start py-1 text-sm text-brand-hover underline-offset-2 hover:underline" aria-expanded={all} onClick={() => setAll((v) => !v)}>
          {all ? showLess : showAll}
        </button>
      ) : null}
    </div>
  );
}
