"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import Link from "next/link";
import { useTranslation } from "react-i18next";

type Props = {
  nonce?: string;
  locale?: string;
};

const CONSENT_KEY = "cookieConsent"; // values: "accepted" | "declined"

function getStoredConsent(): "accepted" | "declined" | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "accepted" || v === "declined") return v;
  } catch {}
  return null;
}

function setConsent(value: "accepted" | "declined") {
  try {
    localStorage.setItem(CONSENT_KEY, value);
    // Also set a cookie for 365 days so SSR or edge can read it if needed later
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `${CONSENT_KEY}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  } catch {}
}

export default function CookieConsent({ nonce, locale = "fr" }: Props) {
  const { t } = useTranslation("cookie");
  const [consent, setConsentState] = useState<"accepted" | "declined" | null>(
    null
  );

  useEffect(() => {
    setConsentState(getStoredConsent());
  }, []);

  const measurementId = useMemo(
    () => process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA_ID,
    []
  );

  const accept = () => {
    setConsent("accepted");
    setConsentState("accepted");
  };
  const decline = () => {
    setConsent("declined");
    setConsentState("declined");
  };

  const legalCookiesHref = `/${locale}/legal/cookies`;

  return (
    <>
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
        <div className="fixed inset-x-0 bottom-0 z-50">
          <div className="mx-auto mb-4 max-w-4xl rounded-lg border border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 p-4 shadow-lg">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm leading-relaxed">
                <p className="font-medium mb-1">{t("Title")}</p>
                <p>
                  {t("Text")}{" "}
                  <Link href={legalCookiesHref} className="underline">
                    {t("LearnMore")}
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
                  {t("Decline")}
                </button>
                <button
                  type="button"
                  onClick={accept}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:opacity-90"
                >
                  {t("Accept")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
