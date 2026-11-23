import assert from "node:assert/strict";
import test from "node:test";

import {
  ATTRIBUTION_MAX_PAGES,
  addAttributionPage,
  analyticsAttribution,
  canalAcquisition,
  isConversionEvent,
  withConversionAttribution,
  cleanPathname,
  getAttributionPayload,
  createAttribution,
  parseStoredAttribution,
  referrerOrigin,
} from "./attribution.ts";
import { detectAiSource } from "./consent-mode.ts";

test("createAttribution keeps pathname, allowlisted params and referrer origin only", () => {
  const a = createAttribution(
    "https://ark-fid.ch/fr/services/?utm_source=google&utm_medium=cpc&utm_campaign=<b>brand</b>&gclid=abc.123&email=x@y.ch#top",
    "https://www.google.com/search?q=fiduciaire+geneve",
  );
  assert.equal(a.landingPage, "/fr/services/");
  assert.equal(a.referrer, "https://www.google.com");
  assert.equal(a.utm.source, "google");
  assert.equal(a.utm.medium, "cpc");
  assert.equal(a.utm.campaign, "bbrand/b");
  assert.equal(a.gclid, "abc.123");
  assert.deepEqual(a.pages, ["/fr/services/"]);
  assert.equal(JSON.stringify(a).includes("email"), false);
  assert.equal(JSON.stringify(a).includes("q="), false);
});

test("same-site and non-http referrers are dropped", () => {
  assert.equal(referrerOrigin("https://www.ark-fid.ch/fr/", "ark-fid.ch"), "");
  assert.equal(referrerOrigin("android-app://com.google", "ark-fid.ch"), "");
  assert.equal(referrerOrigin("not a url", "ark-fid.ch"), "");
  assert.equal(referrerOrigin("https://linkedin.com/feed/x", "ark-fid.ch"), "https://linkedin.com");
});

test("page trail is deduplicated, query-free and capped", () => {
  let a = createAttribution("https://ark-fid.ch/fr/", "");
  a = addAttributionPage(a, "/fr/");
  a = addAttributionPage(a, "/fr/contact/?x=1#y");
  a = addAttributionPage(a, "/fr/contact/");
  assert.deepEqual(a.pages, ["/fr/", "/fr/contact/"]);
  for (let i = 0; i < 40; i += 1) a = addAttributionPage(a, `/fr/p${i}`);
  assert.equal(a.pages.length, ATTRIBUTION_MAX_PAGES);
});

test("cleanPathname rejects non-paths and strips query/hash", () => {
  assert.equal(cleanPathname("https://evil.example/x"), "");
  assert.equal(cleanPathname("/a?b=c#d"), "/a");
  assert.equal(cleanPathname("/" + "x".repeat(500)).length, 200);
});

test("parseStoredAttribution re-validates stored data", () => {
  const parsed = parseStoredAttribution(
    JSON.stringify({
      landingPage: "/fr/?utm_source=x",
      referrer: "https://google.com",
      utm: { source: "a\nb" },
      gclid: "g",
      pages: ["/a", "/a", "bad", "/b?c"],
    }),
  );
  assert.ok(parsed);
  assert.equal(parsed.landingPage, "/fr/");
  assert.equal(parsed.utm.source, "ab");
  assert.deepEqual(parsed.pages, ["/a", "/b"]);
  assert.equal(parseStoredAttribution("{broken"), null);
  assert.equal(parseStoredAttribution(null), null);
});

/* First-touch acquisition channel (classifier ported from guide-assurance.ch). */
const H = "ark-fid.ch";
const canal = (r: string, q: string) => canalAcquisition(r, q, H, detectAiSource(r, new URLSearchParams(q).get("utm_source")) || "");

test("canalAcquisition classifies the first page of the visit", () => {
  const cases: [string, string, string][] = [
    ["https://www.google.com/", "", "google"], ["https://www.google.ch/", "", "google"], ["android-app://com.google.android.googlequicksearchbox/", "", "google"],
    ["https://www.bing.com/search?q=x", "", "bing"], ["https://duckduckgo.com/", "", "autre_recherche"], ["https://www.ecosia.org/", "", "autre_recherche"], ["https://search.brave.com/", "", "autre_recherche"],
    ["https://chatgpt.com/", "", "ia"], ["", "?utm_source=chatgpt.com", "ia"], ["https://www.perplexity.ai/", "", "ia"], ["https://gemini.google.com/app", "", "ia"],
    ["https://copilot.microsoft.com/", "", "ia"], ["https://claude.ai/", "", "ia"],
    ["https://www.facebook.com/", "", "reseau_social"], ["https://t.co/abc", "", "reseau_social"], ["https://www.linkedin.com/", "", "reseau_social"], ["", "?utm_source=linkedin&utm_medium=social", "reseau_social"],
    ["https://www.moneyhouse.ch/fr/", "", "referent"], ["", "?utm_source=newsletter&utm_medium=email", "referent"],
    ["", "", "direct"], ["https://ark-fid.ch/fr/contact/", "", "direct"], ["https://www.ark-fid.ch/", "", "direct"], ["pas une adresse", "", "direct"],
    ["https://www.google.com/", "?gclid=abc", "payant"], ["", "?utm_source=google&utm_medium=cpc", "payant"], ["https://www.bing.com/", "?msclkid=1", "payant"], ["", "?gbraid=x", "payant"],
    ["", "?utm_source=google&utm_medium=organic", "google"],
  ];
  for (const [r, q, exp] of cases) assert.equal(canal(r, q), exp, `canal(${r || "∅"}, ${q || "∅"})`);
});

const attr = (href: string, ref: string) =>
  analyticsAttribution(createAttribution(href, ref, detectAiSource(ref, new URL(href).searchParams.get("utm_source")) || ""));

test("analyticsAttribution: channel, domain, landing pathname, utm and AI label only", () => {
  assert.deepEqual(attr("https://ark-fid.ch/fr/comptabilite/?utm_source=chatgpt.com&utm_medium=referral", ""), {
    canal: "ia", page_arrivee: "/fr/comptabilite/", utm_source: "chatgpt.com", utm_medium: "referral", ai_source: "chatgpt",
  });
  assert.deepEqual(attr("https://ark-fid.ch/fr/", "https://www.google.ch/search?q=fiduciaire"), { canal: "google", referent_domaine: "google.ch", page_arrivee: "/fr/" });
  const a = attr("https://ark-fid.ch/fr/?gclid=secret&email=a@b.ch&q=x", "");
  assert.equal(a.canal, "payant");
  assert.equal(JSON.stringify(a).includes("secret"), false, "never the gclid");
  assert.equal(JSON.stringify(a).includes("a@b.ch"), false, "never other parameters");
  assert.equal(attr("https://ark-fid.ch/" + "a".repeat(300), "").page_arrivee.length, 100);
  assert.equal(attr("https://ark-fid.ch/y/", "https://ark-fid.ch/x/").referent_domaine, undefined);
  assert.deepEqual(analyticsAttribution(null), {});
});

test("stored copies keep or derive the channel; the lead payload shape is unchanged", () => {
  const stored = parseStoredAttribution(JSON.stringify({ landingPage: "/fr/", referrer: "https://www.google.com", utm: {}, gclid: "", pages: ["/fr/"] }));
  assert.equal(stored?.canal, "google");
  const kept = parseStoredAttribution(JSON.stringify({ landingPage: "/fr/", referrer: "", utm: {}, canal: "ia", aiSource: "perplexity", pages: [] }));
  assert.equal(kept?.canal, "ia");
  assert.equal(kept?.aiSource, "perplexity");
  assert.equal(parseStoredAttribution(JSON.stringify({ landingPage: "/", canal: "nimporte" }))?.canal, "direct");
  assert.deepEqual(Object.keys(getAttributionPayload()).sort(), ["gclid", "landingPage", "pages", "referrer", "utm"]);
});

test("conversion events carry the same attribution; own properties win; others unchanged", () => {
  const a = attr("https://ark-fid.ch/fr/fiscalite/?utm_campaign=impots", "https://www.google.com/");
  const lead = withConversionAttribution("generate_lead", { method: "contact_form", form_id: "contact" }, a);
  assert.deepEqual(lead, { canal: "google", referent_domaine: "google.com", page_arrivee: "/fr/fiscalite/", utm_campaign: "impots", method: "contact_form", form_id: "contact" });
  const keys = (o: unknown) => ["canal", "referent_domaine", "page_arrivee", "utm_campaign"].map((k) => (o as Record<string, unknown>)[k]);
  for (const name of ["contact_form_start", "contact_form_started", "contact_form_submitted", "agent_open", "agent_first_message", "agent_lead_confirmed", "contact_channel_click"]) {
    assert.deepEqual(keys(withConversionAttribution(name, { form_id: "x" }, a)), keys(lead), name);
  }
  assert.ok(isConversionEvent("select_content", { content_type: "cta", item_id: "tel" }));
  assert.ok(isConversionEvent("select_content", { content_type: "cta", item_id: "whatsapp" }));
  assert.equal(isConversionEvent("select_content", { content_type: "service_card", item_id: "tel" }), false);
  assert.deepEqual(withConversionAttribution("scroll", { percent_scrolled: 90 }, a), { percent_scrolled: 90 });
  assert.equal((withConversionAttribution("generate_lead", { canal: "x" }, a) as Record<string, unknown>).canal, "x");
  assert.deepEqual(withConversionAttribution("generate_lead", { form_id: "contact" }, {}), { form_id: "contact" }, "refused: unchanged");
});
