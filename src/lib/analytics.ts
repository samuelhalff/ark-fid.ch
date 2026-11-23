"use client";

import posthog from "@/src/lib/posthog-lazy";
import { getAttribution } from "@/src/lib/attribution";
import { AI_SOURCE_KEY, gaClientIdFromCookies, readConsentChoice } from "@/src/lib/consent-mode";
import { isAnalyticsFree } from "@/src/lib/analytics-free";

const posthogConfigured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST);
const posthogEvents = new Set([
  "agent_first_message",
  "contact_form_start",
  "form_submit_error",
  "generate_lead",
]);

/**
 * Safe GA4 event helper.
 *
 * gtag is defined for every visitor by the Consent Mode bootstrap in
 * app/layout.tsx. Whether an event sets cookies or goes out as a cookieless
 * ping is decided by the consent state (regional default or the visitor's
 * choice), not here.
 *
 * Never let analytics break product flows: this must not throw, and callers
 * must invoke it only after their own critical work succeeded.
 */
export type AnalyticsParams = Record<string, string | number | boolean>;

export function trackEvent(name: string, params?: AnalyticsParams) {
  // KYC and tax questionnaire pages: nothing leaves the browser (src/lib/analytics-free.ts).
  if (typeof window !== "undefined" && isAnalyticsFree(window.location.hostname, window.location.pathname)) return;
  if (name === "generate_lead") {
    params = { ...leadContext(), ...params };
    trackOpenAiLead();
    mirrorToGtm(name, params);
  }
  try {
    if (typeof window === "undefined") return;
    if (posthogConfigured && posthogEvents.has(name)) posthog.capture(name, params);
    const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", name, { transport_type: "beacon", ...params });
  } catch {
    // Analytics must never surface errors to users.
  }
}

/**
 * Campaign context of the visit for generate_lead: the first-touch UTM values
 * kept for the session (src/lib/attribution.ts) and the AI assistant that
 * sent the visitor (ai_source, set by the consent bootstrap). Prefixed names,
 * GA4 reserves source/medium/campaign for its own campaign handling.
 */
export function leadContext(): AnalyticsParams {
  const out: AnalyticsParams = {};
  try {
    const utm = getAttribution()?.utm;
    if (utm) {
      if (utm.source) out.lead_utm_source = utm.source;
      if (utm.medium) out.lead_utm_medium = utm.medium;
      if (utm.campaign) out.lead_utm_campaign = utm.campaign;
      if (utm.term) out.lead_utm_term = utm.term;
      if (utm.content) out.lead_utm_content = utm.content;
    }
    const w = window as { __aiSource?: string };
    let ai = w.__aiSource;
    if (!ai) {
      try {
        ai = window.sessionStorage.getItem(AI_SOURCE_KEY) || undefined;
      } catch {}
    }
    if (ai) out.ai_source = ai;
  } catch {}
  return out;
}

/**
 * GTM has its own dataLayer (created by the consent bootstrap, gtm.js loads
 * for every visitor); lead events are copied there. Consent Mode decides
 * what its tags may do.
 */
function mirrorToGtm(name: string, params?: AnalyticsParams) {
  try {
    if (typeof window === "undefined") return;
    const layer = (window as { gtmDataLayer?: unknown[] }).gtmDataLayer;
    if (!Array.isArray(layer)) return;
    layer.push({ event: name, ...params });
  } catch {
    // Analytics must never surface errors to users.
  }
}

/**
 * ChatGPT Ads conversion: a lead (contact form or instant quote) counts as
 * "registration_completed". window.oaiq only exists where OpenAiPixel loaded
 * it (effective consent: every visitor unless refused), so this is consent-gated by construction. GA4 keeps the per-channel split (method).
 */
function trackOpenAiLead() {
  try {
    if (typeof window === "undefined") return;
    const oaiq = (window as { oaiq?: (...args: unknown[]) => void }).oaiq;
    if (typeof oaiq !== "function") return;
    const eventId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    oaiq(
      "measure",
      "registration_completed",
      { type: "customer_action" },
      { event_id: eventId }
    );
  } catch {
    // Ads measurement must never surface errors to users.
  }
}

/**
 * GA client id for lead submissions: sent whenever a _ga cookie exists and
 * the visitor has not refused (see gaClientIdFromCookies).
 */
export function getGaClientId(): string | undefined {
  try {
    if (typeof document === "undefined") return undefined;
    return gaClientIdFromCookies(document.cookie, readConsentChoice());
  } catch {
    return undefined;
  }
}
