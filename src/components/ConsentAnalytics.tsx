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
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (consent !== "accepted") return null;
  return <Analytics />;
}
