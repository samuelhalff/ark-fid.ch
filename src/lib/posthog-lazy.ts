"use client";

/**
 * PostHog, loaded late (same policy on ark-fid.ch, houle.ai and
 * guide-assurance.ch, Sam 23.11.2026):
 * - posthog-js is imported dynamically after the load event, at the first
 *   gesture (or 8 s later), in idle time, so it stays out of the first-render bundle (never at instrumentation time);
 * - persistence follows the effective consent (hasEffectiveConsent): stored
 *   choice first, otherwise the default, granted everywhere since 23.11.2026
 *   (ignoring the banner = accepting): localStorage+cookie. "Refuser" →
 *   memory, identifiers wiped, no replay;
 * - autocapture (never input values), heatmaps, dead and rage clicks, web
 *   vitals, page leave with scroll depth;
 * - session replay only for persistent visitors, all inputs masked, and never
 *   on pages carrying client data (isReplayExcluded). Elements marked
 *   `ph-no-capture` (forms, chat transcripts) are blocked from replay and
 *   autocapture everywhere.
 * Calls made before the library is ready are queued, then replayed.
 * KYC and tax questionnaire pages (isAnalyticsFree): PostHog never loads and
 * every call is dropped, see src/lib/analytics-free.ts.
 * First-touch attribution (src/lib/attribution.ts), unless refused: lead and
 * conversion events carry it; canal and ai_source are session properties,
 * unregistered on "Refuser".
 */
import { hasEffectiveConsent } from "@/src/lib/consent-mode";
import { afterFirstInteraction } from "@/src/lib/first-interaction";
import { isReplayExcluded } from "@/src/lib/replay-policy";
import { isAnalyticsFree } from "@/src/lib/analytics-free";
import { getAnalyticsAttribution, withConversionAttribution } from "@/src/lib/attribution";

type Props = Record<string, unknown>;
type PostHogLike = {
  init: (token: string, config: Record<string, unknown>) => unknown;
  capture: (event: string, props?: Props) => unknown;
  identify: (id: string, props?: Props) => unknown;
  reset: () => unknown;
  captureException: (error: unknown) => unknown;
  set_config: (config: Record<string, unknown>) => unknown;
  startSessionRecording: (override?: unknown) => unknown;
  stopSessionRecording: () => unknown;
  sessionRecordingStarted: () => boolean;
  register_for_session: (props: Props) => unknown;
  unregister_for_session: (key: string) => unknown;
};
type Call = [keyof Pick<PostHogLike, "capture" | "identify" | "reset" | "captureException">, unknown[]];

const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

let instance: PostHogLike | null = null;
let loading: Promise<void> | null = null;
const queue: Call[] = [];
const MAX_QUEUE = 100;
const CLICK_EVENTS = new Set(["$autocapture", "$rageclick", "$dead_click", "$copy_autocapture", "$$heatmap"]);

const persistence = () => (hasEffectiveConsent() ? "localStorage+cookie" : "memory");

/** Starts or stops the replay for the current page and consent. */
export function syncSessionRecording() {
  if (!instance || typeof window === "undefined") return;
  try {
    const want =
      hasEffectiveConsent() &&
      !analyticsFreePage() &&
      !isReplayExcluded(window.location.hostname, window.location.pathname);
    const started = instance.sessionRecordingStarted();
    if (want && !started) instance.startSessionRecording({ sampling: true, linked_flag: true });
    else if (!want && started) instance.stopSessionRecording();
  } catch {}
}

const SESSION_KEYS = ["canal", "ai_source"] as const;

/** canal and ai_source on every event of the session (page views included), for funnels by channel. */
function syncSessionAttribution() {
  if (!instance) return;
  try {
    const a = hasEffectiveConsent() ? getAnalyticsAttribution(true) : {};
    if (a.canal) instance.register_for_session({ canal: a.canal, ...(a.ai_source ? { ai_source: a.ai_source } : {}) });
    else for (const k of SESSION_KEYS) instance.unregister_for_session(k);
  } catch {}
}

function wipeIdentifiers() {
  if (!instance) return;
  try {
    instance.reset();
    const key = `ph_${TOKEN}_posthog`;
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(`${key}__flags`);
    document.cookie = `${key}=; Max-Age=0; path=/`;
    document.cookie = `${key}=; Max-Age=0; path=/; domain=.${location.hostname.replace(/^www\./, "")}`;
  } catch {}
}

const analyticsFreePage = () =>
  typeof window !== "undefined" && isAnalyticsFree(window.location.hostname, window.location.pathname);

async function load() {
  if (!TOKEN || !HOST || typeof window === "undefined" || analyticsFreePage()) return;
  const { default: posthog } = await import("posthog-js");
  posthog.init(TOKEN, {
    api_host: HOST,
    ui_host: "https://eu.posthog.com",
    defaults: "2026-05-30",
    capture_exceptions: true,
    persistence: persistence(),
    autocapture: { capture_copied_text: false },
    capture_pageview: "history_change",
    capture_pageleave: true,
    enable_heatmaps: true,
    capture_dead_clicks: true,
    rageclick: true,
    capture_performance: { web_vitals: true, network_timing: true },
    // Replay is started by syncSessionRecording only (consent + page check).
    disable_session_recording: true,
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: ".ph-mask, [data-ph-mask]",
      blockSelector: ".ph-no-capture",
      recordCrossOriginIframes: false,
    },
    // Pages with client data: no click/heatmap events at all (replay is off there too).
    before_send: <T extends { event?: string } | null>(event: T): T | null => {
      if (analyticsFreePage()) return null;
      if (event && CLICK_EVENTS.has(event.event || "") && isReplayExcluded(location.hostname, location.pathname)) return null;
      return event;
    },
    debug: process.env.NODE_ENV === "development",
  });
  instance = posthog as unknown as PostHogLike;
  for (const [method, args] of queue.splice(0)) {
    try {
      (instance[method] as (...a: unknown[]) => unknown)(...args);
    } catch {}
  }
  syncSessionAttribution();
  syncSessionRecording();
  window.addEventListener("cookie-consent-changed", () => {
    if (!instance) return;
    const next = persistence();
    instance.set_config({ persistence: next });
    // Consent withdrawn: no replay, drop the identifiers stored meanwhile.
    if (next === "memory") wipeIdentifiers();
    syncSessionAttribution();
    syncSessionRecording();
  });
}

/** Starts PostHog at the first gesture after load (or 8 s after load), in idle time. */
export function startPostHogAfterLoad() {
  if (typeof window === "undefined" || loading || analyticsFreePage()) return;
  loading = new Promise<void>((resolve) => {
    const go = () => {
      load()
        .catch(() => {})
        .finally(resolve);
    };
    afterFirstInteraction(go);
  });
}

function call(method: Call[0], args: unknown[]) {
  if (typeof window === "undefined" || analyticsFreePage()) return;
  if (instance) {
    try {
      (instance[method] as (...a: unknown[]) => unknown)(...args);
    } catch {}
    return;
  }
  if (queue.length < MAX_QUEUE) queue.push([method, args]);
  startPostHogAfterLoad();
}

/** Same calls as the posthog-js singleton used before (capture, identify, reset, captureException). */
const posthog = {
  capture: (event: string, props?: Props) =>
    call("capture", [event, withConversionAttribution(event, props, getAnalyticsAttribution(hasEffectiveConsent()))]),
  identify: (id: string, props?: Props) => call("identify", [id, props]),
  reset: () => call("reset", []),
  captureException: (error: unknown) => call("captureException", [error]),
};

export default posthog;
