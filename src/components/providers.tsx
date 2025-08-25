// This is the most important part: mark this component as a client component.
"use client";

import ThemeProvider from "@/src/components/ui/theme-provider";
import "@/src/i18n"; // Initialize i18n on client side
import React, { useEffect } from "react";
import i18n from "i18next";

// This new component will wrap all your client-side providers.
export function Providers({ children }: { children: React.ReactNode }) {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/fr";

  useEffect(() => {
    try {
      const segments = pathname.split("/").filter(Boolean);
      const potential = segments[0];
      const valid = ["en", "fr", "de", "es", "pt"];
      const locale = valid.includes(potential) ? potential : "fr";
      if (i18n && i18n.language !== locale) {
        i18n.changeLanguage(locale);
      }
    } catch (e) {
      // swallow errors - i18n is optional
    }
  }, [pathname]);

  return <ThemeProvider>{children}</ThemeProvider>;
}
