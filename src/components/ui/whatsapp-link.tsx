"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/src/components/ui/badge";
import { WhatsAppIcon } from "@/src/components/icons/WhatsAppIcon";
import { cn } from "@/src/lib/utils";
import {
  WHATSAPP_NUMBER,
  WHATSAPP_URL,
} from "@/src/lib/whatsapp";

const COOKIE_DIALOG_SPACING = 16;

type WhatsAppLinkProps = {
  badgeText: string;
  ctaLabel: string;
  variant?: "floating" | "badge";
  className?: string;
};

export default function WhatsAppLink({
  badgeText,
  ctaLabel,
  variant = "floating",
  className,
}: WhatsAppLinkProps) {
  const [isFloatingVisible, setIsFloatingVisible] = useState(variant !== "floating");
  const [floatingBottom, setFloatingBottom] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (variant !== "floating") return;

    let observer: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let frameId = 0;
    let timeoutId = 0;

    const syncFloatingState = () => {
      const cookieDialog = document.querySelector<HTMLElement>(
        '[aria-labelledby="cookie-consent-title"]'
      );
      setFloatingBottom(
        cookieDialog
          ? `calc(env(safe-area-inset-bottom, 0px) + ${Math.ceil(cookieDialog.getBoundingClientRect().height) + COOKIE_DIALOG_SPACING}px)`
          : undefined
      );
      setIsFloatingVisible(true);

      observer?.disconnect();
      observer = null;

      if (cookieDialog && typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => {
          if (frameId) window.cancelAnimationFrame(frameId);
          frameId = window.requestAnimationFrame(syncFloatingState);
        });
        observer.observe(cookieDialog);
      }
    };

    const scheduleSync = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(syncFloatingState);
    };

    scheduleSync();
    timeoutId = window.setTimeout(scheduleSync, 180);

    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver(scheduleSync);
      mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    window.addEventListener("resize", scheduleSync);
    window.addEventListener("cookie-consent-changed", scheduleSync);
    window.addEventListener("open-cookie-settings", scheduleSync);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      if (timeoutId) window.clearTimeout(timeoutId);
      observer?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("cookie-consent-changed", scheduleSync);
      window.removeEventListener("open-cookie-settings", scheduleSync);
    };
  }, [variant]);

  if (variant === "badge") {
    return (
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${ctaLabel} ${WHATSAPP_NUMBER}`}
        className={cn(
          "group inline-flex max-w-full items-center gap-3 rounded-full border border-[#25D366]/20 bg-background/90 px-4 py-3 text-left shadow-[0_12px_35px_rgba(37,211,102,0.14)] backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-[#25D366]/35 hover:shadow-[0_16px_38px_rgba(37,211,102,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className
        )}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_22px_rgba(37,211,102,0.35)] transition-transform duration-200 group-hover:scale-105">
          <WhatsAppIcon className="size-5" />
        </span>
        <span className="min-w-0">
          <Badge
            variant="secondary"
            className="border border-[#25D366]/15 bg-[#25D366]/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.18em] text-[#128C7E]"
          >
            {badgeText}
          </Badge>
          <span className="mt-1 block truncate text-sm font-semibold text-foreground">
            {WHATSAPP_NUMBER}
          </span>
        </span>
      </a>
    );
  }

  if (!isFloatingVisible) return null;

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${ctaLabel} ${WHATSAPP_NUMBER}`}
      style={floatingBottom ? { bottom: floatingBottom } : undefined}
      className={cn(
        "whatsapp-float-entry group fixed right-4 z-40 bottom-[var(--floating-whatsapp-bottom)] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-white/20 bg-[#25D366] px-3.5 py-3 text-white shadow-[0_18px_40px_rgba(37,211,102,0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_46px_rgba(37,211,102,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:right-6 sm:px-4",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="whatsapp-float-pulse absolute inset-0 rounded-full bg-[#25D366]/30"
      />
      <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white/18">
        <WhatsAppIcon className="size-5" />
      </span>
      <span className="relative hidden pr-1 text-sm font-semibold sm:inline">
        {badgeText}
      </span>
      <span className="sr-only">{ctaLabel}</span>
    </a>
  );
}
