"use client";

/**
 * GA4 engagement events on top of the Consent Mode tag (src/lib/engagement.ts):
 * scroll 25/50/75/90, outbound click with link_domain, file_download,
 * select_content on CTAs and service cards, faq_open, web_vitals. Also starts
 * PostHog after load/idle and re-checks the replay rule on every route.
 * Events carry page structure only, never typed values.
 */
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { trackEvent } from "@/src/lib/analytics";
import { classifyLinkClick, newScrollThresholds, scrollPercent, webVitalParams } from "@/src/lib/engagement";
import { startPostHogAfterLoad, syncSessionRecording } from "@/src/lib/posthog-lazy";

export default function EngagementTracker() {
  const pathname = usePathname();
  const sent = useRef<Set<number>>(new Set());

  useReportWebVitals((metric) => {
    trackEvent("web_vitals", webVitalParams(metric));
  });

  useEffect(() => {
    startPostHogAfterLoad();
  }, []);

  // New page: scroll thresholds start again, replay rule re-evaluated.
  useEffect(() => {
    sent.current = new Set();
    syncSessionRecording();
  }, [pathname]);

  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      const doc = document.documentElement;
      const percent = scrollPercent(window.scrollY, window.innerHeight, doc.scrollHeight);
      for (const t of newScrollThresholds(percent, sent.current)) {
        sent.current.add(t);
        trackEvent("scroll", { percent_scrolled: t });
      }
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      try {
        const target = e.target as Element | null;
        if (!target || typeof target.closest !== "function") return;
        const tagged = target.closest<HTMLElement>("[data-track-content-type]");
        const link = target.closest<HTMLAnchorElement>("a[href]");
        if (!link && !tagged) return;
        const explicit = tagged
          ? { contentType: tagged.dataset.trackContentType, itemId: tagged.dataset.trackId }
          : undefined;
        const hits = link
          ? classifyLinkClick(link.getAttribute("href") || "", window.location.href, explicit)
          : [{ event: "select_content" as const, params: { content_type: explicit!.contentType || "cta", item_id: explicit!.itemId || "" } }];
        for (const hit of hits) trackEvent(hit.event, hit.params);
      } catch {}
    };
    // toggle does not bubble: listen in the capture phase.
    const onToggle = (e: Event) => {
      try {
        const el = e.target as HTMLDetailsElement | null;
        if (!el || el.tagName !== "DETAILS" || !el.open || !el.hasAttribute("data-faq")) return;
        const question = (el.querySelector("summary")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 100);
        trackEvent("faq_open", { faq_question: question });
      } catch {}
    };
    document.addEventListener("click", onClick, { capture: true });
    document.addEventListener("toggle", onToggle, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("toggle", onToggle, { capture: true });
    };
  }, []);

  return null;
}
