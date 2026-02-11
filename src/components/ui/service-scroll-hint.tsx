"use client";

import { useEffect, useState } from "react";

const ServiceScrollHint = ({ label }: { label: string }) => {
  const [hidden, setHidden] = useState(false);
  const targetSelector = "[data-service-content]";
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(motionMedia.matches);
    const onMotionChange = () => setPrefersReducedMotion(motionMedia.matches);
    motionMedia.addEventListener?.("change", onMotionChange);
    // Safari fallback
    motionMedia.addListener?.(onMotionChange);

    const target = document.querySelector(targetSelector);

    if (!target || typeof IntersectionObserver === "undefined") {
      const onScroll = () => {
        if (window.scrollY > window.innerHeight * 0.2) {
          setHidden(true);
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      return () => {
        window.removeEventListener("scroll", onScroll);
        motionMedia.removeEventListener?.("change", onMotionChange);
        motionMedia.removeListener?.(onMotionChange);
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) setHidden(true);
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40% 0px",
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
      motionMedia.removeEventListener?.("change", onMotionChange);
      motionMedia.removeListener?.(onMotionChange);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-8 left-0 right-0 flex justify-center transition-opacity duration-300 ${
        hidden ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/80 px-4 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur ${
          prefersReducedMotion ? "" : "animate-bounce"
        }`}
      >
        <span>{label}</span>
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14" />
          <path d="M19 12l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
};

export default ServiceScrollHint;
