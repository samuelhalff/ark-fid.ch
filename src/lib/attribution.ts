/**
 * First-party lead attribution (first touch of the current visit).
 *
 * What is kept: landing pathname, referrer origin (external sites only),
 * allowlisted utm_* values, gclid and a trail of up to 20 visited pathnames.
 * Never full URLs or query strings.
 *
 * Where it lives: in memory for every visitor (survives client-side
 * navigation, lost on reload). Mirrored to sessionStorage only while the
 * visitor has accepted cookies. It leaves the browser only when the visitor
 * submits a lead form or the assistant, with a notice next to the button.
 *
 * Analytics (Sam, 23.11.2026, same rule as guide-assurance.ch): unless the
 * visitor refused, lead and conversion events (CONVERSION_EVENTS) carry the
 * first-touch channel, referring domain, landing pathname, utm_* and AI
 * label (analyticsAttribution) to GA4 and PostHog; canal and ai_source are
 * also PostHog session properties. sessionStorage only, never a cookie,
 * wiped by "Refuser". Never the page trail, the gclid or a typed value.
 *
 * Dependency-free so it can be unit tested with `node --test`.
 */

export type AttributionUtm = {
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
};

export type Attribution = {
  landingPage: string;
  referrer: string;
  utm: AttributionUtm;
  gclid: string;
  pages: string[];
  /** Acquisition channel of the first page (canalAcquisition); analytics only, never sent with a lead. */
  canal?: Canal;
  /** AI assistant label (detectAiSource in consent-mode); analytics only. */
  aiSource?: string;
};

/**
 * Acquisition channel of the first page of the visit (same classifier as
 * guide-assurance.ch, Sam 23.11.2026): paid click ids or a paid utm_medium
 * first, then AI assistants, then search engines, social networks, other
 * referring sites, direct.
 */
export type Canal = "google" | "bing" | "autre_recherche" | "ia" | "reseau_social" | "referent" | "direct" | "payant";
export const CANAUX: readonly Canal[] = ["google", "bing", "autre_recherche", "ia", "reseau_social", "referent", "direct", "payant"];

const PAID_CLICK_IDS = ["gclid", "gbraid", "wbraid", "dclid", "msclkid", "li_fat_id", "ttclid"];
const PAID_MEDIUM = /^(cpc|ppc|cpm|cpv|paid|paid[_-]?(search|social|media)|display|banner|sem|ads?)$/;
const SEARCH: [RegExp, Canal][] = [
  [/(^|\.)google\.[a-z.]+$|^com\.google\.android\.googlequicksearchbox$/, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)(duckduckgo\.com|ecosia\.org|qwant\.com|yahoo\.com|search\.yahoo\.[a-z.]+|yandex\.[a-z.]+|baidu\.com|startpage\.com|search\.brave\.com|search\.ch|swisscows\.com|lilo\.org|kagi\.com|ask\.com|aol\.com|seznam\.cz)$/, "autre_recherche"],
];
const SOCIAL = /(^|\.)(facebook\.com|fb\.com|fb\.me|instagram\.com|linkedin\.com|lnkd\.in|t\.co|twitter\.com|x\.com|reddit\.com|youtube\.com|youtu\.be|tiktok\.com|pinterest\.[a-z.]+|whatsapp\.com|wa\.me|telegram\.org|t\.me|threads\.net|threads\.com|snapchat\.com|bsky\.app|mastodon\.social|xing\.com)$/;
const SOCIAL_SOURCE = /^(facebook|fb|instagram|ig|linkedin|twitter|x|reddit|youtube|tiktok|pinterest|whatsapp|telegram|threads|snapchat|bluesky|xing)$/;

/** Referrer host without www., or "" (invalid, empty or this site). */
export function referrerDomain(referrer: unknown, currentHost: string): string {
  if (typeof referrer !== "string" || !referrer) return "";
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    if (!host || host === currentHost.toLowerCase().replace(/^www\./, "")) return "";
    return host.slice(0, 100);
  } catch {
    return "";
  }
}

/** aiSource: label from detectAiSource (consent-mode), computed by the caller. */
export function canalAcquisition(referrer: string, search: string, currentHost: string, aiSource = ""): Canal {
  const q = new URLSearchParams(search);
  const medium = (q.get("utm_medium") || "").toLowerCase().trim();
  const source = (q.get("utm_source") || "").toLowerCase().trim();
  if (PAID_CLICK_IDS.some((k) => q.get(k)) || PAID_MEDIUM.test(medium)) return "payant";
  if (aiSource) return "ia";
  const dom = referrerDomain(referrer, currentHost);
  if (source) {
    for (const [re, c] of SEARCH) if (re.test(source) || source === c) return c;
    if (SOCIAL_SOURCE.test(source) || SOCIAL.test(source) || medium === "social") return "reseau_social";
  }
  if (dom) {
    for (const [re, c] of SEARCH) if (re.test(dom)) return c;
    if (SOCIAL.test(dom)) return "reseau_social";
    return "referent";
  }
  return source ? "referent" : "direct";
}

export const ATTRIBUTION_STORAGE_KEY = "leadAttribution";
export const ATTRIBUTION_MAX_PAGES = 20;
export const ATTRIBUTION_MAX_PATH = 200;
export const ATTRIBUTION_MAX_PARAM = 150;

const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const;

/** Strips markup/control characters and bounds the length. */
export function sanitizeAttributionParam(
  value: unknown,
  max = ATTRIBUTION_MAX_PARAM,
): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f<>"'`]/g, "")
    .trim()
    .slice(0, max);
}

/** Pathname only: no query, no hash, bounded. */
export function cleanPathname(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  let path = value.split(/[?#]/)[0] || "";
  if (!path.startsWith("/")) return "";
  path = path.replace(/[\u0000-\u001f\u007f<>"'`\s]/g, "");
  return path.slice(0, ATTRIBUTION_MAX_PATH);
}

/** Origin of an external referrer; empty for same-site or invalid values. */
export function referrerOrigin(referrer: unknown, currentHost: string): string {
  if (typeof referrer !== "string" || !referrer) return "";
  try {
    const url = new URL(referrer);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    const host = url.hostname.replace(/^www\./, "");
    const own = currentHost.replace(/^www\./, "");
    if (host === own) return "";
    return url.origin.slice(0, ATTRIBUTION_MAX_PARAM);
  } catch {
    return "";
  }
}

export function emptyUtm(): AttributionUtm {
  return { source: "", medium: "", campaign: "", term: "", content: "" };
}

export function createAttribution(href: string, referrer: string, aiSource = ""): Attribution {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { landingPage: "", referrer: "", utm: emptyUtm(), gclid: "", pages: [] };
  }
  const ai = sanitizeAttributionParam(aiSource, 40);
  const utm = emptyUtm();
  for (const key of UTM_KEYS) {
    utm[key] = sanitizeAttributionParam(url.searchParams.get(`utm_${key}`));
  }
  const landingPage = cleanPathname(url.pathname);
  return {
    landingPage,
    referrer: referrerOrigin(referrer, url.hostname),
    utm,
    gclid: sanitizeAttributionParam(url.searchParams.get("gclid"), 200),
    pages: landingPage ? [landingPage] : [],
    canal: canalAcquisition(referrer, url.search, url.hostname, ai),
    ...(ai ? { aiSource: ai } : {}),
  };
}

/** Appends a pathname once (deduplicated), capped at ATTRIBUTION_MAX_PAGES. */
export function addAttributionPage(
  attribution: Attribution,
  pathname: string,
): Attribution {
  const path = cleanPathname(pathname);
  if (!path || attribution.pages.includes(path)) return attribution;
  if (attribution.pages.length >= ATTRIBUTION_MAX_PAGES) return attribution;
  return { ...attribution, pages: [...attribution.pages, path] };
}

/** Validates a value read back from storage; returns null if unusable. */
export function parseStoredAttribution(raw: unknown): Attribution | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<Attribution> | null;
    if (!data || typeof data !== "object") return null;
    const utm = emptyUtm();
    for (const key of UTM_KEYS) {
      utm[key] = sanitizeAttributionParam(data.utm?.[key]);
    }
    const pages = Array.isArray(data.pages)
      ? Array.from(new Set(data.pages.map(cleanPathname).filter(Boolean))).slice(
          0,
          ATTRIBUTION_MAX_PAGES,
        )
      : [];
    const referrer = sanitizeAttributionParam(data.referrer);
    const gclid = sanitizeAttributionParam(data.gclid, 200);
    const aiSource = sanitizeAttributionParam(data.aiSource, 40);
    // Copies stored before the channel existed: derived from what was kept.
    const search = new URLSearchParams();
    for (const key of UTM_KEYS) if (utm[key]) search.set(`utm_${key}`, utm[key]);
    if (gclid) search.set("gclid", gclid);
    const canal = CANAUX.includes(data.canal as Canal)
      ? (data.canal as Canal)
      : canalAcquisition(referrer, search.toString(), "", aiSource);
    return {
      landingPage: cleanPathname(data.landingPage),
      referrer,
      utm,
      gclid,
      pages,
      canal,
      ...(aiSource ? { aiSource } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * First-touch properties for analytics conversion events (GA4 and PostHog):
 * canal, referent_domaine (host only), page_arrivee (pathname only), utm_*
 * and ai_source. Never the page trail, the gclid or anything typed.
 */
export function analyticsAttribution(a: Attribution | null | undefined): Record<string, string> {
  if (!a || !a.canal) return {};
  const out: Record<string, string> = { canal: a.canal };
  const dom = referrerDomain(a.referrer, "");
  if (dom) out.referent_domaine = dom;
  if (a.landingPage) out.page_arrivee = a.landingPage.slice(0, 100);
  for (const key of UTM_KEYS) if (a.utm[key]) out[`utm_${key}`] = a.utm[key].slice(0, 100);
  if (a.aiSource) out.ai_source = a.aiSource;
  return out;
}

/** Lead and conversion events that carry the first-touch attribution. */
export const CONVERSION_EVENTS = [
  "generate_lead",
  "contact_form_start",
  "contact_form_started",
  "contact_form_submitted",
  "agent_open",
  "agent_first_message",
  "agent_first_response",
  "agent_lead_confirmed",
  "contact_channel_click",
] as const;
/** select_content items that are contact channels (tel:, mailto:, WhatsApp links). */
const CONTACT_ITEMS = new Set(["tel", "mailto", "whatsapp"]);

export function isConversionEvent(name: string, props?: Record<string, unknown>): boolean {
  if ((CONVERSION_EVENTS as readonly string[]).includes(name)) return true;
  return name === "select_content" && props?.content_type === "cta" && CONTACT_ITEMS.has(String(props?.item_id));
}

/** Attribution first, then the event's own properties (they win). Non-conversion events unchanged. */
export function withConversionAttribution<P extends Record<string, unknown>>(
  name: string,
  props: P | undefined,
  attribution: Record<string, string>,
): P | Record<string, unknown> | undefined {
  if (!attribution.canal || !isConversionEvent(name, props)) return props;
  return { ...attribution, ...(props ?? {}) };
}

// ---------------------------------------------------------------------------
// Browser runtime (module state survives Next.js client-side navigation).
// ---------------------------------------------------------------------------

let current: Attribution | null = null;

function persist(consented: boolean) {
  try {
    if (consented && current) {
      window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(current));
    } else {
      window.sessionStorage.removeItem(ATTRIBUTION_STORAGE_KEY);
    }
  } catch {
    // Storage blocked: in-memory only.
  }
}

/**
 * Records a page view; initialises first touch on the first call.
 * aiSource: detectAiSource(document.referrer, utm_source), from the caller.
 */
export function recordAttributionPage(pathname: string, consented: boolean, aiSource = "") {
  if (typeof window === "undefined") return;
  try {
    if (!current) {
      let stored: Attribution | null = null;
      if (consented) {
        try {
          stored = parseStoredAttribution(
            window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY),
          );
        } catch {
          stored = null;
        }
      }
      current = stored || createAttribution(window.location.href, document.referrer, aiSource);
    }
    current = addAttributionPage(current, pathname);
    persist(consented);
  } catch {
    // Attribution must never break navigation.
  }
}

/** Called when the cookie choice changes: write or wipe the session copy. */
export function syncAttributionStorage(consented: boolean) {
  if (typeof window === "undefined") return;
  persist(consented);
}

export function getAttribution(): Attribution | null {
  return current;
}

/**
 * First-touch properties for analytics conversion events, or {} when the
 * visitor refused (consented = hasEffectiveConsent(), from the caller).
 */
export function getAnalyticsAttribution(consented: boolean): Record<string, string> {
  if (!consented) return {};
  return analyticsAttribution(current);
}

/** Fields sent with a lead submission (unchanged: no channel, no AI label). */
export function getAttributionPayload(): Attribution {
  const a =
    current ||
    (typeof window === "undefined"
      ? { landingPage: "", referrer: "", utm: emptyUtm(), gclid: "", pages: [] }
      : createAttribution(window.location.href, document.referrer));
  const { landingPage, referrer, utm, gclid, pages } = a;
  return { landingPage, referrer, utm, gclid, pages };
}

/** Current page as origin + pathname (no query string or hash). */
export function currentPageUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    return `${window.location.origin}${cleanPathname(window.location.pathname)}`;
  } catch {
    return "";
  }
}

/** Test hook. */
export function resetAttributionForTests() {
  current = null;
}
