"use client";

import { cn } from "@/src/lib/utils";

export type ReviewRow = {
  label: string;
  /** The answer, one or more lines; or `lines` for an indented list (the holders). */
  value?: string;
  lines?: { depth: number; text: string }[];
  /** The screen the answer is on: a click on the row goes back there. */
  stepId: string;
  /** Shown in red (a required document still missing). */
  missing?: boolean;
};

/**
 * The review screen: each answered question on its own line, the answer under it, nothing else.
 * Empty answers are left out by the caller. A click on a row goes back to its screen to correct it.
 */
export function ReviewList({ rows, onEdit }: { rows: ReviewRow[]; onEdit: (stepId: string) => void }) {
  return (
    <ul className="flex flex-col">
      {rows.map((row, i) => (
        <li key={i}>
          <button type="button" className="-mx-2 flex w-[calc(100%+1rem)] min-w-0 flex-col gap-0.5 rounded-md px-2 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" onClick={() => onEdit(row.stepId)}>
            <span className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{row.label}</span>
            {row.lines ? (
              <span className="flex flex-col gap-0.5">
                {row.lines.map((line, j) => (
                  <span key={j} className="[overflow-wrap:anywhere]" style={{ paddingLeft: `${line.depth - 1}rem` }}>
                    {line.text}
                  </span>
                ))}
              </span>
            ) : (
              <span className={cn("whitespace-pre-line [overflow-wrap:anywhere]", row.missing && "font-medium text-destructive")}>{row.value}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
