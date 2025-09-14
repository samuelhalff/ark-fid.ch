"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";

const CONSENT_KEY = "cookieConsent";

function getConsent(): "accepted" | "declined" | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    if (v === "accepted" || v === "declined") return v;
  } catch {}
  return null;
}

export default function ConsentAnalytics() {
  const [consent, setConsent] = useState<"accepted" | "declined" | null>(null);

  useEffect(() => {
    setConsent(getConsent());
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY) setConsent(getConsent());
    };
    const onCustom = (e: Event) => {
      // custom event dispatched by CookieConsent after user action
      // @ts-ignore detail may be string|null
      const val = (e as CustomEvent).detail;
      if (val === "accepted" || val === "declined" || val === null) {
        setConsent(val);
      } else {
        setConsent(getConsent());
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(
      "cookie-consent-changed",
      onCustom as EventListener
    );
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        "cookie-consent-changed",
        onCustom as EventListener
      );
    };
  }, []);

  if (consent !== "accepted") return null;
  return <Analytics />;
}
