"use client";

/**
 * One gate for everything that is not needed to read the page: measurement
 * libraries (PostHog, OpenAI pixel). Callbacks run after the load event, on
 * the visitor's first gesture (pointer, key, scroll, touch) or, if there is
 * none, after FALLBACK_MS, then in idle time. The inline bootstrap in
 * consent-mode.ts uses the same rule for gtag.js and gtm.js.
 * Calls made meanwhile are queued by each library and replayed on arrival.
 */
export const FIRST_INTERACTION_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;
export const FALLBACK_MS = 8000;

const waiting: (() => void)[] = [];
let armed = false;
let opened = false;

function open() {
  if (opened) return;
  opened = true;
  for (const type of FIRST_INTERACTION_EVENTS) window.removeEventListener(type, open, true);
  const run = () => waiting.splice(0).forEach((fn) => fn());
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(run, { timeout: 3000 });
  else window.setTimeout(run, 1);
}

function arm() {
  if (armed) return;
  armed = true;
  for (const type of FIRST_INTERACTION_EVENTS) window.addEventListener(type, open, { capture: true, passive: true });
  window.setTimeout(open, FALLBACK_MS);
}

export function afterFirstInteraction(fn: () => void) {
  if (typeof window === "undefined") return;
  if (opened) {
    fn();
    return;
  }
  waiting.push(fn);
  if (document.readyState === "complete") arm();
  else window.addEventListener("load", arm, { once: true });
}
