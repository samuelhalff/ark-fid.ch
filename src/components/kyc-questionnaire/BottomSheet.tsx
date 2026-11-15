"use client";

import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Button } from "@/src/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/src/components/ui/sheet";
import { UI } from "@/src/lib/kyc-questionnaire/ui";
import type { KycLocale } from "@/src/lib/kyc-questionnaire/types";

/**
 * A panel that rises from the bottom (phone first, centred column on a computer): a title, a 44 px
 * close button in the form's language, then its content. Closing never saves anything by itself.
 */
export function BottomSheet({ open, title, locale, onClose, children, description }: { open: boolean; title: string; locale: KycLocale; onClose: () => void; children: ReactNode; description?: string }) {
  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent
        side="bottom"
        hideClose
        className="mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col gap-4 overflow-y-auto rounded-t-2xl border-t bg-card px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6"
        aria-describedby={undefined}
      >
        <span aria-hidden="true" className="mx-auto mt-1 h-1 w-10 shrink-0 rounded-full bg-border" />
        <div className="flex min-w-0 items-center justify-between gap-2">
          <SheetTitle className="min-w-0 text-lg leading-6 font-semibold [overflow-wrap:anywhere]">{title}</SheetTitle>
          <Button type="button" variant="ghost" size="icon" className="-mr-2 size-11 shrink-0 text-muted-foreground" aria-label={UI.holdersClose[locale]} onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
        {description ? <SheetDescription className="-mt-2 text-sm text-muted-foreground">{description}</SheetDescription> : <></>}
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
