"use client";

/**
 * Safe GA4 event helper.
 *
 * gtag is only present after the user has made a cookie choice ("accepted" or
 * "minimal" — see CookieConsent). Under "minimal", analytics_storage stays
 * denied and events go out as cookieless Consent Mode pings, which is the
 * intended behavior. Before any choice, events are dropped.
 *
 * Never let analytics break product flows: this must not throw, and callers
 * must invoke it only after their own critical work succeeded.
 */
export type AnalyticsParams = Record<string, string | number | boolean>;

export function trackEvent(name: string, params?: AnalyticsParams) {
  try {
    if (typeof window === "undefined") return;
    const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", name, { transport_type: "beacon", ...params });
  } catch {
    // Analytics must never surface errors to users.
  }
}
