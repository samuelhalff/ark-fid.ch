// This is the most important part: mark this component as a client component.
"use client";

import ThemeProvider from "@/src/components/ui/theme-provider";
import "@/src/i18n"; // Initialize i18n on client side
import React, { useEffect } from "react";
import i18n from "i18next";
import { usePathname } from "next/navigation";

// This new component will wrap all your client-side providers.
export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof pathname !== "string") return;
    const segments = pathname.split("/").filter(Boolean);
    const valid = ["en", "fr", "de", "es", "pt"] as const;
    const locale =
      segments.length > 0 && (valid as readonly string[]).includes(segments[0])
        ? segments[0]
        : "fr";
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [pathname]);
  return <ThemeProvider>{children}</ThemeProvider>;
}
