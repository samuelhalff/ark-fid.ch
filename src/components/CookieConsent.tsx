"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";
import Link from "next/link";

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
  };
};

const CONSENT_KEY = "cookieConsent"; // values: "accepted" | "declined"

function getStoredConsent(): "accepted" | "declined" | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "accepted" || v === "declined") return v;
    return null;
  } catch (e) {
    // localStorage unavailable (private browsing, etc.)
    // Fallback: check cookie
    try {
      const cookieMatch = document.cookie.match(
        new RegExp(`(?:^|; )${CONSENT_KEY}=([^;]*)`)
      );
      if (cookieMatch) {
        const val = cookieMatch[1];
        if (val === "accepted" || val === "declined") return val;
      }
    } catch {}
    return null;
  }
}

function setConsent(value: "accepted" | "declined") {
  // Set cookie first (always works)
  const maxAge = 60 * 60 * 24 * 365; // 365 days
  try {
    document.cookie = `${CONSENT_KEY}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  } catch {}
  
  // Try localStorage as primary storage
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // localStorage blocked (private browsing mode) - cookie fallback is already set
  }
}

export default function CookieConsent({ nonce, locale = "fr", labels }: Props) {
  const [consent, setConsentState] = useState<"accepted" | "declined" | null>(
    null
  );
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const manageBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setConsentState(getStoredConsent());
    const handler = () => setConsentState(null);
    window.addEventListener("open-cookie-settings", handler);
    return () => window.removeEventListener("open-cookie-settings", handler);
  }, []);

  // Minimal focus trap when the dialog is open
  useEffect(() => {
    if (consent !== null) return; // only when banner is visible
    const root = dialogRef.current;
    if (!root) return;
    const focusable = root.querySelectorAll<HTMLElement>(
      'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (focusable.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          last?.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === last) {
          first?.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [consent]);

  const measurementId = useMemo(
    () =>
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
      process.env.NEXT_PUBLIC_GA_ID ||
      "G-BXZ54E31FL",
    []
  );

  const accept = () => {
    setConsent("accepted");
    setConsentState("accepted");
    try {
      window.dispatchEvent(
        new CustomEvent("cookie-consent-changed", { detail: "accepted" })
      );
    } catch {}
    // Return focus to manage button for a11y
    setTimeout(() => manageBtnRef.current?.focus(), 0);
  };
  const decline = () => {
    setConsent("declined");
    setConsentState("declined");
    try {
      window.dispatchEvent(
        new CustomEvent("cookie-consent-changed", { detail: "declined" })
      );
    } catch {}
    // Return focus to manage button for a11y
    setTimeout(() => manageBtnRef.current?.focus(), 0);
  };

  const legalCookiesHref = `/${locale}/legal/cookies`;

  return (
    <>
      {/* Floating manage button: available after initial decision, and also before decision if user wants to open banner proactively. Hidden while banner is visible. */}
      {consent !== null && (
        <button
          type="button"
          ref={manageBtnRef}
          onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent("open-cookie-settings"));
            } catch {}
          }}
          className="fixed right-4 bottom-4 z-40 rounded-full border border-input bg-background/95 px-4 py-2 text-xs shadow-sm hover:bg-muted"
          aria-label={labels.Manage}
        >
          {labels.Manage}
        </button>
      )}

      {/* Load GA only when consent is accepted and measurement ID is configured */}
      {consent === "accepted" && measurementId ? (
        <>
          <Script
            nonce={nonce}
            id="ga4-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" nonce={nonce} strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);} 
              gtag('js', new Date());
              // Signal granted consent
              gtag('consent', 'update', { ad_storage: 'granted', analytics_storage: 'granted' });
              gtag('config', '${measurementId}', { anonymize_ip: true });
            `}
          </Script>
        </>
      ) : null}

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
            className="mx-auto mb-4 max-w-4xl rounded-lg border border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 p-4 shadow-lg"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm leading-relaxed">
                <p id="cookie-consent-title" className="font-medium mb-1">
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
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={decline}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-transparent px-3 py-2 text-sm hover:bg-muted"
                >
                  {labels.Decline}
                </button>
                <button
                  type="button"
                  onClick={accept}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
                >
                  {labels.Accept}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
