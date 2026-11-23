"use client";

/**
 * PostHog, loaded late and without storage before consent (same rule as
 * guide-assurance.ch):
 * - posthog-js is imported dynamically after the load event, in idle time,
 *   so it stays out of the first-render bundle;
 * - until the visitor accepts the cookie banner, persistence is "memory"
 *   (no cookie, no localStorage); after "accept" it switches to
 *   localStorage+cookie, after a refusal back to memory.
 * Calls made before the library is ready are queued, then replayed.
 */
import { readConsentChoice } from "@/src/lib/consent-mode";

type Props = Record<string, unknown>;
type PostHogLike = {
  init: (token: string, config: Record<string, unknown>) => unknown;
  capture: (event: string, props?: Props) => unknown;
  identify: (id: string, props?: Props) => unknown;
  reset: () => unknown;
  captureException: (error: unknown) => unknown;
  set_config: (config: Record<string, unknown>) => unknown;
};
type Call = [keyof Omit<PostHogLike, "init" | "set_config">, unknown[]];

const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;

let instance: PostHogLike | null = null;
let loading: Promise<void> | null = null;
const queue: Call[] = [];
const MAX_QUEUE = 100;

const persistence = () => (readConsentChoice() === "accepted" ? "localStorage+cookie" : "memory");

async function load() {
  if (!TOKEN || !HOST || typeof window === "undefined") return;
  const { default: posthog } = await import("posthog-js");
  posthog.init(TOKEN, {
    api_host: HOST,
    ui_host: "https://eu.posthog.com",
    defaults: "2026-05-30",
    capture_exceptions: true,
    persistence: persistence(),
    debug: process.env.NODE_ENV === "development",
  });
  instance = posthog as unknown as PostHogLike;
  for (const [method, args] of queue.splice(0)) {
    try {
      (instance[method] as (...a: unknown[]) => unknown)(...args);
    } catch {}
  }
  window.addEventListener("cookie-consent-changed", () => {
    if (!instance) return;
    const next = persistence();
    instance.set_config({ persistence: next });
    // Consent withdrawn: drop the identifiers stored while it was given.
    if (next === "memory") {
      try {
        instance.reset();
        const key = `ph_${TOKEN}_posthog`;
        window.localStorage.removeItem(key);
        window.localStorage.removeItem(`${key}__flags`);
        document.cookie = `${key}=; Max-Age=0; path=/`;
        document.cookie = `${key}=; Max-Age=0; path=/; domain=.${location.hostname.replace(/^www\./, "")}`;
      } catch {}
    }
  });
}

/** Starts PostHog after the load event, in idle time (3 s at most). */
export function startPostHogAfterLoad() {
  if (typeof window === "undefined" || loading) return;
  loading = new Promise<void>((resolve) => {
    const go = () => {
      load()
        .catch(() => {})
        .finally(resolve);
    };
    const idle = () => {
      if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(go, { timeout: 3000 });
      else window.setTimeout(go, 1);
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  });
}

function call(method: Call[0], args: unknown[]) {
  if (typeof window === "undefined") return;
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
  capture: (event: string, props?: Props) => call("capture", [event, props]),
  identify: (id: string, props?: Props) => call("identify", [id, props]),
  reset: () => call("reset", []),
  captureException: (error: unknown) => call("captureException", [error]),
};

export default posthog;
