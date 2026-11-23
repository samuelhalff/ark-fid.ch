import assert from "node:assert/strict";
import test from "node:test";

import { classifyLinkClick, newScrollThresholds, scrollPercent, webVitalParams } from "./engagement.ts";
import { isReplayExcluded } from "./replay-policy.ts";

const HERE = "https://ark-fid.ch/fr/services/";

test("scroll thresholds fire once each", () => {
  assert.deepEqual(newScrollThresholds(30, new Set()), [25]);
  assert.deepEqual(newScrollThresholds(95, new Set([25])), [50, 75, 90]);
  assert.deepEqual(newScrollThresholds(95, new Set([25, 50, 75, 90])), []);
  assert.equal(scrollPercent(500, 1000, 2000), 50);
  assert.equal(scrollPercent(0, 1000, 800), 100);
});

test("outbound links carry link_domain, without query string", () => {
  const [hit] = classifyLinkClick("https://www.admin.ch/gov/fr?x=secret", HERE);
  assert.equal(hit.event, "click");
  assert.deepEqual(hit.params, { link_domain: "admin.ch", link_url: "https://www.admin.ch/gov/fr", outbound: true });
  assert.deepEqual(classifyLinkClick("/fr/team/", HERE), []);
  assert.deepEqual(classifyLinkClick("https://tax.ark-fid.ch/fr/", HERE), [], "own sub-domain is not outbound");
});

test("file downloads", () => {
  const [hit] = classifyLinkClick("/assets/guide%20tva.pdf?v=2", HERE);
  assert.equal(hit.event, "file_download");
  assert.equal(hit.params.file_extension, "pdf");
  assert.equal((hit.params as { file_name: string }).file_name, "guide tva.pdf");
});

test("CTAs and service cards become select_content", () => {
  assert.deepEqual(classifyLinkClick("/fr/contact/", HERE), [{ event: "select_content", params: { content_type: "cta", item_id: "contact" } }]);
  assert.deepEqual(classifyLinkClick("/en/agent", HERE)[0].params, { content_type: "cta", item_id: "agent" });
  assert.deepEqual(classifyLinkClick("/fr/services/payroll/", HERE)[0].params, { content_type: "service_card", item_id: "services/payroll" });
  assert.deepEqual(classifyLinkClick("tel:+41220000000", HERE)[0].params, { content_type: "cta", item_id: "tel" });
  const wa = classifyLinkClick("https://wa.me/41790000000?text=hi", HERE);
  assert.deepEqual(wa.map((h) => h.event), ["click", "select_content"]);
  const explicit = classifyLinkClick("/fr/contact/", HERE, { contentType: "hero_cta", itemId: "home" });
  assert.deepEqual(explicit, [{ event: "select_content", params: { content_type: "hero_cta", item_id: "home" } }]);
});

test("web vitals are integers", () => {
  assert.deepEqual(webVitalParams({ name: "CLS", value: 0.0523, rating: "good" }), { metric_name: "CLS", metric_value: 52, metric_rating: "good", non_interaction: true });
  assert.equal(webVitalParams({ name: "LCP", value: 1234.6 }).metric_value, 1235);
});

test("replay never runs on pages with client data", () => {
  assert.equal(isReplayExcluded("ark-fid.ch", "/fr/services/"), false);
  assert.equal(isReplayExcluded("ark-fid.ch", "/fr/"), false);
  assert.equal(isReplayExcluded("ark-fid.ch", "/fr/questionnaire-kyc/"), true);
  assert.equal(isReplayExcluded("ark-fid.ch", "/en/questionnaire-fiscal/"), true);
  assert.equal(isReplayExcluded("kyc.ark-fid.ch", "/fr/"), true);
  assert.equal(isReplayExcluded("tax.ark-fid.ch", "/de/"), true);
  assert.equal(isReplayExcluded("ark-fid.ch", "/fr/agent/"), true);
  assert.equal(isReplayExcluded("ark-fid.ch", "/fr/contact/"), true);
});
