import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ANALYTICS_FREE_HEADER, analyticsFreeCsp, isAnalyticsFree } from "./analytics-free.ts";

const TRACKER_HOSTS = /googletagmanager|google-analytics|analytics\.google|doubleclick|posthog|openai|oaiq/i;

test("KYC and tax questionnaire pages are analytics-free", () => {
  assert.equal(isAnalyticsFree("kyc.ark-fid.ch", "/fr/"), true);
  assert.equal(isAnalyticsFree("kyc.ark-fid.ch", "/en/questionnaire-kyc/"), true);
  assert.equal(isAnalyticsFree("KYC.ark-fid.ch:443", "/fr/"), true);
  assert.equal(isAnalyticsFree("kyc.localhost", "/fr/"), true);
  assert.equal(isAnalyticsFree("tax.ark-fid.ch", "/de/"), true);
  assert.equal(isAnalyticsFree("ark-fid.ch", "/fr/questionnaire-kyc/"), true);
  assert.equal(isAnalyticsFree("ark-fid.ch", "/en/questionnaire-fiscal/"), true);
  assert.equal(isAnalyticsFree("ark-fid.ch", "/en/questionnaire-fiscal"), true);
});

test("the rest of the site keeps its measurement", () => {
  assert.equal(isAnalyticsFree("ark-fid.ch", "/fr/"), false);
  assert.equal(isAnalyticsFree("ark-fid.ch", "/fr/services/"), false);
  assert.equal(isAnalyticsFree("ark-fid.ch", "/fr/contact/"), false);
  assert.equal(isAnalyticsFree("ark-fid.ch", "/fr/ressources/kyc-explique/"), false);
  assert.equal(isAnalyticsFree("lba.ark-fid.ch", "/fr/"), false);
});

test("the analytics-free CSP allows no tracker host", () => {
  for (const isProd of [true, false]) {
    const csp = analyticsFreeCsp("abc123", isProd);
    assert.doesNotMatch(csp, TRACKER_HOSTS);
    const connect = csp.split("; ").find((d) => d.startsWith("connect-src")) || "";
    assert.doesNotMatch(connect, /\shttps:(\s|$)/, "no blanket https: in connect-src");
    const img = csp.split("; ").find((d) => d.startsWith("img-src")) || "";
    assert.doesNotMatch(img, /\shttps:(\s|$)/, "no blanket https: in img-src (pixel beacons)");
  }
  assert.match(analyticsFreeCsp("abc123", true), /'nonce-abc123'/);
});

test("middleware and root layout are wired to the analytics-free rule", () => {
  const middleware = readFileSync(new URL("../../middleware.ts", import.meta.url), "utf8");
  // kyc. branch, tax. branch and the main-host branch all use the header and the strict CSP.
  assert.equal(middleware.match(/requestHeaders\.set\(ANALYTICS_FREE_HEADER, "1"\)/g)?.length, 3);
  assert.equal(middleware.match(/analyticsFreeCsp\(nonce, isProd\)/g)?.length, 3);
  assert.match(middleware, /requestHeaders\.delete\(ANALYTICS_FREE_HEADER\)/);

  const layout = readFileSync(new URL("../../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /ANALYTICS_FREE_HEADER/);
  assert.match(layout, /analyticsFree \? null : \(\s*<script[\s\S]*?buildConsentBootstrap/);
  const gated = layout.slice(layout.indexOf("{analyticsFree ? null : (\n                <>"));
  for (const tracker of ["<CookieConsent", "<OpenAiPixel", "<AttributionTracker", "<EngagementTracker"]) {
    assert.ok(gated.includes(tracker), `${tracker} is rendered only outside analytics-free pages`);
    assert.equal(layout.split(tracker).length, 2, `${tracker} rendered once`);
  }
  assert.equal(ANALYTICS_FREE_HEADER, "x-analytics-free");
});

test("questionnaire components send nothing to analytics", () => {
  for (const file of [
    "../components/kyc-questionnaire/KycQuestionnaire.tsx",
    "../components/tax-questionnaire/TaxQuestionnaire.tsx",
    "./kyc-questionnaire/server/http.ts",
  ]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(src, /posthog-lazy|posthog-js|posthog-node|trackEvent|gtag|oaiq|posthog-workflow-logs/, file);
  }
  const lazy = readFileSync(new URL("./posthog-lazy.ts", import.meta.url), "utf8");
  assert.match(lazy, /analyticsFreePage\(\)\) return;/);
  const analytics = readFileSync(new URL("./analytics.ts", import.meta.url), "utf8");
  assert.match(analytics, /isAnalyticsFree\(window\.location\.hostname, window\.location\.pathname\)\) return;/);
});
