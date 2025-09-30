"use client";

import { useEffect } from "react";

type DeferredNonCriticalStylesProps = {
  href: string;
};

export default function DeferredNonCriticalStyles({
  href,
}: DeferredNonCriticalStylesProps) {
  useEffect(() => {
    const mark = "non-critical";
    const selector = `link[data-arkfid-style="${mark}"]`;
    const existingLinks = document.querySelectorAll(selector);
    let alreadyLoaded = false;

    existingLinks.forEach((node) => {
      if (!(node instanceof HTMLLinkElement)) {
        return;
      }
      const link = node;
      if (link.href.endsWith(href)) {
        alreadyLoaded = true;
        return;
      }
      link.remove();
    });

    if (alreadyLoaded) {
      return;
    }

    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "style";
    preload.href = href;
    preload.crossOrigin = "anonymous";
    preload.setAttribute("data-arkfid-style", mark);

    preload.onload = () => {
      const sheet = document.createElement("link");
      sheet.rel = "stylesheet";
      sheet.href = href;
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
      fallback.href = href;
      fallback.crossOrigin = preload.crossOrigin;
      fallback.setAttribute("data-arkfid-style", mark);
      document.head.appendChild(fallback);
    };

    document.head.appendChild(preload);

    return () => {
      preload.onload = null;
      preload.onerror = null;
    };
  }, [href]);

  return (
    <noscript>
      <link rel="stylesheet" href={href} />
    </noscript>
  );
}
