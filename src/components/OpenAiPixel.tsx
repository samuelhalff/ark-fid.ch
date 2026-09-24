"use client";

/**
 * ChatGPT Ads measurement pixel (oaiq). Marketing tracking, so it loads only
 * once cookie consent is "accepted"; if consent is withdrawn the SDK is told
 * to stop. Rendered outside <Defer> so it exists before an early lead submit
 * (trackEvent("generate_lead") → registration_completed, see lib/analytics).
 * Add ?oaiq_debug=1 to any URL to see Pixel activity in the console.
 */

import { useEffect, useState } from "react";
import { getConsent, type ConsentPref } from "./ConsentAnalytics";

const OPENAI_PIXEL_ID = "QyP6CF1DnGvrLSxLza28qc";

export default function OpenAiPixel({ nonce }: { nonce?: string }) {
  const [consent, setConsent] = useState<ConsentPref>(null);

  useEffect(() => {
    setConsent(getConsent());
    const refresh = () => setConsent(getConsent());
    window.addEventListener("storage", refresh);
    window.addEventListener("cookie-consent-changed", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("cookie-consent-changed", refresh);
    };
  }, []);

  useEffect(() => {
    const w = window as any;
    if (consent !== "accepted") {
      if (typeof w.oaiq === "function") w.oaiq("consent", false);
      return;
    }
    if (typeof w.oaiq === "function") {
      w.oaiq("consent", true);
      return;
    }
    const q: any = function (...args: unknown[]) {
      q.q.push(args);
    };
    q.q = [];
    w.oaiq = q;
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://bzrcdn.openai.com/sdk/oaiq.min.js";
    if (nonce) s.setAttribute("nonce", nonce);
    document.head.appendChild(s);
    let debug = false;
    try {
      debug = new URLSearchParams(window.location.search).has("oaiq_debug");
    } catch {}
    w.oaiq("init", { pixelId: OPENAI_PIXEL_ID, debug });
  }, [consent, nonce]);

  return null;
}
