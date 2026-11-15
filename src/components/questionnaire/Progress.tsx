"use client";

import type { AnyAnswers } from "@/src/lib/questionnaire/form-values";
import { cn } from "@/src/lib/utils";
import { fill, useKit, type LabelText } from "./kit";

const sep = (locale: string) => (locale === "fr" ? " : " : ": ");
/** Swiss formats for the save time, in the page's language. */
const TIME_LOCALE: Record<string, string> = { fr: "fr-CH", de: "de-CH", en: "en-GB" };

/**
 * Progress by screen: the counted screens numbered 1…n, then the review (✓); earlier screens are
 * buttons back to them. `steps` holds the counted screens and, last, the review.
 */
export function StepRail({ steps, current, onGo, answers }: { steps: { id: string; title: LabelText; special?: string }[]; current: string; onGo: (id: string) => void; answers?: AnyAnswers }) {
  const kit = useKit();
  const index = steps.findIndex((s) => s.id === current);
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => {
        const title = kit.t(s.title, answers);
        const review = s.special === "review";
        const text = review ? "✓" : String(i + 1);
        const here = i === index;
        const done = i < index;
        const className = cn(
          "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
          here ? "bg-primary text-primary-foreground" : done ? "bg-surface-warm text-foreground dark:bg-card" : "text-muted-foreground shadow-[inset_0_0_0_1px_rgba(20,16,14,0.16)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]",
        );
        const name = review ? title : `${fill(kit.strings.stepOf, { n: i + 1, total: steps.length - 1 })}${sep(kit.locale)}${title}`;
        return (
          <li key={s.id}>
            {done ? (
              <button type="button" className={cn(className, "hover:ring-2 hover:ring-ring/50")} onClick={() => onGo(s.id)} aria-label={name} title={title}>
                {text}
              </button>
            ) : (
              <span className={className} aria-current={here ? "step" : undefined} aria-label={name} title={title}>
                {text}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export type SaveState = { state: "idle" | "saving" | "saved" | "failed"; at?: string | number | null };

/** « Enregistré à 14:05 » beside the rail (announced politely). */
export function SaveStatus({ save }: { save: { state: string; at?: string | number | null } }) {
  const { strings, locale } = useKit();
  const text =
    save.state === "saving"
      ? strings.saving
      : save.state === "saved" && save.at
        ? fill(strings.savedAt, { time: new Date(save.at).toLocaleTimeString(TIME_LOCALE[locale] || "fr-CH", { hour: "2-digit", minute: "2-digit" }) })
        : save.state === "failed"
          ? strings.saveFailed
          : "";
  return (
    <span className="text-xs text-muted-foreground" aria-live="polite">
      {text}
    </span>
  );
}

/** The sticky bar under the page title: where the client is (the rail) and when the draft was saved. */
export function ProgressBar({ steps, current, onGo, save, answers }: { steps: { id: string; title: LabelText; special?: string }[]; current: string; onGo: (id: string) => void; save: { state: string; at?: string | number | null }; answers?: AnyAnswers }) {
  return (
    <div className="sticky top-16 z-20 -mx-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 bg-background/95 px-5 py-2 backdrop-blur sm:mx-0 sm:rounded-xl sm:px-0">
      <StepRail steps={steps} current={current} onGo={onGo} answers={answers} />
      <SaveStatus save={save} />
    </div>
  );
}
