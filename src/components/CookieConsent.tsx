"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CookieIcon } from "@/src/components/icons/CookieIcon";
import { cn } from "@/src/lib/utils";
import {
  CONSENT_KEY,
  normaliseStoredConsent,
  readStoredConsentValue,
  updateConsentMode,
  writeStoredConsent,
  type StoredConsent,
} from "@/src/lib/consent-mode";

type Props = {
  nonce?: string;
  locale?: string;
  labels: {
    Title: string;
    Text: string;
    LearnMore: string;
    Accept: string;
    Decline: string;
    Manage: string;
    Minimal?: string;
    Full?: string;
  };
};

type ConsentValue = StoredConsent;

function getStoredConsent(): ConsentValue | null {
  return readStoredConsentValue();
}

function setConsent(value: ConsentValue) {
  // Shared .ark-fid.ch cookie (one choice for all sub-domains), legacy cookie and localStorage.
  writeStoredConsent(value);
}

export default function CookieConsent({ locale = "fr", labels }: Props) {
  const [consent, setConsentState] = useState<ConsentValue | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const manageBtnRef = useRef<HTMLButtonElement | null>(null);
  const pathname = usePathname();
  const hideManageButton = /(^|\/)agent(\/|$)/.test(pathname || "");
  // 44px hit area (button) around a 36px neutral disc (span), bottom-left so it
  // never sits on the WhatsApp/chat bubbles or the sticky CTA.
  const cookieButtonPositionClasses =
    "fixed left-3 bottom-[var(--floating-whatsapp-bottom)] z-40 sm:left-5";
  const cookieButtonLayoutClasses =
    "group flex size-11 items-center justify-center rounded-full";
  const cookieButtonFocusClasses =
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
  const cookieDiscClasses =
    "flex size-9 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors duration-200 group-hover:text-foreground";

  const focusWithoutScroll = (el: HTMLElement | null) => {
    if (!el) return;
    try {
      // @ts-ignore - older TS lib definitions miss FocusOptions
      el.focus({ preventScroll: true });
    } catch {
      const win = typeof window !== "undefined" ? window : null;
      const x = win?.scrollX ?? 0;
      const y = win?.scrollY ?? 0;
      el.focus?.();
      if (win && (win.scrollX !== x || win.scrollY !== y)) {
        win.scrollTo(x, y);
      }
    }
  };

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored === "declined") {
      setConsent("minimal");
      setConsentState("minimal");
    } else {
      setConsentState(stored);
    }
    const handler = () => setConsentState(null);
    // Choice made in another tab: apply it here too (Consent Mode, banner,
    // and listeners such as GTM loading and attribution storage).
    const onStorage = (e: StorageEvent) => {
      if (e.key !== CONSENT_KEY) return;
      const value = getStoredConsent();
      if (!value) return;
      setConsentState(value);
      updateConsentMode(normaliseStoredConsent(value) ?? "refused");
      try {
        window.dispatchEvent(
          new CustomEvent("cookie-consent-changed", { detail: value }),
        );
      } catch {}
    };
    window.addEventListener("open-cookie-settings", handler);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("open-cookie-settings", handler);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  // The floating WhatsApp button reads the banner height only when the banner
  // appears or goes away, instead of watching every DOM change in the page.
  useEffect(() => {
    window.dispatchEvent(new Event("cookie-banner-change"));
  }, [consent]);
  // Minimal focus trap when the dialog is open
  useEffect(() => {
    if (consent !== null) return; // only when banner is visible
    const root = dialogRef.current;
    if (!root) return;
    const focusable = root.querySelectorAll<HTMLElement>(
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    // Focus the panel itself (no ring on a link before any gesture) and
    // avoid scrolling the page to the bottom.
    focusWithoutScroll(root);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (focusable.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first || document.activeElement === root) {
          focusWithoutScroll(last ?? null);
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          focusWithoutScroll(first ?? null);
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [consent]);

  const accept = () => {
    setConsent("accepted");
    setConsentState("accepted");
    try {
      window.dispatchEvent(
        new CustomEvent("cookie-consent-changed", { detail: "accepted" }),
      );
    } catch {}
    updateConsentMode("accepted");
    // Return focus to manage button for a11y
    setTimeout(() => focusWithoutScroll(manageBtnRef.current), 0);
  };
  const enableMinimal = () => {
    setConsent("minimal");
    setConsentState("minimal");
    try {
      window.dispatchEvent(
        new CustomEvent("cookie-consent-changed", { detail: "minimal" }),
      );
    } catch {}
    updateConsentMode("refused");
    setTimeout(() => focusWithoutScroll(manageBtnRef.current), 0);
  };

  const legalCookiesHref = `/${locale}/legal/cookies/`;
  const minimalLabel = labels.Minimal || labels.Decline || "Refuse";
  const fullLabel = labels.Full || labels.Accept || "Full consent";

  return (
    <>
      {/* Floating manage button: available after initial decision, and also before decision if user wants to open banner proactively. Hidden while banner is visible. */}
      {consent !== null && !hideManageButton && (
        <button
          type="button"
          ref={manageBtnRef}
          onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent("open-cookie-settings"));
            } catch {}
          }}
          className={cn(
            cookieButtonPositionClasses,
            cookieButtonLayoutClasses,
            cookieButtonFocusClasses,
          )}
          aria-label={labels.Manage}
        >
          <span className={cookieDiscClasses} aria-hidden="true">
            <CookieIcon className="size-5" />
          </span>
          <span className="sr-only">{labels.Manage}</span>
        </button>
      )}

      {/* GA4 itself is loaded for every visitor by the consent bootstrap in
          app/layout.tsx (Consent Mode v2 with regional defaults). This
          component only stores the choice and sends consent updates. */}

      {/* Banner */}
      {consent === null && (
        <div
          className="fixed inset-x-0 bottom-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-consent-title"
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="outline-none mx-2 mb-2 max-w-4xl rounded-lg border-t border-border bg-card p-3 shadow-lg sm:mx-auto sm:mb-4 sm:p-4"
          >
            <div className="flex flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-xs leading-snug sm:text-sm sm:leading-relaxed">
                <p id="cookie-consent-title" className="font-medium mb-0.5 sm:mb-1">
                  {labels.Title}
                </p>
                <p>
                  {labels.Text}{" "}
                  <Link
                    href={legalCookiesHref}
                    className="underline"
                    prefetch={false}
                  >
                    {labels.LearnMore}
                  </Link>
                  .
                </p>
              </div>
              <div className="flex gap-2 shrink-0 max-md:[&>button]:flex-1">
                <button
                  type="button"
                  onClick={enableMinimal}
                  className="inline-flex items-center justify-center rounded-md bg-surface-warm px-3 py-2 text-sm max-sm:py-1.5 shadow-sm hover:bg-muted"
                >
                  {minimalLabel}
                </button>
                <button
                  type="button"
                  onClick={accept}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm max-sm:py-1.5 text-primary-foreground hover:opacity-90"
                >
                  {fullLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
