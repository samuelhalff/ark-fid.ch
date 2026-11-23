/**
 * Google Consent Mode v2 helpers shared by the root layout bootstrap, the
 * cookie banner and the analytics helpers. Dependency-free so it can be unit
 * tested with `node --test`.
 *
 * Legal line (Sam, 23.11.2026, decided knowing the GDPR/Planet49 risk for
 * EU/EEA/UK visitors, see docs/DECISIONS.md and the privacy/cookie policy):
 * everywhere, a visitor who ignores the banner is treated like one who
 * clicked "Accepter": all four Consent Mode signals granted by default,
 * PostHog persistent with replay, OpenAI pixel loaded. Only "Refuser" stops
 * it. A stored choice always overrides the default.
 *
 * The defaults are a list of rules (CONSENT_DEFAULT_RULES, most specific
 * region first, last rule without region = rest of world) so a regional
 * split can be restored by adding a rule, e.g.
 * { region: EEA_UK_REGIONS, granted: false, waitForUpdate: 500 }. Client-side
 * tools follow defaultGrantedClientSide(), which must then be revisited too
 * (the browser does not know Google's IP region).
 */

export const CONSENT_KEY = "cookieConsent";

/** Values written by current and older banner versions. */
export type StoredConsent = "accepted" | "minimal" | "declined";
/** Normalised choice: accepted = all granted, refused = all denied. */
export type ConsentChoice = "accepted" | "refused";

export type ConsentModeState = {
  ad_storage: "granted" | "denied";
  analytics_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
};

/** EEA member states (EU 27 + IS, LI, NO) and the United Kingdom. */
export const EEA_UK_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL",
  "PT", "RO", "SK", "SI", "ES", "SE", "GB",
] as const;

export type ConsentDefaultRule = {
  /** ISO 3166 codes; omitted = every other region. */
  region?: readonly string[];
  granted: boolean;
  /** ms the tags wait for the banner's update (opt-in regions). */
  waitForUpdate?: number;
};

/** Single rule since 23.11.2026: granted everywhere until "Refuser". */
export const CONSENT_DEFAULT_RULES: readonly ConsentDefaultRule[] = [{ granted: true }];

/** Default for our own client-side tools (PostHog, OpenAI pixel, attribution session copy). */
export function defaultGrantedClientSide(): boolean {
  return CONSENT_DEFAULT_RULES.every((rule) => rule.granted);
}

/** Stored choice wins; otherwise the default (granted). */
export function effectiveConsent(choice: ConsentChoice | null, defaultGranted = defaultGrantedClientSide()): boolean {
  if (choice === "accepted") return true;
  if (choice === "refused") return false;
  return defaultGranted;
}

/** Browser: may our own tools store identifiers and measure fully right now? */
export function hasEffectiveConsent(): boolean {
  if (typeof window === "undefined") return false;
  return effectiveConsent(readConsentChoice());
}

/** Known AI assistants (referrer host or utm_source value) → ai_source label. */
export const AI_SOURCES: ReadonlyArray<[string, string]> = [
  ["chatgpt.com", "chatgpt"],
  ["chat.openai.com", "chatgpt"],
  ["perplexity.ai", "perplexity"],
  ["claude.ai", "claude"],
  ["copilot.microsoft.com", "copilot"],
  ["copilot.cloud.microsoft", "copilot"],
  ["gemini.google.com", "gemini"],
  ["bard.google.com", "gemini"],
  ["chat.deepseek.com", "deepseek"],
  ["chat.mistral.ai", "mistral"],
  ["meta.ai", "meta_ai"],
  ["grok.com", "grok"],
  ["you.com", "you"],
  ["phind.com", "phind"],
  ["kagi.com", "kagi"],
];

function matchAiHost(host: string): string | null {
  const h = host.toLowerCase().replace(/^www\./, "");
  if (!h) return null;
  for (const [domain, label] of AI_SOURCES) {
    if (h === domain || h.endsWith(`.${domain}`)) return label;
  }
  return null;
}

/**
 * ai_source from the referrer (host only) or utm_source (ChatGPT adds
 * utm_source=chatgpt.com). Returns a fixed label, never the raw value.
 */
export function detectAiSource(referrer: string | null | undefined, utmSource: string | null | undefined): string | null {
  if (referrer) {
    try {
      const fromRef = matchAiHost(new URL(referrer).hostname);
      if (fromRef) return fromRef;
    } catch {}
  }
  const utm = (utmSource || "").trim().toLowerCase();
  if (!utm) return null;
  const byHost = matchAiHost(utm);
  if (byHost) return byHost;
  const labels = new Set(AI_SOURCES.map(([, label]) => label));
  return labels.has(utm) ? utm : null;
}

export const AI_SOURCE_KEY = "ai_source";

export function consentStateFor(granted: boolean): ConsentModeState {
  const value = granted ? "granted" : "denied";
  return {
    ad_storage: value,
    analytics_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  };
}

/** Maps any stored value (old or new) to a concrete choice, or null. */
export function normaliseStoredConsent(value: unknown): ConsentChoice | null {
  if (value === "accepted") return "accepted";
  if (value === "minimal" || value === "declined") return "refused";
  return null;
}

function isStoredConsent(value: unknown): value is StoredConsent {
  return value === "accepted" || value === "minimal" || value === "declined";
}

/**
 * Cookie shared by ark-fid.ch and its sub-domains (tax., lba.): one choice
 * covers them all. Same values and 12-month lifetime as the host cookie
 * CONSENT_KEY; host-only outside ark-fid.ch (localhost, previews).
 */
export const SHARED_CONSENT_COOKIE = "ark_consent";
export const SHARED_CONSENT_DOMAIN = ".ark-fid.ch";
const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

/** Domain attribute for the shared cookie, or null for a host-only cookie. */
export function sharedConsentDomain(hostname: string): string | null {
  const host = hostname.toLowerCase();
  return host === "ark-fid.ch" || host.endsWith(".ark-fid.ch") ? SHARED_CONSENT_DOMAIN : null;
}

/** document.cookie string for the shared consent cookie. */
export function buildSharedConsentCookie(value: StoredConsent, hostname: string, secure: boolean): string {
  const domain = sharedConsentDomain(hostname);
  return [
    `${SHARED_CONSENT_COOKIE}=${value}`,
    "Path=/",
    `Max-Age=${CONSENT_MAX_AGE}`,
    "SameSite=Lax",
    ...(domain ? [`Domain=${domain}`] : []),
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

/**
 * Picks the stored choice from the cookies and the localStorage mirror.
 * Cookies carry the 12-month expiry stated in the cookies policy, so they
 * win: first the cookie shared by all ark-fid.ch hosts (latest choice made on
 * any of them), then this host's cookie. The localStorage entry only counts
 * where the browser cannot store cookies at all. An expired cookie therefore
 * means "undecided" again, and an invalid value never hides a valid cookie.
 */
export function pickStoredConsent(
  localValue: string | null,
  cookieValue: string | null,
  cookiesEnabled: boolean,
  sharedCookieValue: string | null = null
): StoredConsent | null {
  if (isStoredConsent(sharedCookieValue)) return sharedCookieValue;
  if (isStoredConsent(cookieValue)) return cookieValue;
  if (!cookiesEnabled && isStoredConsent(localValue)) return localValue;
  return null;
}

/** Raw stored value (see pickStoredConsent). */
export function readStoredConsentValue(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  let localValue: string | null = null;
  let cookieValue: string | null = null;
  let sharedValue: string | null = null;
  let cookiesEnabled = true;
  try {
    localValue = window.localStorage.getItem(CONSENT_KEY);
  } catch {
    localValue = null;
  }
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${CONSENT_KEY}=([^;]*)`),
    );
    cookieValue = match ? match[1] : null;
    const shared = document.cookie.match(
      new RegExp(`(?:^|; )${SHARED_CONSENT_COOKIE}=([^;]*)`),
    );
    sharedValue = shared ? shared[1] : null;
  } catch {
    cookieValue = null;
  }
  try {
    cookiesEnabled = navigator.cookieEnabled !== false;
  } catch {
    cookiesEnabled = true;
  }
  const value = pickStoredConsent(localValue, cookieValue, cookiesEnabled, sharedValue);
  // A choice made before the shared cookie existed is copied into it once.
  if (value && isStoredConsent(cookieValue) && !isStoredConsent(sharedValue)) writeSharedCookie(value);
  return value;
}

function writeSharedCookie(value: StoredConsent) {
  try {
    document.cookie = buildSharedConsentCookie(value, window.location.hostname, window.location.protocol === "https:");
  } catch {
    // Cookies blocked: the localStorage mirror is the fallback.
  }
}

/** Stores a choice: shared cookie, this host's cookie (read server-side) and the localStorage mirror. */
export function writeStoredConsent(value: StoredConsent) {
  if (typeof window === "undefined") return;
  writeSharedCookie(value);
  try {
    document.cookie = `${CONSENT_KEY}=${value}; Path=/; Max-Age=${CONSENT_MAX_AGE}; SameSite=Lax`;
  } catch {}
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // localStorage blocked (private browsing mode): the cookies are enough.
  }
}

export function readConsentChoice(): ConsentChoice | null {
  return normaliseStoredConsent(readStoredConsentValue());
}

/** Sends a Consent Mode update for all four v2 keys. Never throws. */
export function updateConsentMode(choice: ConsentChoice) {
  try {
    if (typeof window === "undefined") return;
    const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    const state = consentStateFor(choice === "accepted");
    gtag("consent", "update", state);
    // Same update for GTM, which reads its own layer.
    const layer = (window as { gtmDataLayer?: unknown[] }).gtmDataLayer;
    if (Array.isArray(layer)) {
      (function (..._args: unknown[]) {
        layer.push(arguments);
      })("consent", "update", state);
    }
  } catch {
    // Analytics must never surface errors to users.
  }
}

/**
 * GA client id ("<a>.<b>") from a `document.cookie` string ("_ga=GA1.1.<a>.<b>").
 * Used to join a lead sent by the visitor back to GA acquisition data.
 *
 * Returned whenever a valid _ga cookie exists and the stored choice is not a
 * refusal (undecided visitors carry one: the default grants analytics
 * storage). A refusal always wins, even over a leftover cookie from an
 * earlier "accept".
 */
export function gaClientIdFromCookies(
  cookies: string,
  choice: ConsentChoice | null
): string | undefined {
  if (choice === "refused") return undefined;
  const raw = cookies
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith("_ga="))
    ?.slice("_ga=".length);
  if (!raw) return undefined;
  const parts = raw.split(".");
  if (parts.length < 4) return undefined;
  const clientId = parts.slice(-2).join(".");
  return /^\d+\.\d+$/.test(clientId) ? clientId : undefined;
}

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{4,20}$/;

export function isValidMeasurementId(id: string | undefined | null): id is string {
  return typeof id === "string" && MEASUREMENT_ID_PATTERN.test(id);
}

const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;
export const GTM_DATA_LAYER = "gtmDataLayer";

/**
 * Inline script for the root layout. Runs before any gtag 'js'/'config' or
 * event: the defaults (CONSENT_DEFAULT_RULES, most specific region first),
 * then the stored choice as an update, the AI-assistant referrer as
 * ai_source, then gtag.js (GA4) and gtm.js are injected after the load event,
 * in idle time, whatever the consent: Consent Mode governs what the tags do.
 *
 * GTM runs on its own layer (GTM_DATA_LAYER); the same consent defaults and
 * the stored choice are pushed there too, before gtm.js.
 */
export function buildConsentBootstrap(measurementId: string, gtmId?: string): string {
  if (!isValidMeasurementId(measurementId)) {
    throw new Error(`Invalid GA4 measurement id: ${measurementId}`);
  }
  const gtm = gtmId && GTM_ID_PATTERN.test(gtmId) ? gtmId : null;
  const denied = consentStateFor(false);
  const granted = consentStateFor(true);
  const id = JSON.stringify(measurementId);
  const key = JSON.stringify(CONSENT_KEY);
  const layer = JSON.stringify(GTM_DATA_LAYER);
  return [
    "(function(){",
    "window.dataLayer=window.dataLayer||[];",
    "function gtag(){window.dataLayer.push(arguments);}",
    "window.gtag=gtag;",
    `var g=window[${layer}]=window[${layer}]||[];`,
    "function gt(){g.push(arguments);}",
    "function both(){gtag.apply(null,arguments);gt.apply(null,arguments);}",
    ...CONSENT_DEFAULT_RULES.map((rule) => {
      const state: Record<string, unknown> = { ...consentStateFor(rule.granted) };
      if (rule.region) state.region = rule.region;
      if (rule.waitForUpdate) state.wait_for_update = rule.waitForUpdate;
      return `both('consent','default',${JSON.stringify(state)});`;
    }),
    "both('set','ads_data_redaction',true);",
    // Same rule as pickStoredConsent: the cookie wins, localStorage only
    // counts where cookies cannot be stored.
    "var c=null,l=null,k=null,ce=true;",
    "function ok(v){return v==='accepted'||v==='minimal'||v==='declined';}",
    `try{l=window.localStorage.getItem(${key});}catch(e){}`,
    `try{var m=document.cookie.match(/(?:^|; )${CONSENT_KEY}=([^;]*)/);if(m)c=m[1];var n=document.cookie.match(/(?:^|; )${SHARED_CONSENT_COOKIE}=([^;]*)/);if(n)k=n[1];}catch(e){}`,
    "try{ce=navigator.cookieEnabled!==false;}catch(e){}",
    "if(ok(k)){c=k;}else if(!ok(c)){c=(!ce&&ok(l))?l:null;}",
    `if(c==='accepted'){both('consent','update',${JSON.stringify(granted)});}`,
    `else if(c==='minimal'||c==='declined'){both('consent','update',${JSON.stringify(denied)});}`,
    // Client-side consent (same rule as hasEffectiveConsent) only decides
    // whether ai_source may be kept in sessionStorage.
    `var okc=c==='accepted'||(c===null&&${JSON.stringify(defaultGrantedClientSide())});`,
    // AI assistant referrer (fixed label only) as event param + user property.
    `var A=${JSON.stringify(AI_SOURCES)};`,
    "function mh(h){h=(h||'').toLowerCase().replace(/^www\\./,'');if(!h)return null;for(var i=0;i<A.length;i++){if(h===A[i][0]||h.slice(-A[i][0].length-1)==='.'+A[i][0])return A[i][1];}return null;}",
    `var ai=null;try{ai=window.sessionStorage.getItem(${JSON.stringify(AI_SOURCE_KEY)});}catch(e){}`,
    "if(!ai){var rh='';try{rh=new URL(document.referrer).hostname;}catch(e){}ai=mh(rh);",
    "if(!ai){var us='';try{us=(new URLSearchParams(location.search).get('utm_source')||'').toLowerCase();}catch(e){}ai=mh(us);if(!ai){for(var j=0;j<A.length;j++){if(A[j][1]===us){ai=us;break;}}}}",
    `if(ai&&okc){try{window.sessionStorage.setItem(${JSON.stringify(AI_SOURCE_KEY)},ai);}catch(e){}}}`,
    "if(ai){window.__aiSource=ai;gtag('set','user_properties',{ai_source:ai});gtag('set',{ai_source:ai});g.push({ai_source:ai});}",
    "gtag('js',new Date());",
    `gtag('config',${id});`,
    // gtag.js and gtm.js wait for the load event, then idle time (3 s at
    // most): the consent defaults and the js/config calls above are already
    // queued and are read when the libraries arrive. The nonce is read now,
    // document.currentScript is gone once this script has run.
    "var cs=document.currentScript,nn=cs&&cs.nonce;",
    "function add(src){var s=document.createElement('script');s.async=true;s.src=src;if(nn)s.nonce=nn;(document.head||document.documentElement).appendChild(s);}",
    "function ld(){",
    `add('https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(${id}));`,
    ...(gtm
      ? [
          `g.push({'gtm.start':new Date().getTime(),event:'gtm.js'});`,
          `add('https://www.googletagmanager.com/gtm.js?id='+${JSON.stringify(gtm)}+'&l='+${layer});`,
        ]
      : []),
    "}",
    "function idle(){if(typeof window.requestIdleCallback==='function'){window.requestIdleCallback(ld,{timeout:3000});}else{setTimeout(ld,1);}}",
    "if(document.readyState==='complete'){idle();}else{window.addEventListener('load',idle,{once:true});}",
    "})();",
  ].join("");
}
