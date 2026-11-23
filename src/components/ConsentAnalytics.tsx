/**
 * GTM and GA4 are both loaded by the Consent Mode bootstrap in app/layout.tsx
 * (buildConsentBootstrap), for every visitor after load + idle; Consent Mode
 * governs what the tags do. GTM runs on its own layer (GTM_DATA_LAYER).
 */
import { readStoredConsentValue, type StoredConsent } from "@/src/lib/consent-mode";

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
    gtmDataLayer?: any[];
  }
}

export { GTM_DATA_LAYER } from "@/src/lib/consent-mode";

export type ConsentPref = StoredConsent | null;

export function getConsent(): ConsentPref {
  return readStoredConsentValue();
}
