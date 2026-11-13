"use client";

import { Info } from "lucide-react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/src/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/src/components/ui/sheet";
import { Textarea } from "@/src/components/ui/textarea";
import { displayValue } from "@/src/lib/kyc-questionnaire/engine";
import type { Answers, FieldDef, KycLocale } from "@/src/lib/kyc-questionnaire/types";
import { SERVER_ERRORS, UI } from "@/src/lib/kyc-questionnaire/ui";
import { cn } from "@/src/lib/utils";
import { ApiError, api } from "./api";

/** What a field passes to let the client ask about it: the answers go with the question, « Utiliser » sets the value. */
export interface AskContext {
  field: FieldDef;
  answers: () => Answers;
  onUse: (value: string | string[]) => void;
}

type Reply = { offTopic: boolean; answer: string | null; proposal: string | string[] | null };

const PHONE = "(max-width: 639px)";
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const usePhone = () => useSyncExternalStore(subscribe, () => window.matchMedia(PHONE).matches, () => false);

/**
 * The small (i) button next to a question: its explanation and, for a field, « Poser une question ».
 * A popover on a wide screen; on a phone a bottom sheet that covers the step's buttons, so one
 * primary button is visible at a time (« Demander », then « Utiliser »). Keep it outside any
 * <label>, so tapping it never toggles the checkbox or radio the label belongs to.
 */
export function HelpHint({ text, title, locale, className, ask }: { text: string; title?: string; locale: KycLocale; className?: string; ask?: AskContext }) {
  const phone = usePhone();
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  const toggle = (next: boolean) => {
    if (next) setRound((n) => n + 1);
    setOpen(next);
  };
  const trigger = (
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
  );
  // Remounted on each opening: a closed (i) forgets its question and answer.
  const body = <HelpBody key={round} text={text} locale={locale} ask={ask} close={() => setOpen(false)} />;

  if (phone) {
    return (
      <Sheet open={open} onOpenChange={toggle}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl px-5 pt-5 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
          <SheetTitle className="pr-8 text-base leading-snug">{title || UI.helpButton[locale]}</SheetTitle>
          <SheetDescription className="sr-only">{text}</SheetDescription>
          {body}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={open} onOpenChange={toggle}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" collisionPadding={16} className="w-80 max-w-[calc(100vw-2rem)] max-h-[min(32rem,var(--radix-popover-content-available-height))] overflow-y-auto text-sm leading-relaxed">
        {body}
      </PopoverContent>
    </Popover>
  );
}

function HelpBody({ text, locale, ask, close }: { text: string; locale: KycLocale; ask?: AskContext; close: () => void }) {
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<Reply | null>(null);

  const send = async () => {
    const q = question.trim();
    if (!q || !ask || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await api.caseAction<Reply>("ask", { fieldId: ask.field.id, question: q, answers: ask.answers(), language: locale });
      setReply(result);
      setAsked(q);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "generic";
      setError((SERVER_ERRORS[code] || SERVER_ERRORS.assist_unavailable)[locale]);
    } finally {
      setPending(false);
    }
  };

  let tail: ReactNode = null;
  if (ask && reply) {
    const proposal = reply.offTopic ? null : reply.proposal;
    tail = (
      <div className="flex flex-col gap-3">
        <p className="break-words text-xs text-muted-foreground">{UI.askEcho[locale].replace("{question}", asked)}</p>
        <p className="break-words text-sm leading-relaxed" role="status">{reply.offTopic ? UI.askOffTopic[locale] : reply.answer}</p>
        {proposal !== null ? (
          <div className="flex flex-col gap-0.5 rounded-md bg-muted px-3 py-2">
            <span className="text-xs text-muted-foreground">{UI.askProposal[locale]}</span>
            <span className="break-words text-sm font-medium">{displayValue(ask.field, proposal, locale)}</span>
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant={proposal !== null ? "link" : "default"} className="h-11 sm:h-9" onClick={close}>
            {UI.askClose[locale]}
          </Button>
          {proposal !== null ? (
            <Button type="button" className="h-11 sm:h-9" onClick={() => { ask.onUse(proposal); close(); }}>
              {UI.askUse[locale]}
            </Button>
          ) : null}
        </div>
      </div>
    );
  } else if (ask && asking) {
    tail = (
      // The (i) sits inside the step's own form: React bubbles a portalled submit up to it, which would
      // move to the next step, so the event stops here.
      <form className="flex flex-col gap-2 border-t pt-3" onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); void send(); }}>
        <label htmlFor={`ask-${ask.field.id}`} className="text-xs font-medium">{UI.askLabel[locale]}</label>
        <Textarea id={`ask-${ask.field.id}`} rows={2} maxLength={500} autoFocus value={question} onChange={(e) => setQuestion(e.target.value)} className="text-base sm:text-sm" />
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        <Button type="submit" className="h-11 sm:h-9 sm:self-end" disabled={!question.trim() || pending}>
          {pending ? UI.askSending[locale] : UI.askSend[locale]}
        </Button>
      </form>
    );
  } else if (ask) {
    tail = (
      <Button type="button" variant="link" className="h-auto self-start p-0 text-sm" onClick={() => setAsking(true)}>
        {UI.askReveal[locale]}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Once answered, the answer takes the explanation's place: « Utiliser » stays in view. */}
      {ask && reply ? null : <p className="whitespace-pre-line text-sm leading-relaxed">{text}</p>}
      {tail}
    </div>
  );
}
