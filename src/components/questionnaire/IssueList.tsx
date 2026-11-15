"use client";

import { WarningCircle } from "@phosphor-icons/react";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { focusField } from "@/src/lib/questionnaire/form-values";
import type { Issue } from "@/src/lib/questionnaire/issues";
import { fill, useKit } from "./kit";

/** Under an error notice: each field to fix, a link that scrolls to it and focuses it. */
export function IssueLinks({ issues }: { issues: Issue[] }) {
  if (!issues.length) return null;
  return (
    <ul className="mt-2 list-disc pl-5">
      {issues.map((issue, i) => (
        // Several answers of one component (the KYC holders) point to the same control: the label and place keep keys unique.
        <li key={`${issue.name}|${issue.label}|${i}`}>
          <button type="button" className="text-left underline underline-offset-2" onClick={() => focusField(issue.name)}>
            {issue.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export type MissingItem = Issue & { stepId: string };

/**
 * On the review screen, before anyone presses « Envoyer »: « Il manque 3 réponses », then each one
 * as « Screen › Question », a link back to it.
 */
export function MissingAnswers({ items, where, onGo }: { items: MissingItem[]; where: (stepId: string) => string | null; onGo: (item: MissingItem) => void }) {
  const { strings } = useKit();
  if (!items.length) return null;
  return (
    <Alert variant="destructive">
      <WarningCircle className="size-4" />
      <AlertDescription>
        <p className="font-medium">{missingLabel(strings, items.length)}</p>
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((item, i) => {
            const screen = where(item.stepId);
            return (
              <li key={`${item.name}|${item.label}|${i}`}>
                <button type="button" className="min-h-11 py-1 text-left underline underline-offset-2 [overflow-wrap:anywhere]" onClick={() => onGo(item)}>
                  {screen ? `${screen} › ` : ""}
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

/** « Il manque 1 réponse » / « Il manque {n} réponses ». */
export const missingLabel = (strings: { missingOne: string; missingMany: string }, n: number) => (n === 1 ? strings.missingOne : fill(strings.missingMany, { n }));
