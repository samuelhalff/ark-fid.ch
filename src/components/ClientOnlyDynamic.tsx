"use client";

import dynamic from "next/dynamic";

export const CookieConsent = dynamic(
  () => import("@/src/components/CookieConsent"),
  { ssr: false, loading: () => null }
);

export const ConsentAnalytics = dynamic(
  () => import("@/src/components/ConsentAnalytics"),
  { ssr: false, loading: () => null }
);
