"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Mounts render-less client code (trackers, pixels) after the first paint has
 * settled: on idle, on first interaction, or after `maxDelay`, whichever comes
 * first. Children render null, so the server HTML is unchanged.
 */
export default function IdleMount({
  children,
  maxDelay = 3000,
}: {
  children: ReactNode;
  maxDelay?: number;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let done = false;
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    const go = () => {
      if (done) return;
      done = true;
      cleanup();
      setReady(true);
    };
    const timer = window.setTimeout(go, maxDelay);
    const onLoad = () => {
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void, o: { timeout: number }) => void;
      };
      if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: maxDelay });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
    events.forEach((e) => window.addEventListener(e, go, { passive: true, once: true }));
    function cleanup() {
      window.clearTimeout(timer);
      window.removeEventListener("load", onLoad);
      events.forEach((e) => window.removeEventListener(e, go));
    }
    return cleanup;
  }, [maxDelay]);

  return ready ? <>{children}</> : null;
}
