"use client";

import dynamic from "next/dynamic";

export const CookieConsent = dynamic(
  () => import("@/src/components/CookieConsent"),
  { ssr: false, loading: () => null }
);
