import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";

import {
  CONSENT_DEFAULT_RULES,
  buildConsentBootstrap,
  detectAiSource,
  effectiveConsent,
  pickStoredConsent,
  buildSharedConsentCookie,
  sharedConsentDomain,
  normaliseStoredConsent,
  gaClientIdFromCookies,
} from "./consent-mode.ts";

type Run = { calls: unknown[][]; gtmCalls: unknown[]; scripts: { src: string; nonce?: string }[]; session: Record<string, string>; win: Record<string, unknown> };

function runBootstrap(opts: {
  stored?: string;
  cookie?: string;
  nonce?: string;
  cookiesEnabled?: boolean;
  /** Document state when the bootstrap runs; "complete" by default. */
  readyState?: string;
  /** Leaves the load listener and idle callbacks pending (see deferral test). */
  hold?: boolean;
  referrer?: string;
  search?: string;
  gtmId?: string;
  session?: Record<string, string>;
}): Run & { fireLoad: () => void; fireGesture: () => void; flushIdle: () => void; timers: number[]; idleOptions: unknown[] } {
  const loadListeners: (() => void)[] = [];
  const gestureListeners: (() => void)[] = [];
  const timers: number[] = [];
  const idleQueue: (() => void)[] = [];
  const idleOptions: unknown[] = [];
  const dataLayer: unknown[] = [];
  const scripts: { src: string; nonce?: string }[] = [];
  const head = {
    appendChild: (el: { src: string; nonce?: string }) => scripts.push(el),
  };
  const sandbox = {
    window: {
      addEventListener: (type: string, fn: () => void) => {
        if (type === "load") loadListeners.push(fn);
        else if (type === "pointerdown") gestureListeners.push(fn);
      },
      removeEventListener: () => {},
      requestIdleCallback: (fn: () => void, options: unknown) => {
        idleOptions.push(options);
        idleQueue.push(fn);
      },
    } as Record<string, unknown>,
    document: {
      cookie: opts.cookie || "",
      head,
      documentElement: head,
      readyState: opts.readyState ?? "complete",
      currentScript: opts.nonce ? { nonce: opts.nonce } : null,
      createElement: () => ({ src: "", async: false }),
    },
    navigator: { cookieEnabled: opts.cookiesEnabled !== false },
    location: { search: opts.search || "" },
    URL,
    URLSearchParams,
    Date,
    encodeURIComponent,
    setTimeout: (_fn: () => void, ms: number) => timers.push(ms),
  };
  (sandbox.document as Record<string, unknown>).referrer = opts.referrer || "";
  const session: Record<string, string> = { ...(opts.session || {}) };
  sandbox.window.sessionStorage = {
    getItem: (k: string) => (k in session ? session[k] : null),
    setItem: (k: string, v: string) => {
      session[k] = String(v);
    },
  };
  sandbox.window.dataLayer = dataLayer;
  sandbox.window.localStorage = {
    getItem: () => (opts.stored === undefined ? null : opts.stored),
  };
  vm.runInNewContext(buildConsentBootstrap("G-TEST1234", opts.gtmId), sandbox);
  const fireLoad = () => loadListeners.splice(0).forEach((fn) => fn());
  const fireGesture = () => gestureListeners.splice(0).forEach((fn) => fn());
  const flushIdle = () => idleQueue.splice(0).forEach((fn) => fn());
  if (!opts.hold) {
    fireLoad();
    fireGesture();
    flushIdle();
  }
  // Normalise objects created inside the vm realm.
  return {
    calls: JSON.parse(
      JSON.stringify(dataLayer.map((entry) => Array.from(entry as ArrayLike<unknown>))),
    ),
    gtmCalls: JSON.parse(
      JSON.stringify(
        ((sandbox.window.gtmDataLayer as unknown[]) || []).map((entry) =>
          entry && typeof entry === "object" && "length" in (entry as object) ? Array.from(entry as ArrayLike<unknown>) : entry,
        ),
      ),
    ),
    scripts,
    session,
    win: sandbox.window,
    fireLoad,
    fireGesture,
    flushIdle,
    idleOptions,
    timers,
  };
}

test("bootstrap grants all four signals by default, everywhere, before js/config", () => {
  const { calls, scripts } = runBootstrap({});
  const commands = calls.map((c) => `${c[0]}:${c[1]}`);
  assert.equal(CONSENT_DEFAULT_RULES.length, 1);
  assert.deepEqual(commands.slice(0, 1), ["consent:default"]);
  const state = calls[0][2] as Record<string, unknown>;
  assert.equal(state.region, undefined);
  for (const key of ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"]) {
    assert.equal(state[key], "granted", key);
  }
  // undecided: no update (ignoring the banner = accepting)
  assert.equal(commands.includes("consent:update"), false);
  const jsIndex = calls.findIndex((c) => c[0] === "js");
  const configIndex = commands.indexOf("config:G-TEST1234");
  assert.ok(jsIndex > 0 && configIndex > jsIndex);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-TEST1234");
});

test("bootstrap always loads gtm.js on its own layer with the same consent defaults", () => {
  const run = runBootstrap({ gtmId: "GTM-ABCD123", readyState: "loading", hold: true });
  assert.equal(run.scripts.length, 0, "nothing before load + idle");
  const firstGtm = run.gtmCalls[0] as unknown[];
  assert.deepEqual(firstGtm.slice(0, 2), ["consent", "default"]);
  assert.equal((firstGtm[2] as Record<string, unknown>).ad_personalization, "granted");
  run.fireLoad();
  run.fireGesture();
  run.flushIdle();
  assert.deepEqual(
    run.scripts.map((s) => s.src),
    [
      "https://www.googletagmanager.com/gtag/js?id=G-TEST1234",
      "https://www.googletagmanager.com/gtm.js?id=GTM-ABCD123&l=gtmDataLayer",
    ],
  );
  const layer = (run.win.gtmDataLayer as unknown[]).map((e) => JSON.parse(JSON.stringify(e)));
  assert.ok(layer.some((e) => e && e.event === "gtm.js"));
});

test("a stored refusal reaches the GTM layer too", () => {
  const run = runBootstrap({ gtmId: "GTM-ABCD123", cookie: "cookieConsent=minimal" });
  const update = (run.gtmCalls as unknown[][]).find((c) => Array.isArray(c) && c[0] === "consent" && c[1] === "update");
  assert.equal((update?.[2] as Record<string, unknown>).ad_storage, "denied");
});

test("bootstrap ignores an invalid GTM id", () => {
  const run = runBootstrap({ gtmId: "GTM-1');x(//" });
  assert.equal(run.scripts.length, 1);
});

test("effective consent: granted unless refused", () => {
  assert.equal(effectiveConsent(null), true);
  assert.equal(effectiveConsent("accepted"), true);
  assert.equal(effectiveConsent("refused"), false);
  // A future regional opt-in rule only needs a different default.
  assert.equal(effectiveConsent(null, false), false);
  assert.equal(effectiveConsent("accepted", false), true);
});

test("AI assistant referrers map to fixed labels", () => {
  assert.equal(detectAiSource("https://chatgpt.com/", null), "chatgpt");
  assert.equal(detectAiSource("https://www.perplexity.ai/search?q=x", null), "perplexity");
  assert.equal(detectAiSource("https://claude.ai/chat/123", null), "claude");
  assert.equal(detectAiSource("https://copilot.microsoft.com/", null), "copilot");
  assert.equal(detectAiSource("https://gemini.google.com/app", null), "gemini");
  assert.equal(detectAiSource("https://www.google.com/", null), null);
  assert.equal(detectAiSource("https://notclaude.ai/", null), null);
  assert.equal(detectAiSource("", "chatgpt.com"), "chatgpt");
  assert.equal(detectAiSource(null, "Perplexity"), "perplexity");
  assert.equal(detectAiSource(null, "newsletter"), null);
  assert.equal(detectAiSource("not a url", null), null);
});

test("bootstrap sets ai_source as event param and user property before config", () => {
  const run = runBootstrap({ referrer: "https://chatgpt.com/c/abc" });
  const setUser = run.calls.findIndex((c) => c[0] === "set" && c[1] === "user_properties");
  const configIndex = run.calls.findIndex((c) => c[0] === "config");
  assert.ok(setUser >= 0 && setUser < configIndex);
  assert.deepEqual(run.calls[setUser][2], { ai_source: "chatgpt" });
  assert.ok(run.calls.some((c) => c[0] === "set" && JSON.stringify(c[1]) === JSON.stringify({ ai_source: "chatgpt" })));
  assert.equal(run.session.ai_source, "chatgpt");
  assert.equal(run.win.__aiSource, "chatgpt");
  const utm = runBootstrap({ search: "?utm_source=perplexity.ai" });
  assert.equal(utm.win.__aiSource, "perplexity");
  const kept = runBootstrap({ session: { ai_source: "claude" } });
  assert.equal(kept.win.__aiSource, "claude");
  const refused = runBootstrap({ referrer: "https://claude.ai/", cookie: "cookieConsent=minimal" });
  assert.equal(refused.session.ai_source, undefined, "no storage after a refusal");
  assert.equal(refused.win.__aiSource, "claude");
  const none = runBootstrap({ referrer: "https://www.google.com/" });
  assert.equal(none.calls.some((c) => c[0] === "set" && c[1] === "user_properties"), false);
});

test("bootstrap queues consent and config at once but loads gtag.js after load, in idle time", () => {
  const run = runBootstrap({ readyState: "loading", hold: true, nonce: "abc" });
  const commands = run.calls.map((c) => `${c[0]}:${c[1]}`);
  assert.deepEqual(commands.slice(0, 1), ["consent:default"]);
  assert.ok(commands.includes("config:G-TEST1234"));
  assert.equal(run.scripts.length, 0, "no script before the load event");
  run.fireLoad();
  assert.equal(run.scripts.length, 0, "no script before the first gesture");
  assert.deepEqual(run.timers, [8000], "fallback after 8 s without a gesture");
  run.fireGesture();
  assert.equal(run.scripts.length, 0, "no script before idle time");
  assert.deepEqual(JSON.parse(JSON.stringify(run.idleOptions)), [{ timeout: 3000 }]);
  run.flushIdle();
  assert.equal(run.scripts.length, 1);
  assert.equal(run.scripts[0].src, "https://www.googletagmanager.com/gtag/js?id=G-TEST1234");
  assert.equal(run.scripts[0].nonce, "abc", "nonce captured before the deferral");
});

test("bootstrap applies a stored acceptance as an update without region", () => {
  const { calls } = runBootstrap({ cookie: "cookieConsent=accepted" });
  const update = calls.find((c) => c[0] === "consent" && c[1] === "update");
  assert.ok(update);
  const state = update[2] as Record<string, unknown>;
  assert.equal(state.region, undefined);
  assert.equal(state.analytics_storage, "granted");
  assert.equal(state.ad_storage, "granted");
  assert.equal(state.ad_user_data, "granted");
  assert.equal(state.ad_personalization, "granted");
  const updateIndex = calls.indexOf(update);
  const configIndex = calls.findIndex((c) => c[0] === "config");
  assert.ok(updateIndex < configIndex);
});

for (const legacy of ["minimal", "declined"]) {
  test(`bootstrap treats legacy "${legacy}" as refused (all denied)`, () => {
    const { calls } = runBootstrap({ cookie: `cookieConsent=${legacy}` });
    const update = calls.find((c) => c[0] === "consent" && c[1] === "update");
    assert.ok(update);
    const state = update[2] as Record<string, unknown>;
    for (const key of ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"]) {
      assert.equal(state[key], "denied");
    }
  });
}

test("bootstrap reads the consent cookie and forwards the nonce", () => {
  const { calls, scripts } = runBootstrap({
    cookie: "foo=1; cookieConsent=accepted",
    nonce: "abc123",
  });
  const update = calls.find((c) => c[0] === "consent" && c[1] === "update");
  assert.equal((update?.[2] as Record<string, unknown>).analytics_storage, "granted");
  assert.equal(scripts[0].nonce, "abc123");
});

test("bootstrap rejects unsafe measurement ids", () => {
  assert.throws(() => buildConsentBootstrap("G-1');alert(1);//"));
});

test("normaliseStoredConsent maps old and new values", () => {
  assert.equal(normaliseStoredConsent("accepted"), "accepted");
  assert.equal(normaliseStoredConsent("minimal"), "refused");
  assert.equal(normaliseStoredConsent("declined"), "refused");
  assert.equal(normaliseStoredConsent("other"), null);
  assert.equal(normaliseStoredConsent(null), null);
});

test("GA client id is read unless the visitor refused", () => {
  const cookies = "foo=1; _ga=GA1.1.1194917214.1689149133; _ga_ABC=GS1.1.x";
  assert.equal(gaClientIdFromCookies(cookies, "accepted"), "1194917214.1689149133");
  // Undecided: the default grants analytics storage.
  assert.equal(gaClientIdFromCookies(cookies, null), "1194917214.1689149133");
  assert.equal(gaClientIdFromCookies(cookies, "refused"), undefined);
  assert.equal(gaClientIdFromCookies("foo=1", null), undefined);
  assert.equal(gaClientIdFromCookies("_ga=GA1.1.abc.def", null), undefined);
  assert.equal(gaClientIdFromCookies("_ga_ABC=GS1.1.1.2", null), undefined);
});

test("cookie is authoritative; localStorage only counts without cookies", () => {
  // Invalid local value never hides a valid cookie (e.g. a refusal).
  assert.equal(pickStoredConsent("garbage", "minimal", true), "minimal");
  assert.equal(pickStoredConsent("accepted", "declined", true), "declined");
  // Cookie expired (12 months) while localStorage remains: undecided again.
  assert.equal(pickStoredConsent("accepted", null, true), null);
  // Cookies blocked: the localStorage entry is the only store.
  assert.equal(pickStoredConsent("declined", null, false), "declined");
  assert.equal(pickStoredConsent("garbage", null, false), null);
});

test("the cookie shared by all ark-fid.ch hosts wins over this host's cookie", () => {
  assert.equal(pickStoredConsent(null, "accepted", true, "minimal"), "minimal");
  assert.equal(pickStoredConsent(null, "accepted", true, "garbage"), "accepted");
  assert.equal(pickStoredConsent("accepted", null, false, "declined"), "declined");
  assert.equal(pickStoredConsent("accepted", null, true, null), null);
});

test("shared cookie is scoped to .ark-fid.ch only", () => {
  assert.equal(sharedConsentDomain("tax.ark-fid.ch"), ".ark-fid.ch");
  assert.equal(sharedConsentDomain("ark-fid.ch"), ".ark-fid.ch");
  assert.equal(sharedConsentDomain("evil-ark-fid.ch"), null);
  assert.equal(sharedConsentDomain("localhost"), null);
  assert.match(buildSharedConsentCookie("accepted", "lba.ark-fid.ch", true), /^ark_consent=accepted; Path=\/; Max-Age=31536000; SameSite=Lax; Domain=\.ark-fid\.ch; Secure$/);
  assert.doesNotMatch(buildSharedConsentCookie("minimal", "localhost", false), /Domain|Secure/);
});

test("bootstrap reads the shared cookie first", () => {
  const run = runBootstrap({ cookie: "cookieConsent=accepted; ark_consent=minimal" });
  const update = run.calls.find((c) => c[0] === "consent" && c[1] === "update");
  assert.equal((update?.[2] as Record<string, unknown>).analytics_storage, "denied");
  const invalid = runBootstrap({ cookie: "ark_consent=x; cookieConsent=accepted" });
  const accepted = invalid.calls.find((c) => c[0] === "consent" && c[1] === "update");
  assert.equal((accepted?.[2] as Record<string, unknown>).analytics_storage, "granted");
});

test("bootstrap follows the same storage rule", () => {
  const refused = runBootstrap({ stored: "garbage", cookie: "cookieConsent=minimal" });
  const update = refused.calls.find((c) => c[0] === "consent" && c[1] === "update");
  assert.equal((update?.[2] as Record<string, unknown>).analytics_storage, "denied");
  const expired = runBootstrap({ stored: "accepted" });
  assert.equal(expired.calls.some((c) => c[0] === "consent" && c[1] === "update"), false);
  const noCookies = runBootstrap({ stored: "accepted", cookiesEnabled: false });
  const local = noCookies.calls.find((c) => c[0] === "consent" && c[1] === "update");
  assert.equal((local?.[2] as Record<string, unknown>).analytics_storage, "granted");
});
