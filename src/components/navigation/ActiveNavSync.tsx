"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export default function ActiveNavSync({ localePrefix }: { localePrefix: string }) {
  const pathname = usePathname() || "/";

  useEffect(() => {
    const normalize = (p: string) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);
    const cur = normalize(pathname);
    const anchors = document.querySelectorAll<HTMLAnchorElement>(".critical-nav__link");
    anchors.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const base = normalize(href);
      let active = false;
      if (base === normalize(localePrefix)) active = cur === base; // home must match exactly
      else active = cur === base || cur.startsWith(base + "/");
      a.classList.toggle("bg-accent", active);
    });
  }, [pathname, localePrefix]);

  return null;
}

