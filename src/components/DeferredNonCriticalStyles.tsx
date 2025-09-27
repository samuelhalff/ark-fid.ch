"use client";

import { useEffect } from "react";

const NON_CRITICAL_HREF = "/assets/css/non-critical.css";

export default function DeferredNonCriticalStyles() {
  useEffect(() => {
    const mark = "non-critical";
    const existingStylesheet = document.querySelector(
      `link[data-arkfid-style="${mark}"]`
    );
    if (existingStylesheet) {
      return;
    }

    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "style";
    preload.href = NON_CRITICAL_HREF;
    preload.crossOrigin = "anonymous";
    preload.setAttribute("data-arkfid-style", mark);

    preload.onload = () => {
      const sheet = document.createElement("link");
      sheet.rel = "stylesheet";
      sheet.href = NON_CRITICAL_HREF;
      sheet.media = "print";
      sheet.crossOrigin = preload.crossOrigin;
      sheet.setAttribute("data-arkfid-style", mark);
      sheet.onload = () => {
        sheet.media = "all";
      };
      document.head.appendChild(sheet);
    };

    preload.onerror = () => {
      const fallback = document.createElement("link");
      fallback.rel = "stylesheet";
      fallback.href = NON_CRITICAL_HREF;
      fallback.crossOrigin = preload.crossOrigin;
      fallback.setAttribute("data-arkfid-style", mark);
      document.head.appendChild(fallback);
    };

    document.head.appendChild(preload);

    return () => {
      preload.onload = null;
      preload.onerror = null;
    };
  }, []);

  return (
    <noscript>
      <link rel="stylesheet" href={NON_CRITICAL_HREF} />
    </noscript>
  );
}
