"use client";

import { useEffect, useState } from "react";

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

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
  const [AnalyticsComp, setAnalyticsComp] =
    useState<React.ComponentType | null>(null);

  useEffect(() => {
    setConsent(getConsent());
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONSENT_KEY) setConsent(getConsent());
    };
    const onCustom = (e: Event) => {
      // custom event dispatched by CookieConsent after user action
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

  useEffect(() => {
    let mounted = true;
    if (consent === "accepted" && !AnalyticsComp) {
      // Load Google Analytics if ID is provided
      const GA_ID =
        process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
        process.env.NEXT_PUBLIC_GA_ID ||
        "G-BXZ54E31FL";
      if (GA_ID && typeof window !== "undefined" && !window.gtag) {
        const script = document.createElement("script");
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
        script.async = true;
        document.head.appendChild(script);
        window.dataLayer = window.dataLayer || [];
        window.gtag = (...args: any[]) => {
          window.dataLayer.push(args);
        };
        window.gtag("js", new Date());
        window.gtag("config", GA_ID);
      }
      // Load Vercel Analytics
      import("@vercel/analytics/react")
        .then((mod) => {
          if (mounted) setAnalyticsComp(() => mod.Analytics);
        })
        .catch(() => {
          // ignore
        });
    }
    return () => {
      mounted = false;
    };
  }, [consent, AnalyticsComp]);

  if (consent !== "accepted" || !AnalyticsComp) return null;
  const C = AnalyticsComp;
  return <C />;
}
