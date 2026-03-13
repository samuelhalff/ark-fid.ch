"use client";

import { useEffect, useState } from "react";

import { WhatsAppIcon } from "@/src/components/icons/WhatsAppIcon";
import { cn } from "@/src/lib/utils";
import {
  WHATSAPP_NUMBER,
  WHATSAPP_URL,
} from "@/src/lib/whatsapp";

const FLOATING_VISIBILITY_SYNC_DELAY_MS = 180;

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
  const [isFloatingVisible, setIsFloatingVisible] = useState(false);

  useEffect(() => {
    if (variant !== "floating") return;

    let mutationObserver: MutationObserver | null = null;
    let frameId: ReturnType<typeof requestAnimationFrame> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const syncFloatingState = () => {
      setIsFloatingVisible(
        !document.querySelector<HTMLElement>(
          '[aria-labelledby="cookie-consent-title"]'
        )
      );
    };

    const scheduleSync = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(syncFloatingState);
    };

    scheduleSync();
    timeoutId = setTimeout(scheduleSync, FLOATING_VISIBILITY_SYNC_DELAY_MS);

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
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      if (timeoutId !== null) clearTimeout(timeoutId);
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
          "group inline-flex max-w-full items-center gap-2.5 text-left text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md",
          className
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#25D366]/20 bg-[#25D366]/8 text-[#1f9d55] transition-colors duration-200 group-hover:border-[#25D366]/35 group-hover:bg-[#25D366]/12">
          <WhatsAppIcon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">
            {badgeText}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
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
      className={cn(
        "whatsapp-float-entry group fixed right-4 z-40 bottom-[var(--floating-whatsapp-bottom)] flex size-12 items-center justify-center rounded-full border border-border/70 bg-background/92 text-[#1f9d55] shadow-md backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-[#25D366]/35 hover:bg-background hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:right-6",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="whatsapp-float-pulse absolute inset-0 rounded-full bg-[#25D366]/12"
      />
      <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-[#25D366]/8">
        <WhatsAppIcon className="size-5" />
      </span>
      <span className="sr-only">
        {badgeText} - {ctaLabel}
      </span>
    </a>
  );
}
